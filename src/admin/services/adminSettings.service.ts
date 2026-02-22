/**
 * Admin Settings: profile, notification preferences, send push notification.
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import { sendFcmToTokens } from '../../services/fcm.service';
import type {
  AdminSettingsProfileResponse,
  AdminUpdateProfileRequest,
  AdminNotificationSettingsResponse,
  AdminUpdateNotificationSettingsRequest,
  AdminSendPushResponse,
} from '../../types/api/adminSettings.types';

export class AdminSettingsService {
  private getClient() {
    const client = supabaseAdmin || supabase;
    if (!supabaseAdmin) {
      console.warn('Admin settings using anon client; RLS may restrict.');
    }
    return client;
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
          avatarUrl: row.avatar_url ?? null,
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
}

export const adminSettingsService = new AdminSettingsService();
