/**
 * Savings API Types
 */

export interface SavingsCategoryAllocation {
  walletId: string;
  name: string;
  amountUsd: number;
  percentage: number;
}

export interface SavingsSummaryResponse {
  success: boolean;
  message: string;
  data?: {
    totalUsd: number;
    changePercent?: number;
    periodLabel: string;
    categories: SavingsCategoryAllocation[];
  };
  error?: string;
}

export interface SavingsCashflowPoint {
  period: string; // e.g. "Jan", "2025-01", or "2025-W01"
  receivedUsd: number;
  spentUsd: number;
}

export interface SavingsCashflowResponse {
  success: boolean;
  message: string;
  data?: {
    interval: 'monthly' | 'weekly';
    points: SavingsCashflowPoint[];
  };
  error?: string;
}

export interface SavingsWalletItem {
  id: string;
  name: string;
  amountUsd: number;
  percentage: number;
  targetAmountUsd?: number;
}

export interface SavingsWalletsResponse {
  success: boolean;
  message: string;
  data?: {
    totalUsd: number;
    wallets: SavingsWalletItem[];
  };
  error?: string;
}

export type SavingsTransactionDirection = 'received' | 'spent';

export interface SavingsTransactionItem {
  id: string;
  walletId: string;
  walletName?: string;
  direction: SavingsTransactionDirection;
  txLabel: string; // e.g. "Received" / "Sent"
  txHash?: string;
  amountUsd: number;
  status: string;
  date: string; // ISO date (yyyy-mm-dd) for UI
}

export interface SavingsTransactionsResponse {
  success: boolean;
  message: string;
  data?: {
    transactions: SavingsTransactionItem[];
    total: number;
  };
  error?: string;
}


