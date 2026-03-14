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

/** Supply contract escrowed to the current business (counterparty view). Only visible to Business A when Business B has escrowed to them. */
export interface SupplyContractEscrowedToMeItem {
  escrowId: string;
  contractId: string;
  amountUsd: number;
  amountXrp: number | null;
  status: string;
  createdAt: string;
}

export interface SupplyContractsEscrowedToMeResponse {
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
export type ReleaseCondition = 'Buyer confirms delivery' | 'Time based' | 'Milestones';

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
