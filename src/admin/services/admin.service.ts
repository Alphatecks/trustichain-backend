import { supabase, supabaseAdmin } from '../../config/supabase';
import { AdminLoginRequest, AdminLoginResponse, AdminLogoutResponse } from '../../types/api/admin.types';

export class AdminService {
  // Static admin credentials
  private static readonly STATIC_ADMIN_EMAIL = 'admin@trustichain.com';
  private static readonly STATIC_ADMIN_PASSWORD = 'Trustichain02@';

  /**
   * Login an admin user
   * @param loginData - Admin login credentials
   * @returns Login response with admin data and tokens or error
   */
  async login(loginData: AdminLoginRequest): Promise<AdminLoginResponse> {
    try {
      const { email, password } = loginData;
      const normalizedEmail = email.toLowerCase();

      // Check static credentials first
      const isStaticAdmin = 
        normalizedEmail === AdminService.STATIC_ADMIN_EMAIL.toLowerCase() &&
        password === AdminService.STATIC_ADMIN_PASSWORD;

      // For static admin, authenticate directly without checking database first
      // For other admins, verify they exist in database first
      if (!isStaticAdmin) {
        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .select('id, email, full_name')
          .eq('email', normalizedEmail)
          .eq('is_active', true)
          .single();

        if (adminError || !adminData) {
          return {
            success: false,
            message: 'Invalid email or password',
            error: 'Authentication failed',
          };
        }
      }

      // Authenticate with Supabase Auth
      const LOGIN_TIMEOUT_MS = 8000; // 8 second timeout
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

      if (authError) {
        return {
          success: false,
          message: authError.message || 'Invalid email or password',
          error: 'Authentication failed',
        };
      }

      if (!authData?.user) {
        return {
          success: false,
          message: 'Failed to authenticate admin',
          error: 'No user data returned',
        };
      }

      // For static admin, ensure admin record exists (create if needed)
      let adminData;
      if (isStaticAdmin) {
        const { data: existingAdmin, error: adminError } = await supabase
          .from('admins')
          .select('id, email, full_name')
          .eq('id', authData.user.id)
          .eq('is_active', true)
          .single();

        if (adminError || !existingAdmin) {
          // Create admin record if it doesn't exist
          const adminClient = supabaseAdmin || supabase;
          const { data: newAdmin, error: insertError } = await adminClient
            .from('admins')
            .insert({
              id: authData.user.id,
              email: normalizedEmail,
              full_name: 'Admin User',
              is_active: true,
            })
            .select('id, email, full_name')
            .single();

          if (insertError || !newAdmin) {
            // Fallback: use auth user data
            adminData = {
              id: authData.user.id,
              email: normalizedEmail,
              full_name: 'Admin User',
            };
          } else {
            adminData = newAdmin;
          }
        } else {
          adminData = existingAdmin;
        }
      } else {
        // For non-static admins, verify admin record exists
        const { data: verifyAdmin, error: verifyError } = await supabase
          .from('admins')
          .select('id, email, full_name')
          .eq('id', authData.user.id)
          .eq('is_active', true)
          .single();

        if (verifyError || !verifyAdmin) {
          return {
            success: false,
            message: 'Access denied. Admin privileges required.',
            error: 'Unauthorized',
          };
        }
        adminData = verifyAdmin;
      }

      return {
        success: true,
        message: 'Admin login successful',
        data: {
          admin: {
            id: adminData.id,
            email: adminData.email,
            fullName: adminData.full_name,
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
   * Logout an admin user
   * @param accessToken - Admin's access token from Authorization header
   * @returns Logout response
   */
  async logout(accessToken: string): Promise<AdminLogoutResponse> {
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

      // Create a Supabase client with the admin's token to sign them out
      const { createClient } = await import('@supabase/supabase-js');
      const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

      // Sign out the admin session
      const { error } = await adminClient.auth.signOut();

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

export const adminService = new AdminService();
