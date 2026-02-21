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

// --- Dispute Chat Details Screen ---

export interface AdminDisputePartyCard {
  id: string;
  name: string;
  email?: string;
  role: 'buyer' | 'seller'; // party1 = buyer/initiator, party2 = seller/respondent
  claims: string; // reason or description
}

export interface AdminDisputeMediatorInfo {
  userId: string | null;
  name: string | null;
  email?: string | null;
  status: 'active' | 'inactive'; // active if assigned and dispute active
}

export interface AdminDisputeEvidenceItem {
  id: string;
  title: string;
  description: string;
  evidenceType: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  verified: boolean;
  uploadedAt: string;
  uploadedByUserId?: string;
}

export interface AdminDisputeTimelineEvent {
  id: string;
  eventType: string;
  title: string;
  description?: string | null;
  eventTimestamp: string;
  createdAt: string;
  createdByName?: string;
}

export interface AdminDisputeVerdictInfo {
  status: string; // pending, decision_pending, decision_made, under_review
  finalVerdict?: string | null;
  decisionSummary?: string | null;
  decisionOutcome?: string | null;
  decisionDate?: string | null;
}

export interface AdminDisputeAssessmentFinding {
  id: string;
  findingText: string;
  findingType?: string;
  orderIndex: number;
}

export interface AdminDisputePreliminaryAssessment {
  id: string;
  title: string;
  summary?: string | null;
  status: string;
  findings: AdminDisputeAssessmentFinding[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminDisputeChatMessage {
  id: string;
  senderUserId: string;
  senderName: string;
  senderRole: string; // initiator, respondent, mediator, admin
  messageText: string;
  createdAt: string;
}

export interface AdminDisputeDetailScreenResponse {
  success: boolean;
  message: string;
  data?: {
    dispute: AdminDisputeDetail & { party1Claims: string; party2Claims: string };
    party1: AdminDisputePartyCard;
    party2: AdminDisputePartyCard;
    mediator: AdminDisputeMediatorInfo;
    evidence: AdminDisputeEvidenceItem[];
    timeline: AdminDisputeTimelineEvent[];
    verdict: AdminDisputeVerdictInfo;
    preliminaryAssessment: AdminDisputePreliminaryAssessment | null;
    messages: AdminDisputeChatMessage[];
  };
  error?: string;
}

export interface AdminAssignMediatorRequest {
  mediatorUserId: string;
}

export interface AdminAssignMediatorResponse {
  success: boolean;
  message: string;
  data?: { mediatorUserId: string };
  error?: string;
}

export interface AdminDisputeEvidenceListResponse {
  success: boolean;
  message: string;
  data?: { evidence: AdminDisputeEvidenceItem[] };
  error?: string;
}

export interface AdminAddEvidenceRequest {
  title: string;
  description?: string;
  evidenceType?: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface AdminUpdateEvidenceRequest {
  verified?: boolean;
  title?: string;
  description?: string;
}

export interface AdminDisputeTimelineListResponse {
  success: boolean;
  message: string;
  data?: { events: AdminDisputeTimelineEvent[] };
  error?: string;
}

export interface AdminCreateTimelineEventRequest {
  eventType: string;
  title: string;
  description?: string;
}

export interface AdminDisputeVerdictResponse {
  success: boolean;
  message: string;
  data?: AdminDisputeVerdictInfo;
  error?: string;
}

export interface AdminSubmitVerdictRequest {
  finalVerdict: string;
  decisionSummary?: string;
  decisionOutcome?: string;
}

export interface AdminDisputeAssessmentResponse {
  success: boolean;
  message: string;
  data?: AdminDisputePreliminaryAssessment | null;
  error?: string;
}

export interface AdminUpsertPreliminaryAssessmentRequest {
  title?: string;
  summary?: string;
  findings: Array<{ findingText: string; findingType?: string; orderIndex?: number }>;
}

export interface AdminDisputeMessagesResponse {
  success: boolean;
  message: string;
  data?: { messages: AdminDisputeChatMessage[]; total: number };
  error?: string;
}

export interface AdminSendMessageRequest {
  messageText: string;
  senderRole?: 'admin' | 'mediator';
}
