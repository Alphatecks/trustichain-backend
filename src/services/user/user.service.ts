/**
 * User Service
 * Handles user profile operations
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import { storageService } from '../storage/storage.service';

/** Stored avatar: our bucket ref, or external https URL (e.g. Google profile photo). */
async function resolveAvatarDisplayUrl(stored: string | null | undefined): Promise<string | null> {
  if (stored == null || !String(stored).trim()) return null;
  const t = String(stored).trim();
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  return storageService.getSignedUrlForUserProfilePhoto(stored);
}

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
      /** Google Authenticator / TOTP MFA enabled (from users.mfa_enabled). */
      mfaEnabled: boolean;
      /** Time-limited URL for displaying the profile photo (private storage bucket). */
      avatarUrl: string | null;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get user from users table
      const { data: userData, error: userError } = await adminClient
        .from('users')
        .select('id, email, full_name, country, avatar_url, mfa_enabled')
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

      const avatarUrl = await resolveAvatarDisplayUrl(
        (userData as { avatar_url?: string | null }).avatar_url ?? null
      );

      const mfaEnabled = (userData as { mfa_enabled?: boolean }).mfa_enabled === true;

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
            mfaEnabled,
            avatarUrl,
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
          mfaEnabled,
          avatarUrl,
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
   * Upload profile picture (multipart image). Updates users.avatar_url with storage reference.
   */
  async uploadProfilePhoto(
    userId: string,
    file: Express.Multer.File
  ): Promise<{
    success: boolean;
    message: string;
    data?: { avatarUrl: string };
    error?: string;
  }> {
    try {
      const upload = await storageService.uploadUserProfilePhoto(userId, file);
      if (!upload.success || !upload.data?.fileUrl) {
        return {
          success: false,
          message: upload.message || 'Upload failed',
          error: upload.error || 'Upload failed',
        };
      }

      const adminClient = supabaseAdmin || supabase;
      const storedRef = upload.data.fileUrl;
      const { error: updateError } = await adminClient
        .from('users')
        .update({
          avatar_url: storedRef,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        console.error('uploadProfilePhoto: failed to update users.avatar_url', updateError);
        return {
          success: false,
          message: updateError.message || 'Failed to save profile photo',
          error: updateError.message || 'Database error',
        };
      }

      const displayUrl = await storageService.getSignedUrlForUserProfilePhoto(storedRef);
      return {
        success: true,
        message: 'Profile photo updated',
        data: { avatarUrl: displayUrl || storedRef },
      };
    } catch (error) {
      console.error('uploadProfilePhoto error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to upload profile photo',
        error: error instanceof Error ? error.message : 'Unknown error',
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