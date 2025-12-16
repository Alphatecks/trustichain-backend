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
      usd: number; // Total USD equivalent (XRP converted + USDT + USDC)
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
    amount: {
      usd: number;
      xrp: number;
    };
    xrplTxHash?: string;
    xummUrl?: string;
    xummUuid?: string;
    transaction?: any;
    transactionBlob?: string;
    destinationAddress?: string;
    amountXrp?: number;
    amountToken?: number;
    currency?: string;
    walletType?: 'xaman' | 'metamask' | 'browser';
    note?: string;
    status: string;
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


