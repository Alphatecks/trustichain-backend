import { Request, Response } from 'express';
import {
  GetNotificationsResponse,
  MarkReadResponse,
} from '../types/api/notification.types';
import { notificationService } from '../services/notification/notification.service';

export class NotificationController {
  /**
   * Get notifications for the authenticated user
   * GET /api/notifications
   */
  async getNotifications(req: Request, res: Response<GetNotificationsResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const filter = (req.query.filter as 'all' | 'unread' | undefined) || 'all';
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 10;

      const result = await notificationService.getNotifications({
        userId,
        filter,
        page,
        pageSize,
      });

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Mark a single notification as read
   * POST /api/notifications/:id/read
   */
  async markAsRead(req: Request, res: Response<MarkReadResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const id = req.params.id;

      const result = await notificationService.markAsRead(userId, id);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Register FCM device token for push notifications
   * POST /api/notifications/register-device
   * Body: { fcmToken: string, deviceId?: string, platform?: 'ios' | 'android' | 'web' }
   */
  async registerDevice(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { fcmToken, deviceId, platform } = req.body as {
        fcmToken?: string;
        deviceId?: string;
        platform?: 'ios' | 'android' | 'web';
      };

      const result = await notificationService.registerFcmToken({
        userId,
        fcmToken: fcmToken ?? '',
        deviceId,
        platform,
      });

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Mark all notifications as read
   * POST /api/notifications/read-all
   */
  async markAllAsRead(req: Request, res: Response<MarkReadResponse>): Promise<void> {
    try {
      const userId = req.userId!;
      const result = await notificationService.markAllAsRead(userId);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message,
        error: 'Internal server error',
      });
    }
  }
}

export const notificationController = new NotificationController();


