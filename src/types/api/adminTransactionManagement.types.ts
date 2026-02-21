/**
 * Admin Transaction Management API Types
 * Used by admin Transaction dashboard: overview stats, list, detail.
 */

export type AdminTransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type AdminTransactionType = 'deposit' | 'withdrawal' | 'escrow_create' | 'escrow_release' | 'escrow_cancel' | 'transfer' | 'swap';

export interface AdminTransactionOverviewStats {
  totalTransactionCount: number;
  totalTransactionCountChangePercent?: number;
  totalAmountUsd: number;
  totalAmountUsdChangePercent?: number;
  escrowedAmountUsd: number;
  escrowedAmountUsdChangePercent?: number;
  payrollAmountUsd: number;
  payrollAmountUsdChangePercent?: number;
}

export interface AdminTransactionOverviewResponse {
  success: boolean;
  message: string;
  data?: AdminTransactionOverviewStats;
  error?: string;
}

export interface AdminTransactionListItem {
  id: string;
  transactionId: string; // short display id, e.g. first 18 chars of id or formatted
  type: AdminTransactionType;
  typeLabel: string;
  userId: string;
  userName: string;
  amountUsd: number;
  amountXrp: number;
  status: AdminTransactionStatus;
  statusLabel: string;
  currency: string; // 'USD' | 'XRP' - display currency
  createdAt: string;
  createdAtAgo?: string;
  escrowId?: string | null;
}

export type AdminTransactionAccountTypeFilter = 'personal' | 'business_suite' | undefined;

export interface AdminTransactionListParams {
  search?: string;
  accountType?: AdminTransactionAccountTypeFilter;
  status?: AdminTransactionStatus;
  type?: AdminTransactionType;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'amount_usd' | 'status' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminTransactionListResponse {
  success: boolean;
  message: string;
  data?: {
    items: AdminTransactionListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

export interface AdminTransactionDetailResponse {
  success: boolean;
  message: string;
  data?: AdminTransactionDetail;
  error?: string;
}

export interface AdminTransactionDetail {
  id: string;
  transactionId: string;
  type: AdminTransactionType;
  typeLabel: string;
  userId: string;
  userName: string;
  userEmail?: string;
  amountUsd: number;
  amountXrp: number;
  status: AdminTransactionStatus;
  statusLabel: string;
  currency: string;
  description?: string | null;
  xrplTxHash?: string | null;
  escrowId?: string | null;
  createdAt: string;
  createdAtAgo?: string;
}
