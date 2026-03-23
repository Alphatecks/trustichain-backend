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
    emailVerificationRequired?: boolean;
  };
  error?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      fullName: string;
      country: string;
    };
    accessToken?: string;
    refreshToken?: string;
  };
  error?: string;
  emailVerificationRequired?: boolean;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface GoogleOAuthResponse {
  success: boolean;
  message: string;
  data?: {
    url: string; // OAuth URL to redirect to
  };
  error?: string;
}

export interface GoogleOAuthCallbackResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      fullName: string;
      country: string | null;
    };
    accessToken?: string;
    refreshToken?: string;
  };
  error?: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
  error?: string;
}

/** POST /api/auth/ensure-profile — sync public.users from Supabase Auth (SPA OAuth, etc.) */
export interface EnsureProfileResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      fullName: string;
      country: string | null;
    };
    created: boolean;
  };
  error?: string;
}

/** GET /api/auth/supabase-public-config — public anon client bootstrap */
export interface SupabasePublicConfigResponse {
  success: boolean;
  message: string;
  data?: {
    url: string;
    anonKey: string;
  };
  error?: string;
}


