/**
 * Exchange Rate Service
 *
 * Public API (GET /api/exchange/rates): fiat FX for display conversion from RLUSD/USD.
 * Internal: XRP/USD spot for legacy XRPL settlement (not exposed to users).
 */

import {
  EXCHANGE_QUOTE_DIRECTION,
  FIAT_EXCHANGE_CURRENCIES,
  type ExchangeQuoteDirection,
} from '../../types/api/currency.types';

interface CachedRate {
  rate: number;
  previousRate: number;
  timestamp: number;
}

export interface FiatDisplayRate {
  currency: string;
  rate: number;
}

export interface DisplayExchangeRatesData {
  rates: FiatDisplayRate[];
  lastUpdated: string;
  /** Each rate is units of `currency` per 1 USD (≈ 1 RLUSD). */
  quoteDirection: ExchangeQuoteDirection;
  quoteBase: 'USD';
}

export class ExchangeService {
  private fiatCache: Map<string, CachedRate> = new Map();
  private xrpUsdCache: CachedRate | null = null;
  private readonly CACHE_TTL = 60 * 1000;
  private readonly MAX_STALE_AGE = 2 * 60 * 1000;

  /**
   * Fiat FX rates for frontend display conversion (RLUSD ≈ USD base).
   * Does not include XRP pricing.
   */
  async getLiveExchangeRates(): Promise<{
    success: boolean;
    message: string;
    data?: DisplayExchangeRatesData;
    error?: string;
  }> {
    try {
      const now = Date.now();
      const rates: FiatDisplayRate[] = [{ currency: 'RLUSD', rate: 1.0 }];

      const fiatRates = await this.fetchAllFiatRatesFromUsd();
      if (!fiatRates) {
        const cachedAny = FIAT_EXCHANGE_CURRENCIES.some((c) => {
          const cached = this.fiatCache.get(c);
          return cached && now - cached.timestamp < this.MAX_STALE_AGE;
        });
        if (!cachedAny) {
          return {
            success: false,
            message: 'Failed to fetch exchange rates',
            error: 'Exchange rate fetch failed',
          };
        }
        for (const currency of FIAT_EXCHANGE_CURRENCIES) {
          const cached = this.fiatCache.get(currency);
          if (cached && now - cached.timestamp < this.MAX_STALE_AGE) {
            rates.push({ currency, rate: cached.rate });
          }
        }
      } else {
        for (const currency of FIAT_EXCHANGE_CURRENCIES) {
          const rate = fiatRates[currency];
          if (rate == null || rate <= 0) continue;
          const cached = this.fiatCache.get(currency);
          const previousRate = cached?.rate ?? rate;
          this.fiatCache.set(currency, { rate, previousRate, timestamp: now });
          rates.push({ currency, rate });
        }
      }

      return {
        success: true,
        message: 'Exchange rates retrieved successfully',
        data: {
          rates,
          lastUpdated: new Date().toISOString(),
          quoteDirection: EXCHANGE_QUOTE_DIRECTION,
          quoteBase: 'USD',
        },
      };
    } catch (error) {
      console.error('[Exchange] getLiveExchangeRates error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch exchange rates',
        error: error instanceof Error ? error.message : 'Failed to fetch exchange rates',
      };
    }
  }

  /**
   * XRP/USD spot for internal XRPL settlement only — not for user portfolio value.
   */
  async getXrpUsdRate(): Promise<number | null> {
    const now = Date.now();
    if (this.xrpUsdCache && now - this.xrpUsdCache.timestamp < this.CACHE_TTL) {
      return this.xrpUsdCache.rate;
    }

    const rate = await this.fetchFromCoinbase();
    if (rate != null && rate > 0) {
      const previousRate = this.xrpUsdCache?.rate ?? rate;
      this.xrpUsdCache = { rate, previousRate, timestamp: now };
      return rate;
    }

    if (this.xrpUsdCache && now - this.xrpUsdCache.timestamp < this.MAX_STALE_AGE) {
      return this.xrpUsdCache.rate;
    }

    const fallback = process.env.FALLBACK_XRP_USD_RATE;
    const fallbackRate = fallback != null ? parseFloat(fallback) : NaN;
    if (Number.isFinite(fallbackRate) && fallbackRate > 0) {
      console.warn('[Exchange] Using FALLBACK_XRP_USD_RATE for internal XRP settlement', {
        rate: fallbackRate,
      });
      return fallbackRate;
    }

    return null;
  }

  private async fetchAllFiatRatesFromUsd(): Promise<Record<string, number> | null> {
    try {
      const url = 'https://api.exchangerate-api.com/v4/latest/USD';
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = (await response.json()) as { rates?: Record<string, number> };
      return data.rates ?? null;
    } catch (error) {
      console.warn('[Exchange] fetchAllFiatRatesFromUsd failed:', error);
      return null;
    }
  }

  /**
   * Coinbase public API: XRP-USD spot (internal settlement only).
   */
  private async fetchFromCoinbase(): Promise<number | null> {
    try {
      const url = 'https://api.coinbase.com/v2/prices/XRP-USD/spot';
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return null;

      const data = (await response.json()) as { data?: { amount?: string } };
      const amountStr = data.data?.amount;
      const rate = amountStr != null ? parseFloat(amountStr) : NaN;
      if (Number.isNaN(rate) || rate <= 0) return null;
      return rate;
    } catch (error) {
      console.warn('[Exchange] fetchFromCoinbase failed:', error);
      return null;
    }
  }

  clearCache(): void {
    this.fiatCache.clear();
    this.xrpUsdCache = null;
  }
}

export const exchangeService = new ExchangeService();
