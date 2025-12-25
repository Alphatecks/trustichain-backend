export type NotificationType =
  | 'wallet_deposit'
  | 'wallet_withdrawal'
  | 'escrow_created'
  | 'escrow_completed'
  | 'escrow_cancelled'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'generic';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface GetNotificationsResponse {
  success: boolean;
  message: string;
  data?: {
    notifications: NotificationItem[];
    total: number;
    unreadCount: number;
  };
  error?: string;
}

export interface MarkReadResponse {
  success: boolean;
  message: string;
  error?: string;
}


