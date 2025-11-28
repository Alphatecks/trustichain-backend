/**
 * Escrow API Types
 */

export interface CreateEscrowRequest {
  counterpartyId: string;
  amount: number;
  currency: 'USD' | 'XRP';
  description?: string;
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
  counterpartyId: string;
  counterpartyName?: string;
  amount: {
    usd: number;
    xrp: number;
  };
  status: 'pending' | 'active' | 'completed' | 'cancelled' | 'disputed';
  description?: string;
  xrplEscrowId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
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
