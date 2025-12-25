import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { notificationController } from '../controllers/notification.controller';

const router = Router();

/**
 * @route   GET /api/notifications
 * @desc    Get notifications for current user
 * @access  Private
 * @query   filter?   - all | unread (default: all)
 * @query   page?     - Page number (default: 1)
 * @query   pageSize? - Page size (default: 10)
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    await notificationController.getNotifications(req, res);
  })
);

/**
 * @route   POST /api/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.post(
  '/:id/read',
  authenticate,
  asyncHandler(async (req, res) => {
    await notificationController.markAsRead(req, res);
  })
);

/**
 * @route   POST /api/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.post(
  '/read-all',
  authenticate,
  asyncHandler(async (req, res) => {
    await notificationController.markAllAsRead(req, res);
  })
);

export default router;


