/**
 * Business Suite Payrolls API Types
 */

export interface BusinessPayrollItemInput {
  counterpartyId: string;
  amountUsd: number;
  dueDate?: string;
}

export interface CreatePayrollRequest {
  name: string;
  releaseDate?: string;
  freezeAutoRelease?: boolean;
  items: BusinessPayrollItemInput[];
}

export interface UpdatePayrollRequest {
  name?: string;
  releaseDate?: string;
  freezeAutoRelease?: boolean;
}

export interface BusinessPayrollListItem {
  id: string;
  name: string;
  releaseDate: string | null;
  freezeAutoRelease: boolean;
  status: string;
  progressPercent: number;
  totalAmountUsd: number;
  itemCount: number;
  releasedCount: number;
  createdAt: string;
}

export interface BusinessPayrollListResponse {
  success: boolean;
  message: string;
  data?: {
    items: BusinessPayrollListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

export interface BusinessPayrollDetailItem {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  counterpartyEmail: string;
  amountUsd: number;
  amountXrp: number | null;
  status: string;
  dueDate: string | null;
  escrowId: string | null;
  createdAt: string;
}

export interface BusinessPayrollDetailResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    name: string;
    releaseDate: string | null;
    freezeAutoRelease: boolean;
    status: string;
    totalAmountUsd: number;
    createdAt: string;
    updatedAt: string;
    items: BusinessPayrollDetailItem[];
  };
  error?: string;
}

export interface BusinessPayrollSummaryResponse {
  success: boolean;
  message: string;
  data?: {
    totalPayroll: number;
    totalPayrollChangePercent?: number;
    totalTeamMembers: number;
    totalPayrollEscrowed: number;
  };
  error?: string;
}

export interface PayrollTransactionListItem {
  id: string;
  transactionId: string;
  payrollId: string;
  payrollName: string;
  amountXrp: number | null;
  amountUsd: number;
  status: string;
  dueDate: string | null;
  counterpartyName: string;
  createdAt: string;
}

export interface BusinessPayrollTransactionsResponse {
  success: boolean;
  message: string;
  data?: {
    items: PayrollTransactionListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

export interface BusinessPayrollTransactionDetailResponse {
  success: boolean;
  message: string;
  data?: PayrollTransactionListItem & { counterpartyEmail: string; escrowId: string | null };
  error?: string;
}
