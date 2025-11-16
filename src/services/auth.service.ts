import { supabase } from '../config/supabase';
import { RegisterRequest, RegisterResponse } from '../types/api/auth.types';

export class AuthService {
  /**
   * Register a new user
   * @param registerData - User registration data
   * @returns Registration response with user data or error
   */
  async register(registerData: RegisterRequest): Promise<RegisterResponse> {
    try {
      const { email, password, fullName, country } = registerData;

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

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password,
        options: {
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
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email.toLowerCase(),
          full_name: fullName,
          country: country,
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

      return {
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: profileData.id,
            email: profileData.email,
            fullName: profileData.full_name,
            country: profileData.country,
          },
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


