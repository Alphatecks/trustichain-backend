/**
 * Admin Settings: profile, notification preferences, send push notification.
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import { sendFcmToTokens } from '../../services/fcm.service';
import { storageService } from '../../services/storage/storage.service';
import type {
  AdminSettingsProfileResponse,
  AdminUpdateProfileRequest,
  AdminNotificationSettingsResponse,
  AdminUpdateNotificationSettingsRequest,
  AdminSendPushResponse,
  AdminEscrowFeeSettingsResponse,
  AdminUpdateEscrowFeeSettingsRequest,
} from '../../types/api/adminSettings.types';

export class AdminSettingsService {
  private normalizeFeePercentage(raw: unknown): number | null {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return parseFloat(n.toFixed(4));
  }

  private getClient() {
    const client = supabaseAdmin || supabase;
    if (!supabaseAdmin) {
      console.warn('Admin settings using anon client; RLS may restrict.');
    }
    return client;
  }

  private async resolveAvatarUrl(stored: string | null | undefined): Promise<string | null> {
    if (stored == null || !String(stored).trim()) return null;
    const trimmed = String(stored).trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return storageService.getSignedUrlForUserProfilePhoto(trimmed);
  }

  /**
   * Get current admin profile (full name, email, avatar, notification prefs).
   */
  async getProfile(adminId: string): Promise<AdminSettingsProfileResponse> {
    try {
      const client = this.getClient();
      const { data: row, error } = await client
        .from('admins')
        .select('full_name, email, avatar_url, email_notifications_enabled, push_notifications_enabled')
        .eq('id', adminId)
        .eq('is_active', true)
        .single();
      if (error || !row) {
        return {
          success: false,
          message: error?.message || 'Profile not found',
          error: error?.message || 'Not found',
        };
      }
      return {
        success: true,
        message: 'Profile retrieved',
        data: {
          fullName: row.full_name || '',
          email: row.email || '',
          avatarUrl: await this.resolveAvatarUrl(row.avatar_url ?? null),
          emailNotificationsEnabled: row.email_notifications_enabled !== false,
          pushNotificationsEnabled: row.push_notifications_enabled !== false,
        },
      };
    } catch (e) {
      console.error('Admin settings getProfile error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get profile',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Update admin profile (full name, email).
   */
  async updateProfile(adminId: string, body: AdminUpdateProfileRequest): Promise<AdminSettingsProfileResponse> {
    try {
      const client = this.getClient();
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.fullName !== undefined) updates.full_name = body.fullName.trim();
      if (body.email !== undefined) updates.email = body.email.trim().toLowerCase();
      if (Object.keys(updates).length <= 1) {
        return this.getProfile(adminId);
      }
      const { error } = await client.from('admins').update(updates).eq('id', adminId);
      if (error) {
        return { success: false, message: error.message, error: error.message };
      }
      return this.getProfile(adminId);
    } catch (e) {
      console.error('Admin settings updateProfile error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to update profile',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Set profile photo URL (frontend uploads to storage and sends URL).
   */
  async updateProfilePhoto(adminId: string, avatarUrl: string): Promise<AdminSettingsProfileResponse> {
    try {
      const client = this.getClient();
      const url = (avatarUrl || '').trim();
      if (!url) {
        return { success: false, message: 'avatarUrl is required', error: 'Bad request' };
      }
      const { error } = await client
        .from('admins')
        .update({ avatar_url: url, updated_at: new Date().toISOString() })
        .eq('id', adminId);
      if (error) {
        return { success: false, message: error.message, error: error.message };
      }
      return this.getProfile(adminId);
    } catch (e) {
      console.error('Admin settings updateProfilePhoto error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to update photo',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Upload admin profile photo (multipart image) and update avatar_url.
   */
  async uploadProfilePhoto(
    adminId: string,
    file: Express.Multer.File
  ): Promise<AdminSettingsProfileResponse> {
    try {
      const upload = await storageService.uploadUserProfilePhoto(adminId, file);
      if (!upload.success || !upload.data?.fileUrl) {
        return {
          success: false,
          message: upload.message || 'Upload failed',
          error: upload.error || 'Upload failed',
        };
      }

      const client = this.getClient();
      const storedRef = upload.data.fileUrl;
      const { error } = await client
        .from('admins')
        .update({ avatar_url: storedRef, updated_at: new Date().toISOString() })
        .eq('id', adminId);
      if (error) {
        return {
          success: false,
          message: error.message || 'Failed to save profile photo',
          error: error.message || 'Database error',
        };
      }

      return this.getProfile(adminId);
    } catch (e) {
      console.error('Admin settings uploadProfilePhoto error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to upload profile photo',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Remove profile photo.
   */
  async removeProfilePhoto(adminId: string): Promise<AdminSettingsProfileResponse> {
    try {
      const client = this.getClient();
      const { error } = await client
        .from('admins')
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq('id', adminId);
      if (error) {
        return { success: false, message: error.message, error: error.message };
      }
      return this.getProfile(adminId);
    } catch (e) {
      console.error('Admin settings removeProfilePhoto error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to remove photo',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Get notification preferences.
   */
  async getNotificationSettings(adminId: string): Promise<AdminNotificationSettingsResponse> {
    try {
      const client = this.getClient();
      const { data: row, error } = await client
        .from('admins')
        .select('email_notifications_enabled, push_notifications_enabled')
        .eq('id', adminId)
        .single();
      if (error || !row) {
        return {
          success: false,
          message: error?.message || 'Not found',
          error: error?.message || 'Not found',
        };
      }
      return {
        success: true,
        message: 'Notification settings retrieved',
        data: {
          emailNotificationsEnabled: row.email_notifications_enabled !== false,
          pushNotificationsEnabled: row.push_notifications_enabled !== false,
        },
      };
    } catch (e) {
      console.error('Admin settings getNotificationSettings error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get settings',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Update notification preferences.
   */
  async updateNotificationSettings(
    adminId: string,
    body: AdminUpdateNotificationSettingsRequest
  ): Promise<AdminNotificationSettingsResponse> {
    try {
      const client = this.getClient();
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof body.emailNotifications === 'boolean') updates.email_notifications_enabled = body.emailNotifications;
      if (typeof body.pushNotifications === 'boolean') updates.push_notifications_enabled = body.pushNotifications;
      if (Object.keys(updates).length <= 1) {
        return this.getNotificationSettings(adminId);
      }
      const { error } = await client.from('admins').update(updates).eq('id', adminId);
      if (error) {
        return { success: false, message: error.message, error: error.message };
      }
      return this.getNotificationSettings(adminId);
    } catch (e) {
      console.error('Admin settings updateNotificationSettings error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to update settings',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Send push notification to app users. sendTo: 'all' sends to all registered FCM tokens.
   */
  async sendPushNotification(
    title: string,
    message: string,
    sendTo: 'all'
  ): Promise<AdminSendPushResponse> {
    try {
      if (!title?.trim() || !message?.trim()) {
        return {
          success: false,
          message: 'title and message are required',
          error: 'Bad request',
        };
      }
      const client = this.getClient();
      if (sendTo !== 'all') {
        return {
          success: false,
          message: 'sendTo must be "all"',
          error: 'Bad request',
        };
      }
      const { data: rows } = await client.from('user_fcm_tokens').select('fcm_token');
      const tokens = (rows || []).map((r: { fcm_token: string }) => r.fcm_token).filter(Boolean);
      if (tokens.length === 0) {
        return {
          success: true,
          message: 'No device tokens registered; nothing sent',
          data: { sentCount: 0, failureCount: 0 },
        };
      }
      const { success, failure } = await sendFcmToTokens(tokens, {
        title: title.trim(),
        body: message.trim(),
        data: { type: 'admin_broadcast' },
      });
      return {
        success: true,
        message: `Push sent to ${success} device(s)${failure > 0 ? `; ${failure} failed` : ''}`,
        data: { sentCount: success, failureCount: failure },
      };
    } catch (e) {
      console.error('Admin settings sendPushNotification error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to send push notification',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Get escrow creation fee settings used by admin fee configuration UI.
   */
  async getEscrowFeeSettings(): Promise<AdminEscrowFeeSettingsResponse> {
    try {
      const client = this.getClient();
      const { data: row, error } = await client
        .from('platform_escrow_fee_settings')
        .select('personal_freelancer_fee_percentage, supplier_fee_percentage, payroll_fee_percentage, updated_at')
        .eq('id', 'default')
        .maybeSingle();

      if (error) {
        return {
          success: false,
          message: error.message || 'Failed to fetch escrow fee settings',
          error: error.message || 'Failed to fetch escrow fee settings',
        };
      }

      if (!row) {
        return {
          success: true,
          message: 'Escrow fee settings retrieved',
          data: {
            personalFreelancerEscrowFeePercentage: 0,
            supplierEscrowFeePercentage: 0,
            payrollEscrowFeePercentage: 0,
          },
        };
      }

      return {
        success: true,
        message: 'Escrow fee settings retrieved',
        data: {
          personalFreelancerEscrowFeePercentage: Number(row.personal_freelancer_fee_percentage) || 0,
          supplierEscrowFeePercentage: Number(row.supplier_fee_percentage) || 0,
          payrollEscrowFeePercentage: Number(row.payroll_fee_percentage) || 0,
          updatedAt: row.updated_at || undefined,
        },
      };
    } catch (e) {
      console.error('Admin settings getEscrowFeeSettings error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to fetch escrow fee settings',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Update escrow creation fee settings (percentage values).
   */
  async updateEscrowFeeSettings(
    adminId: string,
    body: AdminUpdateEscrowFeeSettingsRequest
  ): Promise<AdminEscrowFeeSettingsResponse> {
    try {
      const personalFee = this.normalizeFeePercentage(body.personalFreelancerEscrowFeePercentage);
      const supplierFee = this.normalizeFeePercentage(body.supplierEscrowFeePercentage);
      const payrollFee = this.normalizeFeePercentage(body.payrollEscrowFeePercentage);

      if (personalFee == null || supplierFee == null || payrollFee == null) {
        return {
          success: false,
          message: 'All fee percentages must be valid numbers between 0 and 100',
          error: 'Validation error',
        };
      }

      const client = this.getClient();
      const { error } = await client
        .from('platform_escrow_fee_settings')
        .upsert({
          id: 'default',
          personal_freelancer_fee_percentage: personalFee,
          supplier_fee_percentage: supplierFee,
          payroll_fee_percentage: payrollFee,
          updated_by: adminId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) {
        return {
          success: false,
          message: error.message || 'Failed to update escrow fee settings',
          error: error.message || 'Failed to update escrow fee settings',
        };
      }

      return this.getEscrowFeeSettings();
    } catch (e) {
      console.error('Admin settings updateEscrowFeeSettings error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to update escrow fee settings',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }
}

export const adminSettingsService = new AdminSettingsService();
