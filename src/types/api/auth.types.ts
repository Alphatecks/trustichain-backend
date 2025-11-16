export interface RegisterRequest {
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  country: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      fullName: string;
      country: string;
    };
  };
  error?: string;
}


