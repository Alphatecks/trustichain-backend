/**
 * Escrow API Types
 */

export type TransactionType = 'freelance' | 'product_purchase' | 'real_estate' | 'custom';

export type ReleaseType = 'Manual Release' | 'Time based' | 'Milestones';

export interface Milestone {
  id?: string; // Milestone ID (included in responses)
  milestoneDetails: string; // Description/details of the milestone
  milestoneAmount: number; // Amount for this milestone
  milestoneAmountUsd?: number; // Amount in USD (included in responses)
  milestoneOrder?: number; // Order/sequence number
  status?: string; // Status: pending, completed, released (included in responses)
  createdAt?: string; // Created timestamp (included in responses)
  completedAt?: string; // Completed timestamp (included in responses)
}

export interface CreateEscrowRequest {
  // Wallet addresses
  payerXrpWalletAddress?: string; // Optional - will be automatically fetched from authenticated user's registered wallet
  counterpartyXrpWalletAddress: string;
  
  // Counterparty ID (optional - will be looked up by wallet address if not provided)
  counterpartyId?: string;
  
  // Escrow details
  amount: number;
  currency: 'USD' | 'XRP';
  description?: string;
  transactionType: TransactionType;
  industry?: string;
  
  // Payer contact information (optional)
  payerEmail?: string;
  payerName?: string;
  payerPhoneNumber?: string;
  
  // Counterparty contact information (optional)
  counterpartyEmail?: string;
  counterpartyName?: string;
  counterpartyPhoneNumber?: string;
  
  // Step 2: Terms and Release conditions (optional)
  releaseType?: ReleaseType;
  expectedCompletionDate?: string; // ISO date string - Required for "Milestones" release type
  expectedReleaseDate?: string; // ISO date string - Required for "Time based" release type
  disputeResolutionPeriod?: string; // e.g., "7 days", "14 days" - Required for "Milestones" release type
  totalAmount?: number; // If provided, will override amount field - Required for both "Time based" and "Milestones" release types
  releaseConditions?: string; // Detailed release conditions text
  milestones?: Milestone[]; // Array of milestones - Required for "Milestones" release type
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
    // XUMM-related fields for user-signed escrow creation
    xummUrl?: string;
    xummUuid?: string;
    transaction?: any;
    transactionBlob?: string;
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
  
  // Contact information
  payerEmail?: string;
  payerName?: string;
  payerPhone?: string;
  counterpartyEmail?: string;
  counterpartyPhone?: string;
  
  // Step 2: Terms and Release conditions
  releaseType?: ReleaseType;
  expectedCompletionDate?: string;
  expectedReleaseDate?: string;
  disputeResolutionPeriod?: string;
  releaseConditions?: string;
  milestones?: Milestone[]; // Array of milestones for milestone-based escrows
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




