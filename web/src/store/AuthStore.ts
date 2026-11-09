import { create } from 'zustand';
import { getCurrentUser, login as loginRequest, AuthUserProfile } from '@/api/services/auth';
import { AUTH_TOKEN_KEY, LOGIN_PATH } from '@/constants/auth';

type AuthRole = 'admin' | 'editor' | 'viewer';

interface AuthStoreState {
  token: string | null;
  user: AuthUserProfile | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<AuthUserProfile>;
  fetchMe: () => Promise<AuthUserProfile | null>;
  logout: (redirectToLogin?: boolean) => void;
  hasRole: (...roles: AuthRole[]) => boolean;
  canWrite: () => boolean;
  reset: () => void;
}

const readToken = () => localStorage.getItem(AUTH_TOKEN_KEY);

const persistToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    return;
  }
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  token: readToken(),
  user: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    const { initialized, loading } = get();
    if (initialized || loading) return;

    const token = readToken();
    if (!token) {
      set({ token: null, user: null, initialized: true, loading: false });
      return;
    }

    set({ token, loading: true });
    try {
      const user = await getCurrentUser();
      set({ user, token, initialized: true, loading: false });
    } catch (error) {
      console.error('Failed to initialize auth state:', error);
      persistToken(null);
      set({ token: null, user: null, initialized: true, loading: false });
    }
  },

  login: async (username: string, password: string) => {
    set({ loading: true });
    try {
      const response = await loginRequest({ username, password });
      persistToken(response.access_token);
      set({
        token: response.access_token,
        user: response.user,
        initialized: true,
        loading: false,
      });
      return response.user;
    } catch (error) {
      set({ loading: false, initialized: true });
      throw error;
    }
  },

  fetchMe: async () => {
    try {
      const user = await getCurrentUser();
      set({ user, initialized: true });
      return user;
    } catch (error) {
      console.error('Failed to fetch current user:', error);
      return null;
    }
  },

  logout: (redirectToLogin = false) => {
    persistToken(null);
    set({ token: null, user: null, initialized: true, loading: false });

    if (redirectToLogin && window.location.pathname !== LOGIN_PATH) {
      window.location.assign(LOGIN_PATH);
    }
  },

  hasRole: (...roles: AuthRole[]) => {
    const { user } = get();
    if (!user) return false;
    return roles.some((role) => user.roles.includes(role));
  },

  canWrite: () => {
    const { user } = get();
    if (!user) return false;
    return user.roles.includes('admin') || user.roles.includes('editor');
  },

  reset: () => {
    persistToken(null);
    set({ token: null, user: null, loading: false, initialized: false });
  },
}));
