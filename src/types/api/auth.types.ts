export interface RegisterRequest {
  email: string;
  fullName: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
  country?: string; // Optional, not shown in UI but may be needed for compliance
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


