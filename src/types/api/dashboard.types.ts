/**
 * Dashboard API Types
 */

export interface DashboardSummaryResponse {
  success: boolean;
  message: string;
      data?: {
        balance: {
          xrp: number;
          usdt: number;
          usdc: number;
          usd: number; // Total USD equivalent (XRP converted + USDT + USDC)
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
      };
  error?: string;
}

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

export interface EscrowStatsResponse {
  success: boolean;
  message: string;
  data?: {
    activeCount: number;
    lockedAmount: number;
    totalEscrowed: number;
  };
  error?: string;
}

export interface TrustiscoreResponse {
  success: boolean;
  message: string;
  data?: {
    score: number;
    level: string;
    factors?: {
      completedEscrows?: number;
      accountAge?: number;
      disputeResolutionRate?: number;
      transactionVolume?: number;
    };
  };
  error?: string;
}

export interface PortfolioResponse {
  success: boolean;
  message: string;
  data?: {
    timeframe: string;
    data: Array<{
      period: string;
      value: number;
    }>;
  };
  error?: string;
}

export interface ExchangeRateResponse {
  success: boolean;
  message: string;
  data?: {
    rates: Array<{
      currency: string;
      rate: number;
      change: number;
      changePercent: number;
    }>;
    lastUpdated: string;
  };
  error?: string;
}


