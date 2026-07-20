/**
 * User Service
 * Handles user profile operations
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import type {
  AddBeneficiaryResponse,
  BeneficiaryItem,
  GetBeneficiariesResponse,
  RemoveBeneficiaryResponse,
} from '../../types/api/beneficiary.types';
import { storageService } from '../storage/storage.service';
import { trustitagService } from '../trustitag.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      /** Unique handle for P2P XRP by Trustitag; assigned if missing */
      trustitag?: string;
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

      let trustitag: string | undefined;
      try {
        trustitag = await trustitagService.ensureTrustitagForUser(userId);
      } catch (e) {
        console.warn('[UserService] ensureTrustitagForUser failed in getUserProfile:', e);
      }

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
            ...(trustitag && { trustitag }),
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
          ...(trustitag && { trustitag }),
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
   * Update user's Trustitag handle.
   */
  async updateTrustitag(
    userId: string,
    rawTrustitag: unknown
  ): Promise<{
    success: boolean;
    message: string;
    data?: { trustitag: string };
    error?: string;
  }> {
    try {
      const normalized = trustitagService.normalizeTrustitag(String(rawTrustitag ?? ''));
      if (!normalized) {
        return {
          success: false,
          message: 'Invalid trustitag. Use 3-32 chars: lowercase letters, numbers, underscore.',
          error: 'Validation failed',
        };
      }

      const adminClient = supabaseAdmin || supabase;
      const { data: existingUser, error: existingUserError } = await adminClient
        .from('users')
        .select('id, trustitag')
        .eq('id', userId)
        .maybeSingle();

      if (existingUserError || !existingUser) {
        return {
          success: false,
          message: 'User not found',
          error: 'User not found',
        };
      }

      if (existingUser.trustitag === normalized) {
        return {
          success: true,
          message: 'Trustitag updated successfully',
          data: { trustitag: normalized },
        };
      }

      const { error: updateError } = await adminClient
        .from('users')
        .update({
          trustitag: normalized,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        if (updateError.code === '23505') {
          return {
            success: false,
            message: 'This trustitag is already taken',
            error: 'Trustitag already exists',
          };
        }

        return {
          success: false,
          message: updateError.message || 'Failed to update trustitag',
          error: updateError.message || 'Database error',
        };
      }

      return {
        success: true,
        message: 'Trustitag updated successfully',
        data: { trustitag: normalized },
      };
    } catch (error) {
      console.error('updateTrustitag error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update trustitag',
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
  async getBeneficiaries(userId: string): Promise<GetBeneficiariesResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      const { data: rows, error } = await adminClient
        .from('user_beneficiaries')
        .select(
          `
          id,
          trustitag,
          created_at,
          beneficiary:beneficiary_user_id (
            full_name,
            avatar_url
          )
        `
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          success: false,
          message: error.message || 'Failed to fetch beneficiaries',
          error: error.message,
        };
      }

      const beneficiaries: BeneficiaryItem[] = await Promise.all(
        (rows ?? []).map(async (row) => {
          const beneficiary = row.beneficiary as { full_name?: string; avatar_url?: string | null } | null;
          return {
            id: row.id,
            trustitag: row.trustitag,
            fullName: beneficiary?.full_name?.trim() || row.trustitag,
            avatarUrl: await resolveAvatarDisplayUrl(beneficiary?.avatar_url),
            createdAt: row.created_at,
          };
        })
      );

      return {
        success: true,
        message: 'Beneficiaries retrieved successfully',
        data: beneficiaries,
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

  /**
   * Save a beneficiary by Trustitag handle for quick P2P sends.
   */
  async addBeneficiary(userId: string, rawTrustitag: unknown): Promise<AddBeneficiaryResponse> {
    try {
      const adminClient = supabaseAdmin;
      if (!adminClient) {
        return {
          success: false,
          message: 'Adding a beneficiary requires server configuration (service role)',
          error: 'Service unavailable',
        };
      }

      const normalized = trustitagService.normalizeTrustitag(String(rawTrustitag ?? ''));
      if (!normalized) {
        return {
          success: false,
          message: 'Invalid trustitag. Use 3-32 chars: lowercase letters, numbers, underscore.',
          error: 'Validation failed',
        };
      }

      const { data: beneficiaryUser, error: userErr } = await adminClient
        .from('users')
        .select('id, full_name, avatar_url, trustitag')
        .eq('trustitag', normalized)
        .maybeSingle();

      if (userErr) {
        return {
          success: false,
          message: userErr.message || 'Failed to look up trustitag',
          error: userErr.message,
        };
      }

      if (!beneficiaryUser?.id) {
        return {
          success: false,
          message: 'No user found with this trustitag',
          error: 'Not found',
        };
      }

      if (beneficiaryUser.id === userId) {
        return {
          success: false,
          message: 'You cannot add yourself as a beneficiary',
          error: 'Validation failed',
        };
      }

      const { data: existing } = await adminClient
        .from('user_beneficiaries')
        .select('id, trustitag, created_at')
        .eq('user_id', userId)
        .eq('beneficiary_user_id', beneficiaryUser.id)
        .maybeSingle();

      if (existing) {
        return {
          success: true,
          message: 'Beneficiary already saved',
          data: {
            id: existing.id,
            trustitag: existing.trustitag,
            fullName: beneficiaryUser.full_name?.trim() || existing.trustitag,
            avatarUrl: await resolveAvatarDisplayUrl(beneficiaryUser.avatar_url),
            createdAt: existing.created_at,
          },
        };
      }

      const { data: inserted, error: insertErr } = await adminClient
        .from('user_beneficiaries')
        .insert({
          user_id: userId,
          beneficiary_user_id: beneficiaryUser.id,
          trustitag: normalized,
        })
        .select('id, trustitag, created_at')
        .single();

      if (insertErr) {
        if (insertErr.code === '23505') {
          const { data: again } = await adminClient
            .from('user_beneficiaries')
            .select('id, trustitag, created_at')
            .eq('user_id', userId)
            .eq('beneficiary_user_id', beneficiaryUser.id)
            .maybeSingle();
          if (again) {
            return {
              success: true,
              message: 'Beneficiary already saved',
              data: {
                id: again.id,
                trustitag: again.trustitag,
                fullName: beneficiaryUser.full_name?.trim() || again.trustitag,
                avatarUrl: await resolveAvatarDisplayUrl(beneficiaryUser.avatar_url),
                createdAt: again.created_at,
              },
            };
          }
        }
        if (insertErr.message?.toLowerCase().includes('user_beneficiaries')) {
          return {
            success: false,
            message: 'Beneficiaries are not available yet. Run migration 080_user_beneficiaries.sql.',
            error: 'Migration required',
          };
        }
        return {
          success: false,
          message: insertErr.message || 'Failed to add beneficiary',
          error: insertErr.message,
        };
      }

      return {
        success: true,
        message: 'Beneficiary added successfully',
        data: {
          id: inserted.id,
          trustitag: inserted.trustitag,
          fullName: beneficiaryUser.full_name?.trim() || inserted.trustitag,
          avatarUrl: await resolveAvatarDisplayUrl(beneficiaryUser.avatar_url),
          createdAt: inserted.created_at,
        },
      };
    } catch (error) {
      console.error('Error adding beneficiary:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add beneficiary',
        error: error instanceof Error ? error.message : 'Failed to add beneficiary',
      };
    }
  }

  /**
   * Permanently remove a saved beneficiary (Trustitag contact).
   * Accepts beneficiary row UUID or normalized trustitag handle.
   */
  async removeBeneficiary(userId: string, beneficiaryId: string): Promise<RemoveBeneficiaryResponse> {
    try {
      const adminClient = supabaseAdmin;
      if (!adminClient) {
        return {
          success: false,
          message: 'Removing a beneficiary requires server configuration (service role)',
          error: 'Service unavailable',
        };
      }

      const identifier = String(beneficiaryId || '').trim();
      if (!identifier) {
        return {
          success: false,
          message: 'beneficiaryId is required',
          error: 'Validation failed',
        };
      }

      let query = adminClient
        .from('user_beneficiaries')
        .select('id, trustitag')
        .eq('user_id', userId);

      if (UUID_RE.test(identifier)) {
        query = query.eq('id', identifier);
      } else {
        const normalized = trustitagService.normalizeTrustitag(identifier);
        if (!normalized) {
          return {
            success: false,
            message: 'Invalid beneficiary identifier',
            error: 'Validation failed',
          };
        }
        query = query.eq('trustitag', normalized);
      }

      const { data: row, error: fetchErr } = await query.maybeSingle();
      if (fetchErr) {
        return {
          success: false,
          message: fetchErr.message || 'Failed to remove beneficiary',
          error: fetchErr.message,
        };
      }
      if (!row) {
        return {
          success: false,
          message: 'Beneficiary not found',
          error: 'Not found',
        };
      }

      const { error: deleteErr } = await adminClient
        .from('user_beneficiaries')
        .delete()
        .eq('id', row.id)
        .eq('user_id', userId);

      if (deleteErr) {
        return {
          success: false,
          message: deleteErr.message || 'Failed to remove beneficiary',
          error: deleteErr.message,
        };
      }

      return {
        success: true,
        message: 'Beneficiary removed successfully',
        data: {
          id: row.id,
          trustitag: row.trustitag,
        },
      };
    } catch (error) {
      console.error('Error removing beneficiary:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to remove beneficiary',
        error: error instanceof Error ? error.message : 'Failed to remove beneficiary',
      };
    }
  }
}

export const userService = new UserService();