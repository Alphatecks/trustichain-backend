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
  targetDate?: string;
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

/** POST /api/savings/wallets — create savings plan */
export interface SavingsCreateWalletRequest {
  name: string;
  targetAmountUsd?: number;
  /** Optional target completion date in YYYY-MM-DD format */
  targetDate?: string;
}

/** POST /api/savings/transfer — move XRP from custodial wallet into a savings bucket */
export interface SavingsTransferRequest {
  /** Target savings account (`savings_wallets.id`) */
  savingsWalletId: string;
  /** Source custodial wallet (`wallets.id`, personal). Omit if user has only one XRP wallet. */
  sourceWalletId?: string;
  /** Amount in XRP to move */
  amountXrp: number;
}

export interface SavingsTransferResponse {
  success: boolean;
  message: string;
  data?: {
    transactionId: string;
    savingsWalletId: string;
    amountXrp: number;
    amountUsd: number;
    newWalletBalanceXrp: number;
  };
  error?: string;
}

/**
 * POST /api/savings/withdraw — move value from a savings bucket back to custodial XRP
 * Match UI: pick `savingsWalletId` (from GET /api/savings/wallets), then either withdraw
 * the full Saved balance (`withdrawAll: true`) or a specific `amountUsd` / `amountXrp`.
 * Provide exactly one of: withdrawAll | amountUsd | amountXrp.
 */
export interface SavingsWithdrawRequest {
  savingsWalletId: string;
  /** Custodial XRP wallet to credit; omit if user has only one personal wallet */
  targetWalletId?: string;
  /** One-tap withdraw entire Saved balance (US$ shown on the plan card) */
  withdrawAll?: boolean;
  /** Partial withdraw in USD (matches “Saved: US$…” in the UI) */
  amountUsd?: number;
  /** Partial withdraw in XRP (converted via live rate) */
  amountXrp?: number;
}

export interface SavingsWithdrawResponse {
  success: boolean;
  message: string;
  data?: {
    transactionId: string;
    savingsWalletId: string;
    amountXrp: number;
    amountUsd: number;
    newWalletBalanceXrp: number;
    remainingSavingsUsd: number;
  };
  error?: string;
}

/** DELETE /api/savings/wallets/:savingsWalletId — any remaining balance is released to custodial XRP first */
export interface SavingsDeleteWalletResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    /** Present when there was a positive saved balance and it was auto-withdrawn */
    released?: {
      transactionId: string;
      amountXrp: number;
      amountUsd: number;
      newWalletBalanceXrp: number;
    };
  };
  error?: string;
}


