/**
 * Dashboard API Types
 */

import type { DisplayCurrency } from './currency.types';

export interface DashboardSummaryResponse {
  success: boolean;
  message: string;
      data?: {
        balance: {
          rlusd: number;
          usdt: number;
          usdc: number;
          xrp: number;
          /** All wallet money (RLUSD + USDT + USDC + XRP in USD). */
          grossUsd: number;
          /** Same as grossUsd — total of all money in the wallet. */
          totalUsd: number;
          lockedUsd: number;
          /** Spendable USD after escrow locks. */
          availableUsd: number;
          /** Same as totalUsd — total of all money in the wallet. */
          usd: number;
        };
        addresses?: {
          rlusd: string;
          xrp: string;
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
        /** User's saved display currency for portfolio graph and fiat conversion. */
        displayCurrency: DisplayCurrency;
      };
  error?: string;
}

export interface DashboardDisplayCurrencyResponse {
  success: boolean;
  message: string;
  data?: {
    displayCurrency: DisplayCurrency;
  };
  error?: string;
}

export interface WalletBalanceResponse {
  success: boolean;
  message: string;
  data?: {
    balance: {
      rlusd: number;
      usdt: number;
      usdc: number;
      usd: number;
    };
    addresses: {
      rlusd: string;
    };
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
    year?: number;
    /** Saved display currency; chart `value` amounts are in USD — convert client-side via exchange rates. */
    displayCurrency: DisplayCurrency;
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
    }>;
    lastUpdated: string;
    /** Each rate is units of `currency` per 1 USD (≈ 1 RLUSD). */
    quoteDirection: 'unitsPerUsd';
    quoteBase: 'USD';
  };
  error?: string;
}


