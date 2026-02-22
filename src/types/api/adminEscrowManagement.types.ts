/**
 * Admin Escrow Management API Types
 * Used by admin Escrow Management: stats, list, detail, update status.
 */

export type AdminEscrowStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'disputed';

export interface AdminEscrowManagementStats {
  totalAmountUsd: number;
  totalAmountUsdChangePercent?: number;
  totalEscrowCount: number;
  totalEscrowCountChangePercent?: number;
  completedCount: number;
  completedCountChangePercent?: number;
  disputedCount: number;
  disputedCountChangePercent?: number;
  /** Platform escrow fee balance (XRP) from 10% of each escrow creation; withdrawable by admin */
  escrowFeesBalanceXrp: number;
}

export interface AdminEscrowManagementStatsResponse {
  success: boolean;
  message: string;
  data?: AdminEscrowManagementStats;
  error?: string;
}

export interface AdminEscrowListItem {
  id: string;
  escrowId: string; // e.g. ESC-2425-001 or #ESC-2425-001
  party1Name: string;
  party2Name: string;
  party1Id: string;
  party2Id: string | null;
  amountUsd: number;
  amountXrp: number;
  status: AdminEscrowStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminEscrowListParams {
  search?: string;
  status?: AdminEscrowStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'amount_usd' | 'status' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminEscrowListResponse {
  success: boolean;
  message: string;
  data?: {
    items: AdminEscrowListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

export interface AdminEscrowDetailResponse {
  success: boolean;
  message: string;
  data?: AdminEscrowDetail;
  error?: string;
}

export interface AdminEscrowDetail {
  id: string;
  escrowId: string;
  party1: { id: string; name: string; email?: string };
  party2: { id: string | null; name: string; email?: string } | null;
  amountUsd: number;
  amountXrp: number;
  status: AdminEscrowStatus;
  description?: string;
  transactionType?: string;
  industry?: string;
  progress?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  xrplEscrowId?: string;
  releaseType?: string;
  expectedCompletionDate?: string;
  expectedReleaseDate?: string;
}

export interface AdminEscrowUpdateStatusRequest {
  status: AdminEscrowStatus;
}

export interface AdminEscrowUpdateStatusResponse {
  success: boolean;
  message: string;
  data?: { status: AdminEscrowStatus };
  error?: string;
}

export interface AdminEscrowFeesBalanceResponse {
  success: boolean;
  message: string;
  data?: { balance_xrp: number };
  error?: string;
}

export interface AdminEscrowFeesWithdrawRequest {
  amountUsd: number;
  destinationXrplAddress: string;
}

export interface AdminEscrowFeesWithdrawResponse {
  success: boolean;
  message: string;
  data?: { withdrawalId: string; amountUsd: number; amountXrp: number; status: string; xrplTxHash?: string };
  error?: string;
}
