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
    disputeDbId?: string; // For debugging - the actual UUID used in database
    totalCount?: number; // Total number of evidence items found
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

export interface TrackDisputeActivityRequest {
  disputeId: string; // UUID or case_id
}

export interface TrackDisputeActivityResponse {
  success: boolean;
  message: string;
  data?: {
    isActive: boolean;
    lastViewedAt: string;
    disputeId: string;
  };
  error?: string;
}

export interface GetDisputeActivityResponse {
  success: boolean;
  message: string;
  data?: {
    activeUsers: Array<{
      userId: string;
      userName: string;
      lastViewedAt: string;
      isActive: boolean;
    }>;
    currentUserActive: boolean;
    currentUserLastViewed?: string;
  };
  error?: string;
}

// Assessment Types
export type AssessmentType = 'preliminary' | 'final' | 'review';
export type AssessmentStatus = 'draft' | 'published' | 'archived';
export type FindingType = 'positive' | 'negative' | 'neutral' | 'observation';

export interface AssessmentFinding {
  id: string;
  findingText: string;
  findingType?: FindingType;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeAssessment {
  id: string;
  disputeId: string;
  createdByUserId: string;
  createdByName?: string;
  assessmentType: AssessmentType;
  title: string;
  summary?: string;
  status: AssessmentStatus;
  findings: AssessmentFinding[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface CreateAssessmentRequest {
  disputeId: string;
  assessmentType?: AssessmentType;
  title?: string;
  summary?: string;
  findings: Array<{
    findingText: string;
    findingType?: FindingType;
    orderIndex?: number;
  }>;
}

export interface CreateAssessmentResponse {
  success: boolean;
  message: string;
  data?: {
    assessmentId: string;
    assessment: DisputeAssessment;
  };
  error?: string;
}

export interface UpdateAssessmentRequest {
  title?: string;
  summary?: string;
  status?: AssessmentStatus;
  findings?: Array<{
    id?: string; // If updating existing finding
    findingText: string;
    findingType?: FindingType;
    orderIndex?: number;
  }>;
}

export interface UpdateAssessmentResponse {
  success: boolean;
  message: string;
  data?: DisputeAssessment;
  error?: string;
}

export interface GetAssessmentResponse {
  success: boolean;
  message: string;
  data?: DisputeAssessment;
  error?: string;
}

export interface GetAssessmentsResponse {
  success: boolean;
  message: string;
  data?: {
    assessments: DisputeAssessment[];
    total: number;
  };
  error?: string;
}

export interface DeleteAssessmentResponse {
  success: boolean;
  message: string;
  error?: string;
}

// Timeline Event Types
export type TimelineEventType = 
  | 'dispute_filed'
  | 'mediator_assigned'
  | 'evidence_submitted'
  | 'evidence_updated'
  | 'evidence_deleted'
  | 'mediation_session_started'
  | 'mediation_session_ended'
  | 'assessment_created'
  | 'assessment_published'
  | 'assessment_updated'
  | 'dispute_resolved'
  | 'dispute_cancelled'
  | 'status_changed'
  | 'custom';

export interface TimelineEvent {
  id: string;
  disputeId: string;
  eventType: TimelineEventType;
  title: string;
  description?: string;
  createdByUserId?: string;
  createdByName?: string;
  isSystemEvent: boolean;
  metadata?: Record<string, any>;
  eventTimestamp: string; // When the event occurred
  createdAt: string;
  updatedAt: string;
}

export interface CreateTimelineEventRequest {
  eventType: TimelineEventType;
  title: string;
  description?: string;
  eventTimestamp?: string; // Optional: defaults to now, can be set for historical events
  metadata?: Record<string, any>;
}

export interface CreateTimelineEventResponse {
  success: boolean;
  message: string;
  data?: TimelineEvent;
  error?: string;
}

export interface GetTimelineEventsResponse {
  success: boolean;
  message: string;
  data?: {
    events: TimelineEvent[];
    total: number;
  };
  error?: string;
}

export interface DeleteTimelineEventResponse {
  success: boolean;
  message: string;
  error?: string;
}

// Final Verdict Types
export type VerdictStatus = 'pending' | 'decision_pending' | 'decision_made' | 'under_review';
export type DecisionOutcome = 'favor_initiator' | 'favor_respondent' | 'partial' | 'dismissed' | 'other';

export interface FinalVerdict {
  disputeId: string;
  verdictStatus: VerdictStatus;
  mediatorUserId?: string;
  mediatorName?: string;
  decisionDeadline?: string; // ISO timestamp
  finalVerdict?: string;
  decisionDate?: string; // ISO timestamp
  decisionSummary?: string;
  decisionOutcome?: DecisionOutcome;
  hoursRemaining?: number; // Calculated hours until deadline
  isOverdue?: boolean; // Whether deadline has passed
}

export interface GetFinalVerdictResponse {
  success: boolean;
  message: string;
  data?: FinalVerdict;
  error?: string;
}

export interface AssignMediatorRequest {
  mediatorUserId: string;
  decisionDeadlineHours?: number; // Default 24 hours
}

export interface AssignMediatorResponse {
  success: boolean;
  message: string;
  data?: FinalVerdict;
  error?: string;
}

export interface SubmitFinalVerdictRequest {
  finalVerdict: string;
  decisionSummary?: string;
  decisionOutcome: DecisionOutcome;
}

export interface SubmitFinalVerdictResponse {
  success: boolean;
  message: string;
  data?: FinalVerdict;
  error?: string;
}

export interface UpdateVerdictStatusRequest {
  verdictStatus: VerdictStatus;
  decisionDeadlineHours?: number; // For decision_pending status
}

export interface UpdateVerdictStatusResponse {
  success: boolean;
  message: string;
  data?: FinalVerdict;
  error?: string;
}


