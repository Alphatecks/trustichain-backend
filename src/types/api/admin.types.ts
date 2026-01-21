export interface AdminLoginRequest {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  message: string;
  data?: {
    admin: {
      id: string;
      email: string;
      fullName: string;
    };
    accessToken?: string;
    refreshToken?: string;
  };
  error?: string;
}

export interface AdminLogoutResponse {
  success: boolean;
  message: string;
  error?: string;
}
