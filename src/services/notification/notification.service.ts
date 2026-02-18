import { supabase, supabaseAdmin } from '../../config/supabase';
import {
  NotificationType,
  GetNotificationsResponse,
  MarkReadResponse,
} from '../../types/api/notification.types';
import { sendFcmToTokens } from '../fcm.service';

export class NotificationService {
  /**
   * Create a notification for a user (in-app) and send FCM push if user has registered tokens.
   */
  async createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const adminClient = supabaseAdmin || supabase;

    await adminClient.from('notifications').insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata || null,
    });

    // Send FCM push to user's registered device tokens
    try {
      const { data: rows } = await adminClient
        .from('user_fcm_tokens')
        .select('fcm_token')
        .eq('user_id', params.userId);
      const tokens = (rows || []).map((r: { fcm_token: string }) => r.fcm_token).filter(Boolean);
      if (tokens.length > 0) {
        const data: Record<string, string> = {
          type: params.type,
          ...(params.metadata && Object.keys(params.metadata).length
            ? { metadata: JSON.stringify(params.metadata) }
            : {}),
        };
        await sendFcmToTokens(tokens, {
          title: params.title,
          body: params.message,
          data,
        });
      }
    } catch (fcmError) {
      console.warn('FCM send failed (notification still created):', fcmError);
    }
  }

  /**
   * Register an FCM device token for the authenticated user (for push notifications).
   * Upserts by (user_id, fcm_token); same token updates updated_at and optional device_id/platform.
   */
  async registerFcmToken(params: {
    userId: string;
    fcmToken: string;
    deviceId?: string;
    platform?: 'ios' | 'android' | 'web';
  }): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const adminClient = supabaseAdmin || supabase;
      if (!params.fcmToken || typeof params.fcmToken !== 'string') {
        return { success: false, message: 'fcmToken is required', error: 'Invalid fcmToken' };
      }

      const { error } = await adminClient.from('user_fcm_tokens').upsert(
        {
          user_id: params.userId,
          fcm_token: params.fcmToken.trim(),
          device_id: params.deviceId || null,
          platform: params.platform || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,fcm_token' }
      );

      if (error) {
        console.error('Failed to register FCM token:', error);
        return {
          success: false,
          message: 'Failed to register device',
          error: error.message,
        };
      }
      return { success: true, message: 'Device registered for push notifications' };
    } catch (error) {
      console.error('Error registering FCM token:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to register device',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get notifications for the current user
   */
  async getNotifications(params: {
    userId: string;
    filter?: 'all' | 'unread';
    page?: number;
    pageSize?: number;
  }): Promise<GetNotificationsResponse> {
    try {
      const { userId, filter = 'all', page = 1, pageSize = 10 } = params;
      const adminClient = supabaseAdmin || supabase;

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = adminClient
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filter === 'unread') {
        query = query.eq('is_read', false);
      }

      const { data: rows, error } = await query;

      const { count: total } = await adminClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      const { count: unreadCount } = await adminClient
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch notifications',
          error: 'Failed to fetch notifications',
        };
      }

      const notifications =
        rows?.map((n: any) => ({
          id: n.id,
          type: n.type as NotificationType,
          title: n.title,
          message: n.message,
          isRead: n.is_read,
          createdAt: n.created_at,
          metadata: n.metadata || undefined,
        })) || [];

      return {
        success: true,
        message: 'Notifications retrieved successfully',
        data: {
          notifications,
          total: total || 0,
          unreadCount: unreadCount || 0,
        },
      };
    } catch (error) {
      console.error('Error getting notifications:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get notifications',
        error: error instanceof Error ? error.message : 'Failed to get notifications',
      };
    }
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<MarkReadResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      const { error } = await adminClient
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        return {
          success: false,
          message: 'Failed to mark notification as read',
          error: 'Failed to mark notification as read',
        };
      }

      return {
        success: true,
        message: 'Notification marked as read',
      };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to mark notification as read',
        error: error instanceof Error ? error.message : 'Failed to mark notification as read',
      };
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<MarkReadResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      const { error } = await adminClient
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        return {
          success: false,
          message: 'Failed to mark all notifications as read',
          error: 'Failed to mark all notifications as read',
        };
      }

      return {
        success: true,
        message: 'All notifications marked as read',
      };
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to mark all notifications as read',
        error: error instanceof Error ? error.message : 'Failed to mark all notifications as read',
      };
    }
  }
}

export const notificationService = new NotificationService();


