/**
 * Admin Dispute Resolution API Types
 * Used by admin Dispute Resolution: metrics, alerts, list, detail.
 */

export type AdminDisputeStatus = 'pending' | 'active' | 'resolved' | 'cancelled';

export interface AdminDisputeMetrics {
  totalDisputes: number;
  totalDisputesChangePercent?: number;
  activeDisputes: number;
  activeDisputesChangePercent?: number;
  resolvedDisputes: number;
  resolvedDisputesChangePercent?: number;
  averageResolutionTimeHours: number;
  averageResolutionTimeLabel: string; // e.g. "3hr"
}

export interface AdminDisputeMetricsResponse {
  success: boolean;
  message: string;
  data?: AdminDisputeMetrics;
  error?: string;
}

export interface AdminDisputeAlertItem {
  id: string;
  type: string; // e.g. 'new_evidence', 'dispute_created', 'dispute_resolved', 'new_comment', 'evidence_rejected'
  title: string;
  description: string;
  disputeId: string;
  caseId: string;
  createdAt: string;
  createdAtAgo: string;
}

export interface AdminDisputeAlertsResponse {
  success: boolean;
  message: string;
  data?: { alerts: AdminDisputeAlertItem[] };
  error?: string;
}

export interface AdminDisputeListItem {
  id: string;
  caseId: string;
  party1Name: string;
  party2Name: string;
  party1Id: string;
  party2Id: string;
  amountUsd: number;
  amountXrp: number;
  status: AdminDisputeStatus;
  statusLabel: string;
  openedAt: string;
  openedAtFormatted?: string;
  resolvedAt?: string | null;
  escrowId?: string | null;
}

export interface AdminDisputeListParams {
  search?: string;
  status?: AdminDisputeStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'opened_at' | 'resolved_at' | 'status' | 'amount_usd';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminDisputeListResponse {
  success: boolean;
  message: string;
  data?: {
    items: AdminDisputeListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

export interface AdminDisputeDetailResponse {
  success: boolean;
  message: string;
  data?: AdminDisputeDetail;
  error?: string;
}

export interface AdminDisputeDetail {
  id: string;
  caseId: string;
  party1: { id: string; name: string; email?: string };
  party2: { id: string; name: string; email?: string };
  amountUsd: number;
  amountXrp: number;
  status: AdminDisputeStatus;
  statusLabel: string;
  reason: string;
  description?: string | null;
  escrowId?: string | null;
  openedAt: string;
  resolvedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  mediatorUserId?: string | null;
  createdAt: string;
  updatedAt: string;
}
