import { supabase, supabaseAdmin } from '../config/supabase';
import { RegisterRequest, RegisterResponse, LoginRequest, LoginResponse } from '../types/api/auth.types';

export class AuthService {
  /**
   * Register a new user
   * @param registerData - User registration data
   * @returns Registration response with user data or error
   */
  async register(registerData: RegisterRequest): Promise<RegisterResponse> {
    try {
      const { email, password, fullName, country, agreeToTerms } = registerData;

      // Terms and conditions are validated in middleware, but double-check here
      if (!agreeToTerms) {
        return {
          success: false,
          message: 'You must agree to the terms and conditions',
          error: 'Terms not accepted',
        };
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', email.toLowerCase())
        .single();

      if (existingUser) {
        return {
          success: false,
          message: 'User with this email already exists',
          error: 'Email already registered',
        };
      }

      // Create user in Supabase Auth with email confirmation
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password,
        options: {
          emailRedirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/verify-email`,
          data: {
            full_name: fullName,
            country: country,
          },
        },
      });

      if (authError) {
        return {
          success: false,
          message: authError.message || 'Failed to create user account',
          error: 'Authentication error',
        };
      }

      if (!authData.user) {
        return {
          success: false,
          message: 'Failed to create user account',
          error: 'No user data returned',
        };
      }

      // Create user profile in database
      // Use admin client to bypass RLS for server-side registration
      const adminClient = supabaseAdmin || supabase;
      const { data: profileData, error: profileError } = await adminClient
        .from('users')
        .insert({
          id: authData.user.id,
          email: email.toLowerCase(),
          full_name: fullName,
          country: country || null, // Handle optional country
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (profileError) {
        // If profile creation fails, we should handle cleanup
        // For now, return error (in production, you might want to clean up the auth user)
        return {
          success: false,
          message: profileError.message || 'Failed to create user profile',
          error: 'Database error',
        };
      }

      // Check if email verification is required
      const emailVerified = authData.user?.email_confirmed_at !== null;

      return {
        success: true,
        message: emailVerified
          ? 'User registered successfully'
          : 'User registered successfully. Please check your email to verify your account before logging in.',
        data: {
          user: {
            id: profileData.id,
            email: profileData.email,
            fullName: profileData.full_name,
            country: profileData.country,
          },
          emailVerificationRequired: !emailVerified,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return {
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      };
    }
  }

  /**
   * Login a user
   * @param loginData - User login credentials
   * @returns Login response with user data and tokens or error
   */
  async login(loginData: LoginRequest): Promise<LoginResponse> {
    try {
      const { email, password } = loginData;

      // Attempt to sign in
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: password,
      });

      if (authError) {
        return {
          success: false,
          message: authError.message || 'Invalid email or password',
          error: 'Authentication failed',
        };
      }

      if (!authData.user) {
        return {
          success: false,
          message: 'Failed to authenticate user',
          error: 'No user data returned',
        };
      }

      // Check if email is verified
      if (!authData.user.email_confirmed_at) {
        return {
          success: false,
          message: 'Please verify your email before logging in. Check your inbox for the verification link.',
          error: 'Email not verified',
          emailVerificationRequired: true,
        };
      }

      // Get user profile from database
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('id, email, full_name, country')
        .eq('id', authData.user.id)
        .single();

      if (profileError || !profileData) {
        return {
          success: false,
          message: 'User profile not found',
          error: 'Profile error',
        };
      }

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: profileData.id,
            email: profileData.email,
            fullName: profileData.full_name,
            country: profileData.country,
          },
          accessToken: authData.session?.access_token,
          refreshToken: authData.session?.refresh_token,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return {
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      };
    }
  }
}

export const authService = new AuthService();


