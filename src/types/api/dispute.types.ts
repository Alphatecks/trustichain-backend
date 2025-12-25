/**
 * Dispute API Types
 */

export type DisputeStatus = 'pending' | 'active' | 'resolved' | 'cancelled';

export interface DisputeSummaryMetrics {
  totalDisputes: number;
  activeDisputes: number;
  resolvedDisputes: number;
  avgResolutionTimeSeconds: number;
  // Percentage change vs previous period (optional for UI trends)
  totalChangePercent?: number;
  activeChangePercent?: number;
  resolvedChangePercent?: number;
  avgResolutionTimeChangePercent?: number;
}

export interface GetDisputeSummaryResponse {
  success: boolean;
  message: string;
  data?: {
    metrics: DisputeSummaryMetrics;
  };
  error?: string;
}

export interface DisputeListItem {
  id: string;
  caseId: string; // Formatted as #DSP-YYYY-XXX
  initiatorName: string;
  respondentName: string;
  amount: {
    xrp: number;
    usd: number;
  };
  status: DisputeStatus;
  reason: string;
  openedAt: string;
  resolvedAt?: string;
  durationSeconds: number; // For UI to format as "1.5 days"
}

export interface GetDisputesResponse {
  success: boolean;
  message: string;
  data?: {
    disputes: DisputeListItem[];
    total: number;
  };
  error?: string;
}

export interface DisputeDetail extends DisputeListItem {
  description?: string;
  cancelReason?: string;
  escrowId?: string;
}

export interface GetDisputeDetailResponse {
  success: boolean;
  message: string;
  data?: DisputeDetail;
  error?: string;
}


