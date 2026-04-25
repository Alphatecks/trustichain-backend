export type NotificationType =
  | 'wallet_deposit'
  | 'wallet_withdrawal'
  | 'wallet_swap'
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
  /** Structured payload (amounts, ids, tx hashes, etc.); same data as `metadata`, preferred name. */
  details?: Record<string, any>;
  /** @deprecated Use `details`; kept for clients that still read `metadata`. */
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


