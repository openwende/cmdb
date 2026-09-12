import axios from '../axiosInstance';

export interface AuthUserProfile {
  id: string;
  username: string;
  display_name: string;
  roles: string[];
}

export interface AuthManagedUser {
  id: string;
  username: string;
  display_name: string;
  status: string;
  role: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
}

export interface AuthListUsersResponse {
  items: AuthManagedUser[];
  total: number;
}

export interface AuthLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUserProfile;
}

export interface CreateAuthUserPayload {
  username: string;
  display_name: string;
  password: string;
  role: string;
}

export interface UpdateAuthUserPayload {
  display_name: string;
  status: string;
  role: string;
}

export const login = async (payload: {
  username: string;
  password: string;
}): Promise<AuthLoginResponse> => {
  return axios.post('/v1/auth/login', payload);
};

export const getCurrentUser = async (): Promise<AuthUserProfile> => {
  return axios.get('/v1/auth/me');
};

export const listAuthUsers = async (): Promise<AuthListUsersResponse> => {
  return axios.get('/v1/auth/users');
};

export const createAuthUser = async (payload: CreateAuthUserPayload): Promise<AuthManagedUser> => {
  return axios.post('/v1/auth/users', payload);
};

export const updateAuthUser = async (
  userID: string,
  payload: UpdateAuthUserPayload,
): Promise<AuthManagedUser> => {
  return axios.put(`/v1/auth/users/${userID}`, payload);
};

export const resetAuthUserPassword = async (
  userID: string,
  payload: { password: string },
): Promise<{ success: boolean }> => {
  return axios.put(`/v1/auth/users/${userID}/password`, payload);
};
