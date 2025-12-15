import { supabase, supabaseAdmin } from '../config/supabase';
import { RegisterRequest, RegisterResponse, LoginRequest, LoginResponse, VerifyEmailRequest, VerifyEmailResponse, GoogleOAuthResponse, GoogleOAuthCallbackResponse } from '../types/api/auth.types';
import { emailService } from './email.service';
import crypto from 'crypto';

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

      // Create user in Supabase Auth using admin client to disable automatic email
      // We'll send verification email via Gmail instead
      let authData;
      let authError;

      if (supabaseAdmin) {
        // Use admin client to create user without sending email
        const result = await supabaseAdmin.auth.admin.createUser({
          email: email.toLowerCase(),
          password: password,
          email_confirm: false, // Don't auto-confirm, require verification
          user_metadata: {
            full_name: fullName,
            country: country,
          },
        });
        authData = { user: result.data.user, session: null };
        authError = result.error;
      } else {
        // Fallback to regular signUp (Supabase will still send email, but we'll send ours too)
        const result = await supabase.auth.signUp({
          email: email.toLowerCase(),
          password: password,
          options: {
            data: {
              full_name: fullName,
              country: country,
            },
          },
        });
        authData = result.data;
        authError = result.error;
      }

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

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

      // Store verification token in database (reuse adminClient from above)
      const { error: tokenError } = await adminClient
        .from('email_verification_tokens')
        .insert({
          user_id: authData.user.id,
          token: verificationToken,
          expires_at: expiresAt.toISOString(),
          used: false,
        });

      if (tokenError) {
        console.error('Failed to create verification token:', tokenError);
        // Continue anyway, user can request resend
      }

      // Send verification email via Gmail
      const emailResult = await emailService.sendVerificationEmail(
        email.toLowerCase(),
        verificationToken,
        fullName
      );

      if (!emailResult.success) {
        console.error('Failed to send verification email:', emailResult.error);
        // Return error so user knows email failed
        return {
          success: false,
          message: `User account created, but failed to send verification email: ${emailResult.error}. Please contact support.`,
          error: 'Email sending failed',
          data: {
            user: {
              id: profileData.id,
              email: profileData.email,
              fullName: profileData.full_name,
              country: profileData.country,
            },
          },
        };
      }

      return {
        success: true,
        message: 'User registered successfully. Please check your email to verify your account before logging in.',
        data: {
          user: {
            id: profileData.id,
            email: profileData.email,
            fullName: profileData.full_name,
            country: profileData.country,
          },
          emailVerificationRequired: true,
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

      // Attempt to sign in (primary network call)
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

      // Build user profile directly from Supabase Auth user + metadata
      // to avoid an extra database round-trip on every login.
      const user = authData.user;
      const fullName =
        (user.user_metadata as any)?.full_name ||
        (user.user_metadata as any)?.name ||
        user.email?.split('@')[0] ||
        'User';
      const country = (user.user_metadata as any)?.country || null;

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email || email.toLowerCase(),
            fullName,
            country,
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

  /**
   * Verify user email using verification token
   * @param verifyData - Verification token
   * @returns Verification response
   */
  async verifyEmail(verifyData: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    try {
      const { token } = verifyData;

      if (!token) {
        return {
          success: false,
          message: 'Verification token is required',
          error: 'Invalid token',
        };
      }

      // Find verification token in database
      const adminClient = supabaseAdmin || supabase;
      const { data: tokenData, error: tokenError } = await adminClient
        .from('email_verification_tokens')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .single();

      if (tokenError || !tokenData) {
        return {
          success: false,
          message: 'Invalid or expired verification token',
          error: 'Token not found',
        };
      }

      // Check if token has expired
      const now = new Date();
      const expiresAt = new Date(tokenData.expires_at);
      if (now > expiresAt) {
        return {
          success: false,
          message: 'Verification token has expired. Please request a new one.',
          error: 'Token expired',
        };
      }

      // Mark token as used
      await adminClient
        .from('email_verification_tokens')
        .update({ used: true })
        .eq('id', tokenData.id);

      // Verify email in Supabase Auth
      if (supabaseAdmin) {
        const { error: verifyError } = await supabaseAdmin.auth.admin.updateUserById(
          tokenData.user_id,
          { email_confirm: true }
        );

        if (verifyError) {
          return {
            success: false,
            message: verifyError.message || 'Failed to verify email',
            error: 'Verification failed',
          };
        }
      } else {
        // Fallback: user needs to verify via Supabase's own system
        // This shouldn't happen if admin client is configured
        return {
          success: false,
          message: 'Email verification service not properly configured',
          error: 'Configuration error',
        };
      }

      return {
        success: true,
        message: 'Email verified successfully! You can now log in.',
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
   * Get Google OAuth URL for sign-in
   * @returns OAuth URL to redirect user to
   */
  async getGoogleOAuthUrl(): Promise<GoogleOAuthResponse> {
    try {
      // Prioritize RENDER_URL for Render deployments, then BACKEND_URL, then localhost for development
      const baseUrl = process.env.RENDER_URL || process.env.BACKEND_URL || 'http://localhost:3000';
      const redirectUrl = `${baseUrl}/api/auth/google/callback`;

      console.log('=== Generating Google OAuth URL ===');
      console.log('Base URL (Site URL in Supabase Dashboard):', baseUrl);
      console.log('Redirect URL (must be in Redirect URLs list):', redirectUrl);
      console.log('Base URL from env:', { RENDER_URL: process.env.RENDER_URL, BACKEND_URL: process.env.BACKEND_URL });
      console.log('=== Supabase Dashboard Configuration Required ===');
      console.log('1. Site URL must be set to:', baseUrl);
      console.log('2. Redirect URLs must include:', redirectUrl);
      console.log('   Location: Supabase Dashboard → Authentication → URL Configuration');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        return {
          success: false,
          message: error.message || 'Failed to generate Google OAuth URL',
          error: 'OAuth error',
        };
      }

      return {
        success: true,
        message: 'Google OAuth URL generated successfully',
        data: {
          url: data.url,
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
   * Handle Google OAuth callback
   * @param code - OAuth authorization code from Google
   * @returns User data and tokens
   */
  async handleGoogleOAuthCallback(code: string): Promise<GoogleOAuthCallbackResponse> {
    try {
      // Exchange code for session
      const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

      if (sessionError || !sessionData.session || !sessionData.user) {
        return {
          success: false,
          message: sessionError?.message || 'Failed to authenticate with Google',
          error: 'OAuth callback error',
        };
      }

      const user = sessionData.user;
      const email = user.email;
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || email?.split('@')[0] || 'User';
      const country = user.user_metadata?.country || null;

      // Check if user profile exists in database
      const adminClient = supabaseAdmin || supabase;
      const { data: existingProfile } = await adminClient
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!existingProfile) {
        // Create user profile if it doesn't exist
        const { error: profileError } = await adminClient
          .from('users')
          .insert({
            id: user.id,
            email: email?.toLowerCase() || '',
            full_name: fullName,
            country: country,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (profileError) {
          console.error('Failed to create user profile:', profileError);
          // Continue anyway - user is authenticated
        }
      } else {
        // Update user profile if it exists
        await adminClient
          .from('users')
          .update({
            email: email?.toLowerCase() || existingProfile.email,
            full_name: fullName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      }

      // Get updated profile
      const { data: profileData } = await adminClient
        .from('users')
        .select('id, email, full_name, country')
        .eq('id', user.id)
        .single();

      return {
        success: true,
        message: 'Successfully signed in with Google',
        data: {
          user: {
            id: profileData?.id || user.id,
            email: profileData?.email || email || '',
            fullName: profileData?.full_name || fullName,
            country: profileData?.country || country,
          },
          accessToken: sessionData.session.access_token,
          refreshToken: sessionData.session.refresh_token,
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


