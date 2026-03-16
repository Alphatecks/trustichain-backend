/**
 * Business Suite Dashboard API Types
 */

export interface BusinessSuiteDashboardSummaryData {
  balance: {
    xrp: number;
    usdt: number;
    usdc: number;
    usd: number;
  };
  activeEscrows: {
    count: number;
    lockedAmount: number;
  };
  trustiscore: {
    score: number;
    level: string;
  };
  totalEscrowed: number;
  payrollsCreated: number;
  suppliers: number;
  completedThisMonth: number;
}

export interface BusinessSuiteDashboardSummaryResponse {
  success: boolean;
  message: string;
  data?: BusinessSuiteDashboardSummaryData;
  error?: string;
}

export type BusinessSuiteActivityStatus = 'In progress' | 'Completed' | 'Pending';

export interface BusinessSuiteActivityListItem {
  id: string;
  activityId: string;
  description: {
    name: string;
    address: string;
  };
  status: BusinessSuiteActivityStatus;
  date: string;
  createdAt: string;
  amountUsd?: number;
}

export interface BusinessSuiteActivityListParams {
  status?: BusinessSuiteActivityStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

export interface BusinessSuiteActivityListResponse {
  success: boolean;
  message: string;
  data?: {
    items: BusinessSuiteActivityListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

/** Portfolio chart: Subscription and Payroll by period (monthly/weekly/quarterly/yearly) */
export type BusinessSuitePortfolioPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface BusinessSuitePortfolioDataPoint {
  period: string;
  subscriptionUsd: number;
  payrollUsd: number;
  subscriptionPercent: number;
  payrollPercent: number;
}

export interface BusinessSuitePortfolioChartResponse {
  success: boolean;
  message: string;
  data?: {
    period: BusinessSuitePortfolioPeriod;
    year?: number;
    data: BusinessSuitePortfolioDataPoint[];
  };
  error?: string;
}

/** Upcoming Supply / Subscription list item (name, email, amount, date) */
export interface BusinessSuiteSupplyOrSubscriptionItem {
  id: string;
  name: string;
  email: string;
  amountUsd: number;
  dueDate: string | null;
}

export interface BusinessSuiteUpcomingSupplyResponse {
  success: boolean;
  message: string;
  data?: {
    items: BusinessSuiteSupplyOrSubscriptionItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

export interface BusinessSuiteSubscriptionListResponse {
  success: boolean;
  message: string;
  data?: {
    items: BusinessSuiteSupplyOrSubscriptionItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

/** Supplier contract overview stats for the three cards: Total supplier (contracts), Pending supplier, Total Supplier Amount */
export interface SupplierContractOverviewData {
  /** Total number of supplier contracts created by this business (supply escrows count) */
  totalSupplierContracts: number;
  /** USD amount currently locked in active/pending supply escrows (for "$X locked" secondary text) */
  lockedUsd: number;
  /** Pending supplier card: count of supply escrows in pending/active state */
  pendingCount: number;
  /** Total created supplier contracts (for "X/Total" display e.g. 25/100) */
  pendingTotal: number;
  /** Trustiscore level for "Bronze" / "Silver" / "Gold" / "Platinum" display */
  tier: string;
  /** Total supplier amount in USD (sum of amount_usd across all supply escrows) */
  totalSupplierAmount: number;
}

export interface SupplierContractOverviewResponse {
  success: boolean;
  message: string;
  data?: SupplierContractOverviewData;
  error?: string;
}

/** Supply contract escrowed to the current business (counterparty view). Only visible to Business A when Business B has escrowed to them. */
export interface SupplyContractEscrowedToMeItem {
  escrowId: string;
  /** Display ID e.g. SC-2024-001 (Supplier Contract) */
  contractId: string;
  amountUsd: number;
  amountXrp: number | null;
  /** Raw escrow status: pending | active | completed | cancelled | disputed */
  status: string;
  /** Display status for UI: Pending | Released (completed) */
  statusDisplay: 'Pending' | 'Released';
  /** Release date set at escrow creation (expected_release_date or expected_completion_date). For display and manual release. */
  expectedReleaseDate: string | null;
  /** True if escrow is locked and current user (counterparty or owner) can trigger release (manual or after release day). */
  canRelease: boolean;
  createdAt: string;
  /** Contract document URLs (contractor-uploaded). Present on created-by-me list and detail. */
  contractDocumentUrls?: string[];
}

export interface SupplyContractsEscrowedToMeResponse {
  success: boolean;
  message: string;
  data?: {
    items: SupplyContractEscrowedToMeItem[];
  };
  error?: string;
}

/** Single supply contract detail for supplier modal (Escrow contract + Evidence/Documents + actions). */
export interface SupplyContractDetailForSupplier {
  escrowId: string;
  contractId: string;
  buyer: string | null;
  amountUsd: number;
  amountXrp: number | null;
  currency: string;
  status: string;
  fundsVerifiedInEscrow: boolean;
  timeline: {
    escrowCreated: boolean;
    fundsDeposited: boolean;
    contractAccepted: boolean;
    awaitingDelivery: boolean;
    paymentRelease: boolean;
  };
  deliveryDeadline: string | null;
  releaseCondition: string | null;
  escrowType: string | null;
  disputeWindow: string | null;
  contractTitle: string | null;
  deliveryMethod: string | null;
  /** Documents sent by contractor (buyer) when creating the contract. */
  documentsFromContractor: string[];
  canRelease: boolean;
  expectedReleaseDate: string | null;
  createdAt: string;
  /** When the supplier marked as delivered (ISO string or null). */
  deliveryMarkedAt: string | null;
  /** When the supplier requested buyer confirmation (ISO string or null). */
  buyerConfirmationRequestedAt: string | null;
}

export interface SupplyContractDetailForSupplierResponse {
  success: boolean;
  message: string;
  data?: SupplyContractDetailForSupplier;
  error?: string;
}

/** Single supply contract detail for contractor modal (creator view; includes uploaded documents). */
export interface SupplyContractDetailForContractor {
  escrowId: string;
  contractId: string;
  supplierName: string | null;
  amountUsd: number;
  amountXrp: number | null;
  currency: string;
  status: string;
  fundsVerifiedInEscrow: boolean;
  deliveryDeadline: string | null;
  releaseCondition: string | null;
  escrowType: string | null;
  disputeWindow: string | null;
  contractTitle: string | null;
  deliveryMethod: string | null;
  /** Document URLs uploaded by contractor when creating the contract. */
  contractDocumentUrls: string[];
  canRelease: boolean;
  expectedReleaseDate: string | null;
  createdAt: string;
}

export interface SupplyContractDetailForContractorResponse {
  success: boolean;
  message: string;
  data?: SupplyContractDetailForContractor;
  error?: string;
}

/** Supply contracts created by this business (creator view). Same item shape; use this for supply status list with release. */
export interface SupplyContractsCreatedByMeResponse {
  success: boolean;
  message: string;
  data?: {
    items: SupplyContractEscrowedToMeItem[];
  };
  error?: string;
}

/** Step 1: Contract Info (Create Supplier Contract modal) */
export type DeliveryMethod = 'Physical Goods' | 'Digital Delivery' | 'Service';
export type DisputeWindow = '7 days' | '14 days' | '21 days' | '30 days';

/** Step 2: Payment Terms */
export type SupplierContractEscrowType = 'Full Payment' | 'Milestone Payment';
export type ReleaseCondition = 'Buyer confirms delivery' | 'Time based' | 'Milestones' | 'Automatic release after delivery';

export interface CreateSupplierContractRequest {
  /** Step 1 - Contract Info */
  supplierName: string;
  supplierWalletAddress: string;
  supplierEmail?: string;
  contractTitle: string;
  deliveryDeadline?: string;
  contractDescription?: string;
  deliveryMethod: DeliveryMethod;
  disputeWindow: DisputeWindow;
  /** Step 2 - Payment Terms */
  paymentAmount: number;
  currency: 'USD' | 'XRP' | 'USDT';
  escrowType: SupplierContractEscrowType;
  releaseCondition: ReleaseCondition;
  /** Optional: document URLs from POST /supply-contracts/documents/upload (Invoice, Agreement, Delivery Terms) */
  contractDocumentUrls?: string[];
}

export interface CreateSupplierContractResponse {
  success: boolean;
  message: string;
  data?: {
    escrowId: string;
    contractId: string;
    amountUsd: number;
    amountXrp: number | null;
    status: string;
  };
  error?: string;
}

/** File dispute for suppliers modal: supplier reference (ID or name), reason, amount, currency, description, optional evidence */
export interface FileSupplierDisputeRequest {
  supplierReference: string;
  reason: string;
  amount: number;
  currency: 'USD' | 'XRP';
  description: string;
  evidence?: Array<{ fileUrl: string; fileName: string; fileType?: string; fileSize?: number }>;
}

export interface FileSupplierDisputeResponse {
  success: boolean;
  message: string;
  data?: { disputeId: string; caseId: string };
  error?: string;
}
