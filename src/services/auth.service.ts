import { supabase, supabaseAdmin } from '../config/supabase';
import { RegisterRequest, RegisterResponse, LoginRequest, LoginResponse, VerifyEmailRequest, VerifyEmailResponse, GoogleOAuthResponse, GoogleOAuthCallbackResponse, LogoutResponse } from '../types/api/auth.types';
import { emailService } from './email.service';
import * as crypto from 'crypto';

export class AuthService {
  /**
   * Forgot Password - generate OTP and send via Resend
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const normalizedEmail = email.toLowerCase();
      // Check if user exists
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('email', normalizedEmail)
        .single();
      if (userError || !user) {
        return { success: false, message: 'No account found with that email.', error: 'User not found' };
      }
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min expiry
      // Store OTP in password_reset_tokens
      const { error: insertError } = await supabase
        .from('password_reset_tokens')
        .insert({
          user_id: user.id,
          email: normalizedEmail,
          otp,
          expires_at: expiresAt.toISOString(),
          used: false,
        });
      if (insertError) {
        return { success: false, message: 'Failed to generate OTP.', error: insertError.message };
      }
      // Send OTP via Resend
      const emailResult = await emailService.sendPasswordResetOTP(normalizedEmail, otp, user.full_name || 'User');
      if (!emailResult.success) {
        return { success: false, message: 'Failed to send OTP email.', error: emailResult.error };
      }
      return { success: true, message: 'OTP sent to your email.' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { success: false, message: errorMessage, error: 'Internal server error' };
    }
  }

  /**
   * Reset Password - verify OTP and set new password
   */
  async resetPassword(email: string, otp: string, newPassword: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const normalizedEmail = email.toLowerCase();
      // Find valid OTP
      const { data: token, error: tokenError } = await supabase
        .from('password_reset_tokens')
        .select('id, user_id, expires_at, used')
        .eq('email', normalizedEmail)
        .eq('otp', otp)
        .eq('used', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (tokenError || !token) {
        return { success: false, message: 'Invalid or expired OTP.', error: 'OTP not found' };
      }
      if (new Date(token.expires_at) < new Date()) {
        return { success: false, message: 'OTP has expired.', error: 'OTP expired' };
      }
      // Update password in Supabase Auth
      if (!supabaseAdmin) {
        return { success: false, message: 'Password reset not supported in this environment.', error: 'No admin client' };
      }
      // Get user email from users table
      const { data: user } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', token.user_id)
        .single();
      if (!user) {
        return { success: false, message: 'User not found.', error: 'User not found' };
      }
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(token.user_id, { password: newPassword });
      if (updateError) {
        return { success: false, message: 'Failed to reset password.', error: updateError.message };
      }
      // Mark OTP as used
      await supabase
        .from('password_reset_tokens')
        .update({ used: true })
        .eq('id', token.id);
      return { success: true, message: 'Password reset successful. You can now log in.' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { success: false, message: errorMessage, error: 'Internal server error' };
    }
  }
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
      const normalizedEmail = email.toLowerCase();

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'H1',
          location: 'src/services/auth.service.ts:195',
          message: 'login_start',
          data: { email: normalizedEmail },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      // Attempt to sign in with timeout to fail fast if Supabase is slow
      const LOGIN_TIMEOUT_MS = 8000; // 8 second timeout
      const loginStartTime = Date.now();
      const loginPromise = supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: password,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Login request timed out. Please try again.')), LOGIN_TIMEOUT_MS);
      });

      const { data: authData, error: authError } = await Promise.race([
        loginPromise,
        timeoutPromise,
      ]);

      const loginDurationMs = Date.now() - loginStartTime;

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'H1',
          location: 'src/services/auth.service.ts:207',
          message: 'login_supabase_completed',
          data: {
            email: normalizedEmail,
            durationMs: loginDurationMs,
            hasUser: !!authData?.user,
            hasError: !!authError,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      if (authError) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'pre-fix',
            hypothesisId: 'H2',
            location: 'src/services/auth.service.ts:210',
            message: 'login_auth_error',
            data: {
              email: normalizedEmail,
              errorMessage: authError.message,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        return {
          success: false,
          message: authError.message || 'Invalid email or password',
          error: 'Authentication failed',
        };
      }

      if (!authData?.user) {
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
      const userMetadata = user.user_metadata as any;
      const fullName = userMetadata?.full_name || userMetadata?.name || user.email?.split('@')[0] || 'User';
      const country = userMetadata?.country || null;
      const userEmail = user.email || normalizedEmail;

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'H3',
          location: 'src/services/auth.service.ts:244',
          message: 'login_success',
          data: {
            email: userEmail,
            fullName,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: userEmail,
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
      // Backend base URL (where this API runs). Supabase must redirect here so our /auth/oauth-callback page can read the hash.
      const baseUrl = (process.env.RENDER_URL || process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
      const redirectUrl = `${baseUrl}/auth/oauth-callback`;

      console.log('=== Generating Google OAuth URL ===');
      console.log('Redirect URL (add this to Supabase Redirect URLs):', redirectUrl);
      console.log('Env:', { RENDER_URL: process.env.RENDER_URL, BACKEND_URL: process.env.BACKEND_URL });
      console.log('=== Supabase Dashboard Configuration Required ===');
      console.log('1. Redirect URLs must include:', redirectUrl);
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

  /**
   * Handle Google OAuth callback when Supabase returns tokens in the hash (forwarded as query by intermediary page).
   * Uses setSession then runs the same user profile logic as handleGoogleOAuthCallback.
   */
  async handleGoogleOAuthCallbackWithTokens(access_token: string, refresh_token: string): Promise<GoogleOAuthCallbackResponse> {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError || !sessionData.session || !sessionData.user) {
        return {
          success: false,
          message: sessionError?.message || 'Failed to set session from tokens',
          error: 'OAuth callback error',
        };
      }

      const user = sessionData.user;
      const email = user.email;
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || email?.split('@')[0] || 'User';
      const country = user.user_metadata?.country || null;

      const adminClient = supabaseAdmin || supabase;
      const { data: existingProfile } = await adminClient
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!existingProfile) {
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
        }
      } else {
        await adminClient
          .from('users')
          .update({
            email: email?.toLowerCase() || existingProfile.email,
            full_name: fullName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);
      }

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

  /**
   * Logout a user
   * @param accessToken - User's access token from Authorization header
   * @returns Logout response
   */
  async logout(accessToken: string): Promise<LogoutResponse> {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        return {
          success: false,
          message: 'Server configuration error',
          error: 'Missing Supabase configuration',
        };
      }

      // Create a Supabase client with the user's token to sign them out
      const { createClient } = await import('@supabase/supabase-js');
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

      // Sign out the user session
      const { error } = await userClient.auth.signOut();

      if (error) {
        return {
          success: false,
          message: 'Failed to logout',
          error: error.message,
        };
      }

      return {
        success: true,
        message: 'Logged out successfully',
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


