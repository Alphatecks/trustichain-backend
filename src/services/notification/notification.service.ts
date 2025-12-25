import { supabase, supabaseAdmin } from '../../config/supabase';
import {
  NotificationType,
  GetNotificationsResponse,
  MarkReadResponse,
} from '../../types/api/notification.types';

export class NotificationService {
  /**
   * Create a notification for a user
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


