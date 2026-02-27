/**
 * Business Suite Payrolls API Types
 */

export interface BusinessPayrollItemInput {
  counterpartyId: string;
  amountUsd: number;
  dueDate?: string;
}

/** Payroll cycle from Step 1 */
export type PayrollCycle = 'Weekly' | 'Bi-weekly' | 'Other';

/** Disbursement mode from Step 3 (maps to freeze_auto_release: Manual => true) */
export type DisbursementMode = 'auto_release' | 'manual_release';

export interface CreatePayrollRequest {
  /** Step 1 - Payroll Details */
  name: string;
  companyName?: string;
  companyEmail?: string;
  payrollCycle?: PayrollCycle;
  cycleDate?: string;
  startDate?: string;
  endDate?: string;
  companyDescription?: string;
  /** Step 2 - Members: optional; can add after creating payroll */
  items?: BusinessPayrollItemInput[];
  /** Step 3 - Payment Details */
  releaseDate?: string;
  freezeAutoRelease?: boolean;
  disbursementMode?: DisbursementMode;
  defaultSalaryType?: string;
  currency?: string;
  enableAllowances?: boolean;
  /** Legacy / convenience */
  amountUsd?: number;
  salaryAmount?: number;
}

export interface UpdatePayrollRequest {
  name?: string;
  companyName?: string;
  companyEmail?: string;
  payrollCycle?: PayrollCycle;
  cycleDate?: string;
  startDate?: string;
  endDate?: string;
  companyDescription?: string;
  releaseDate?: string;
  freezeAutoRelease?: boolean;
  disbursementMode?: DisbursementMode;
  defaultSalaryType?: string;
  currency?: string;
  enableAllowances?: boolean;
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
    companyName?: string | null;
    companyEmail?: string | null;
    payrollCycle?: string | null;
    cycleDate?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    companyDescription?: string | null;
    defaultSalaryType?: string | null;
    currency?: string | null;
    enableAllowances?: boolean;
    releaseDate: string | null;
    freezeAutoRelease: boolean;
    disbursementMode: DisbursementMode;
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
