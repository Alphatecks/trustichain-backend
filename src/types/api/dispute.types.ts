/**
 * Dispute API Types
 */

export type DisputeStatus = 'pending' | 'active' | 'resolved' | 'cancelled';
export type DisputeCategory = 'freelancing' | 'real_estate' | 'product_purchase' | 'custom';
export type DisputeReasonType = 'quality_issue' | 'delivery_delay' | 'payment_dispute';

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

export interface DisputeEvidenceItem {
  fileUrl: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
}

export interface CreateDisputeRequest {
  escrowId: string; // UUID of the escrow
  disputeCategory: DisputeCategory;
  disputeReasonType: DisputeReasonType;
  payerXrpWalletAddress: string;
  payerName?: string;
  payerEmail?: string;
  payerPhone?: string;
  respondentXrpWalletAddress: string;
  respondentName?: string;
  respondentEmail?: string;
  respondentPhone?: string;
  disputeReason: string;
  amount: number; // Amount in dispute
  currency: 'USD' | 'XRP';
  resolutionPeriod?: string; // e.g., "7 days"
  expectedResolutionDate?: string; // ISO date string
  description: string;
  evidence?: DisputeEvidenceItem[];
}

export interface CreateDisputeResponse {
  success: boolean;
  message: string;
  data?: {
    disputeId: string;
    caseId: string; // Formatted as #DSP-YYYY-XXX
  };
  error?: string;
}

export interface UploadEvidenceResponse {
  success: boolean;
  message: string;
  data?: {
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  };
  error?: string;
}

export type EvidenceType = 
  | 'original_agreement' 
  | 'final_deliverable' 
  | 'reference_images' 
  | 'work_progress_timeline' 
  | 'chat_screenshots' 
  | 'email_communications';

export interface EvidenceItem {
  id: string;
  disputeId: string;
  title: string;
  description: string;
  evidenceType: EvidenceType;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  verified: boolean;
  uploadedAt: string;
  uploadedByUserId: string;
}

export interface AddEvidenceRequest {
  title: string;
  description: string;
  evidenceType: EvidenceType;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface AddEvidenceResponse {
  success: boolean;
  message: string;
  data?: EvidenceItem;
  error?: string;
}

export interface GetEvidenceResponse {
  success: boolean;
  message: string;
  data?: {
    evidence: EvidenceItem[];
  };
  error?: string;
}

export interface UpdateEvidenceRequest {
  title?: string;
  description?: string;
  evidenceType?: EvidenceType;
}

export interface UpdateEvidenceResponse {
  success: boolean;
  message: string;
  data?: EvidenceItem;
  error?: string;
}

export interface DeleteEvidenceResponse {
  success: boolean;
  message: string;
  error?: string;
}


