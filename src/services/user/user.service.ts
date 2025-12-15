/**
 * User Service
 * Handles user profile operations
 */

import { supabase, supabaseAdmin } from '../../config/supabase';

export class UserService {
  /**
   * Get user profile including verification status
   */
  async getUserProfile(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      id: string;
      email: string;
      fullName: string;
      country: string | null;
      title?: string;
      verified: boolean;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get user from users table
      const { data: userData, error: userError } = await adminClient
        .from('users')
        .select('id, email, full_name, country')
        .eq('id', userId)
        .single();

      if (userError || !userData) {
        return {
          success: false,
          message: 'User not found',
          error: 'User not found',
        };
      }

      // Get auth user to check verification status
      const { data: authData, error: authError } = await supabaseAdmin?.auth.admin.getUserById(userId) || { data: null, error: null };

      if (authError && !authData) {
        // If we can't get auth data, assume not verified
        return {
          success: true,
          message: 'User profile retrieved successfully',
          data: {
            id: userData.id,
            email: userData.email,
            fullName: userData.full_name,
            country: userData.country,
            verified: false,
          },
        };
      }

      return {
        success: true,
        message: 'User profile retrieved successfully',
        data: {
          id: userData.id,
          email: userData.email,
          fullName: userData.full_name,
          country: userData.country,
          verified: authData?.user?.email_confirmed_at !== null,
        },
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch user profile',
        error: error instanceof Error ? error.message : 'Failed to fetch user profile',
      };
    }
  }

  /**
   * Get linked accounts for a user
   */
  async getLinkedAccounts(_userId: string): Promise<{
    success: boolean;
    message: string;
    data?: any[];
    error?: string;
  }> {
    try {
      // TODO: Implement linked accounts logic when database schema is ready
      // For now, return empty array
      // userId parameter reserved for future implementation
      return {
        success: true,
        message: 'Linked accounts retrieved successfully',
        data: [],
      };
    } catch (error) {
      console.error('Error fetching linked accounts:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch linked accounts',
        error: error instanceof Error ? error.message : 'Failed to fetch linked accounts',
      };
    }
  }

  /**
   * Get beneficiaries for a user
   */
  async getBeneficiaries(_userId: string): Promise<{
    success: boolean;
    message: string;
    data?: any[];
    error?: string;
  }> {
    try {
      // TODO: Implement beneficiaries logic when database schema is ready
      // For now, return empty array
      // userId parameter reserved for future implementation
      return {
        success: true,
        message: 'Beneficiaries retrieved successfully',
        data: [],
      };
    } catch (error) {
      console.error('Error fetching beneficiaries:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch beneficiaries',
        error: error instanceof Error ? error.message : 'Failed to fetch beneficiaries',
      };
    }
  }
}

export const userService = new UserService();






