/**
 * Escrow API Types
 */

export type TransactionType = 'freelance' | 'product_purchase' | 'real_estate' | 'custom';

export interface CreateEscrowRequest {
  counterpartyId: string;
  amount: number;
  currency: 'USD' | 'XRP';
  description?: string;
  transactionType: TransactionType;
  industry?: string;
}

export interface CreateEscrowResponse {
  success: boolean;
  message: string;
  data?: {
    escrowId: string;
    amount: {
      usd: number;
      xrp: number;
    };
    status: string;
    xrplEscrowId?: string;
  };
  error?: string;
}

export interface Escrow {
  id: string;
  escrowId: string; // Formatted as #ESC-YYYY-XXX
  userId: string; // Initiator user ID
  counterpartyId: string;
  initiatorName: string; // Full name of escrow creator
  counterpartyName?: string;
  amount: {
    usd: number;
    xrp: number;
  };
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'disputed';
  transactionType: TransactionType;
  industry: string | null;
  progress: number; // 0-100 percentage
  description?: string;
  xrplEscrowId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  cancelReason?: string;
}

export interface EscrowListResponse {
  success: boolean;
  message: string;
  data?: {
    escrows: Escrow[];
    total: number;
  };
  error?: string;
}

export interface EscrowDetailResponse {
  success: boolean;
  message: string;
  data?: Escrow;
  error?: string;
}

export interface ActiveEscrowsResponse {
  success: boolean;
  message: string;
  data?: {
    count: number;
    lockedAmount: number;
  };
  error?: string;
}

export interface TotalEscrowedResponse {
  success: boolean;
  message: string;
  data?: {
    totalEscrowed: number;
  };
  error?: string;
}

export interface CompletedEscrowsMonthResponse {
  success: boolean;
  message: string;
  data?: {
    count: number;
    month: string;
    year: number;
  };
  error?: string;
}

// Query parameters for filtered escrow list
export interface GetEscrowListRequest {
  transactionType?: TransactionType | 'all';
  industry?: string | 'all';
  month?: number; // 1-12
  year?: number;
  limit?: number;
  offset?: number;
}

// Request body for releasing an escrow
export interface ReleaseEscrowRequest {
  notes?: string;
}

// Request body for cancelling an escrow
export interface CancelEscrowRequest {
  reason: string;
}

// Response for release escrow action
export interface ReleaseEscrowResponse {
  success: boolean;
  message: string;
  data?: Escrow;
  error?: string;
}

// Response for cancel escrow action
export interface CancelEscrowResponse {
  success: boolean;
  message: string;
  data?: Escrow;
  error?: string;
}

// Response for industries list
export interface GetIndustriesResponse {
  success: boolean;
  message: string;
  data?: {
    industries: string[];
  };
  error?: string;
}




