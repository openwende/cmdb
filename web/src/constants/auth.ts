export const AUTH_TOKEN_KEY = 'authToken';
export const LOGIN_PATH = '/login';

/** Seeded demo credentials from backend auth migrations */
export const DEMO_ADMIN_USERNAME = 'admin';
export const DEMO_ADMIN_PASSWORD = 'admin123456';

/**
 * Demo login UX (prefill + one-click admin) is on in local dev,
 * or when production builds set VITE_DEMO_LOGIN=true.
 */
export const isDemoLoginEnabled = (): boolean =>
  Boolean(import.meta.env.DEV) || import.meta.env.VITE_DEMO_LOGIN === 'true';
