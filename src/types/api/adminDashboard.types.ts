/**
 * Admin Dashboard API Types
 * Used by admin panel: overview, escrow insight, dispute resolution, live feed, users, KYC, search, alerts.
 */

export interface AdminOverviewMetric {
  totalUsers: number;
  totalUsersChangePercent?: number;
  totalEscrows: number;
  totalEscrowsChangePercent?: number;
  totalTransactions: number;
  totalTransactionsChangePercent?: number;
  pendingActions: number;
  pendingActionsChangePercent?: number;
}

export interface AdminOverviewResponse {
  success: boolean;
  message: string;
  data?: AdminOverviewMetric;
  error?: string;
}

export interface AdminEscrowInsightItem {
  status: 'approved' | 'pending';
  count: number;
  percent: number;
}

export interface AdminEscrowInsightResponse {
  success: boolean;
  message: string;
  data?: {
    period: string;
    approvedCount: number;
    pendingCount: number;
    approvedPercent: number;
    pendingPercent: number;
    items: AdminEscrowInsightItem[];
  };
  error?: string;
}

export interface AdminDisputeResolutionMonth {
  month: string;
  label: string;
  resolvedCount: number;
}

export interface AdminDisputeResolutionResponse {
  success: boolean;
  message: string;
  data?: {
    period: string;
    totalDisputesResolved: number;
    byMonth: AdminDisputeResolutionMonth[];
  };
  error?: string;
}

export interface AdminLiveFeedItem {
  id: string;
  eventType: string;
  description: string;
  createdAt: string;
  createdAtAgo: string;
  userId?: string;
  relatedId?: string;
}

export interface AdminLiveTransactionsFeedResponse {
  success: boolean;
  message: string;
  data?: {
    items: AdminLiveFeedItem[];
    total?: number;
  };
  error?: string;
}

export type KycStatus = 'verified' | 'pending' | 'declined' | 'suspended';

export interface AdminUserOverviewItem {
  userId: string;
  fullName: string;
  email: string;
  accountType: string;
  kycStatus: KycStatus;
  totalVolumeUsd: number;
  lastActivityAt: string | null;
  lastActivityAgo?: string;
}

export interface AdminUserOverviewResponse {
  success: boolean;
  message: string;
  data?: {
    users: AdminUserOverviewItem[];
    total?: number;
  };
  error?: string;
}

export interface AdminKycListItem {
  userId: string;
  fullName: string;
  email: string;
  kycStatus: KycStatus;
  submittedAt?: string;
  reviewedAt?: string;
}

export interface AdminKycListResponse {
  success: boolean;
  message: string;
  data?: {
    items: AdminKycListItem[];
  };
  error?: string;
}

export interface AdminKycDetailResponse {
  success: boolean;
  message: string;
  data?: AdminKycListItem & {
    documents?: unknown[];
    companyLogoUrl?: string | null;
    companyName?: string | null;
    businessKycStatus?: string | null;
    businessSubmittedAt?: string | null;
    businessReviewedAt?: string | null;
  };
  error?: string;
}

export interface AdminKycApproveRequest {
  userId: string;
  status: 'verified' | 'declined' | 'suspended';
}

export interface AdminKycApproveResponse {
  success: boolean;
  message: string;
  data?: { kycStatus: KycStatus };
  error?: string;
}

export interface AdminSearchResult {
  type: 'user' | 'escrow' | 'transaction' | 'dispute';
  id: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
}

export interface AdminSearchResponse {
  success: boolean;
  message: string;
  data?: {
    results: AdminSearchResult[];
  };
  error?: string;
}

export interface AdminAlertItem {
  id: string;
  heading: string;
  subHeading?: string;
  actionUrl?: string;
  createdAt: string;
}

export interface AdminAlertsResponse {
  success: boolean;
  message: string;
  data?: {
    alerts: AdminAlertItem[];
  };
  error?: string;
}
