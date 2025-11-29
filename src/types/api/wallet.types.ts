/**
 * Wallet API Types
 */

export interface WalletBalanceResponse {
  success: boolean;
  message: string;
  data?: {
    balance: {
      xrp: number;
      usdt: number;
      usdc: number;
    };
    xrplAddress: string;
  };
  error?: string;
}

export interface FundWalletRequest {
  amount: number;
  currency: 'USD' | 'XRP' | 'USDT' | 'USDC';
}

export interface FundWalletResponse {
  success: boolean;
  message: string;
  data?: {
    transactionId: string;
    transaction: any;
    transactionBlob: string;
    instructions: string;
    amount: {
      xrp: number;
      usdt: number;
      usdc: number;
    };
    requiresTrustLine?: boolean;
    trustLineTransaction?: {
      transaction: any;
      transactionBlob: string;
      instructions: string;
    };
  };
  error?: string;
}

export interface CompleteFundWalletRequest {
  transactionId: string;
  signedTxBlob: string;
}

export interface CompleteFundWalletResponse {
  success: boolean;
  message: string;
  data?: {
    transactionId: string;
    xrplTxHash: string;
    status: string;
  };
  error?: string;
}

export interface CreateXUMMPayloadRequest {
  transactionId: string;
  transactionBlob: string;
}

export interface CreateXUMMPayloadResponse {
  success: boolean;
  message: string;
  data?: {
    uuid: string;
    next: {
      always: string;
    };
  };
  error?: string;
}

export interface XUMMPayloadStatusResponse {
  success: boolean;
  message: string;
  data?: {
    signed: boolean;
    signedTxBlob: string | null;
    cancelled: boolean;
    expired: boolean;
    xrplTxHash: string | null;
  };
  error?: string;
}

export interface WithdrawWalletRequest {
  amount: number;
  currency: 'USD' | 'XRP';
  destinationAddress: string;
}

export interface WithdrawWalletResponse {
  success: boolean;
  message: string;
  data?: {
    transactionId: string;
    amount: {
      usd: number;
      xrp: number;
    };
    xrplTxHash?: string;
    status: string;
  };
  error?: string;
}

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'escrow_create' | 'escrow_release' | 'escrow_cancel' | 'transfer';
  amount: {
    usd: number;
    xrp: number;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  xrplTxHash?: string;
  description?: string;
  createdAt: string;
}

export interface WalletTransactionsResponse {
  success: boolean;
  message: string;
  data?: {
    transactions: WalletTransaction[];
    total: number;
  };
  error?: string;
}


