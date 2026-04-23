import axios from '../axiosInstance';

export interface AuthUserProfile {
  id: string;
  username: string;
  display_name: string;
  roles: string[];
}

export interface AuthLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUserProfile;
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
