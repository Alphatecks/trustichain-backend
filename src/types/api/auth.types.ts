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
      /** Unique handle for P2P sends; assigned on registration when possible */
      trustitag?: string;
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
      /** Unique handle for sending/receiving XRP between TrustiChain users */
      trustitag?: string;
    };
    /** Supabase JWT — use as Authorization: Bearer <accessToken> on protected routes (not mfaToken) */
    accessToken?: string;
    refreshToken?: string;
    /** Present when password sign-in succeeded but TOTP is required */
    requiresMfa?: boolean;
    /** Short-lived encrypted blob for POST /api/auth/login/mfa body only — never send as Bearer */
    mfaToken?: string;
  };
  error?: string;
  emailVerificationRequired?: boolean;
}

/** POST /api/auth/login/mfa — complete login after TOTP */
export interface LoginMfaRequest {
  code: string;
  mfaToken: string;
  email?: string;
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
      trustitag?: string;
    };
    accessToken?: string;
    refreshToken?: string;
    /** Google sign-in succeeded but TOTP is required before tokens are issued */
    requiresMfa?: boolean;
    /** Encrypted token for POST /api/auth/login/mfa (same as password MFA flow) */
    mfaToken?: string;
  };
  error?: string;
}

/** POST /api/auth/oauth/mfa-prep — SPA Google OAuth: obtain mfaToken when mfa_enabled (call before using the app) */
export interface OAuthMfaPrepRequest {
  accessToken: string;
  refreshToken: string;
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
      trustitag?: string;
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


