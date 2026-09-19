/**
 * Exchange Rate Service
 *
 * Public API (GET /api/exchange/rates): fiat FX (units per 1 USD/RLUSD) plus live XRP/USD
 * for coin-to-fiat display. Fiat is mid-market indicative, not a payment-processor quote.
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
  /** Each fiat rate is units of `currency` per 1 USD (≈ 1 RLUSD). */
  quoteDirection: ExchangeQuoteDirection;
  quoteBase: 'USD';
  /** Live XRP spot in USD. Fiat value of XRP = xrpAmount * xrpUsdRate * (units per USD). */
  xrpUsdRate: number | null;
}

export type EscrowSettlementCurrency = 'XRP';

export interface EscrowSettlementAmounts {
  denominationAmount: number;
  denominationCurrency: string;
  amountUsd: number;
  amountXrp: number;
  settlementCurrency: EscrowSettlementCurrency;
  xrpUsdRate: number;
}

export type EscrowSettlementResult =
  | { success: true; data: EscrowSettlementAmounts }
  | { success: false; message: string; error: string };

const FETCH_TIMEOUT_MS = 8_000;

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.warn('[Exchange] fetch failed:', { url, error });
    return null;
  }
}

function parsePositiveRate(value: unknown): number | null {
  const rate = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate;
}

export class ExchangeService {
  private fiatCache: Map<string, CachedRate> = new Map();
  private xrpUsdCache: CachedRate | null = null;
  private xrpUsdInflight: Promise<number | null> | null = null;
  private readonly CACHE_TTL = 60 * 1000;
  private readonly MAX_STALE_AGE = 2 * 60 * 1000;

  /**
   * Fiat FX rates for frontend display conversion (RLUSD ≈ USD base), plus live XRP/USD.
   */
  async getLiveExchangeRates(): Promise<{
    success: boolean;
    message: string;
    data?: DisplayExchangeRatesData;
    error?: string;
  }> {
    try {
      const now = Date.now();
      const rates: FiatDisplayRate[] = [
        { currency: 'RLUSD', rate: 1.0 },
        { currency: 'USD', rate: 1.0 },
      ];

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

      const xrpUsdRate = await this.getXrpUsdRate();

      return {
        success: true,
        message: 'Exchange rates retrieved successfully',
        data: {
          rates,
          lastUpdated: new Date().toISOString(),
          quoteDirection: EXCHANGE_QUOTE_DIRECTION,
          quoteBase: 'USD',
          xrpUsdRate,
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
   * Convert a user-entered escrow amount (fiat, USD, RLUSD, or XRP) into USD reference
   * and XRP settlement amounts for XRPL escrow creation.
   */
  async resolveEscrowSettlementAmounts(
    amount: number,
    currency: string
  ): Promise<EscrowSettlementResult> {
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        success: false,
        message: 'Amount must be greater than 0',
        error: 'Invalid amount',
      };
    }

    const denominationCurrency = (currency || 'USD').trim().toUpperCase();
    const xrpUsdRate = await this.getXrpUsdRate();
    if (xrpUsdRate == null || xrpUsdRate <= 0) {
      return {
        success: false,
        message: 'XRP/USD exchange rate not available',
        error: 'Exchange rate not available',
      };
    }

    let amountUsd: number;

    if (denominationCurrency === 'XRP') {
      amountUsd = amount * xrpUsdRate;
    } else if (denominationCurrency === 'USD' || denominationCurrency === 'RLUSD') {
      amountUsd = amount;
    } else {
      const ratesResult = await this.getLiveExchangeRates();
      if (!ratesResult.success || !ratesResult.data) {
        return {
          success: false,
          message: 'Failed to fetch exchange rates for currency conversion',
          error: 'Exchange rate fetch failed',
        };
      }

      const fiatRate = ratesResult.data.rates.find(
        (entry) => entry.currency === denominationCurrency
      )?.rate;

      if (fiatRate == null || fiatRate <= 0) {
        return {
          success: false,
          message: `Exchange rate not available for ${denominationCurrency}`,
          error: 'Exchange rate not available',
        };
      }

      if (ratesResult.data.quoteDirection === 'unitsPerUsd') {
        amountUsd = amount / fiatRate;
      } else {
        amountUsd = amount * fiatRate;
      }
    }

    const amountXrp = parseFloat((amountUsd / xrpUsdRate).toFixed(6));

    return {
      success: true,
      data: {
        denominationAmount: amount,
        denominationCurrency,
        amountUsd: parseFloat(amountUsd.toFixed(2)),
        amountXrp,
        settlementCurrency: 'XRP',
        xrpUsdRate,
      },
    };
  }

  /**
   * Live XRP/USD spot (Coinbase → CoinGecko → Binance, then short-lived cache / env fallback).
   */
  async getXrpUsdRate(): Promise<number | null> {
    const now = Date.now();
    if (this.xrpUsdCache && now - this.xrpUsdCache.timestamp < this.CACHE_TTL) {
      return this.xrpUsdCache.rate;
    }
    if (this.xrpUsdInflight) {
      return this.xrpUsdInflight;
    }

    this.xrpUsdInflight = this.resolveXrpUsdRate(now).finally(() => {
      this.xrpUsdInflight = null;
    });
    return this.xrpUsdInflight;
  }

  private async resolveXrpUsdRate(now: number): Promise<number | null> {
    const rate = await this.fetchXrpUsdSpot();
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
    const apiKey = process.env.EXCHANGE_RATE_API_KEY?.trim();
    if (apiKey) {
      const authenticated = await fetchJson<{
        result?: string;
        conversion_rates?: Record<string, number>;
      }>(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`);
      if (authenticated?.result === 'success' && authenticated.conversion_rates) {
        return authenticated.conversion_rates;
      }
    }

    const openAccess = await fetchJson<{
      result?: string;
      rates?: Record<string, number>;
    }>('https://open.er-api.com/v6/latest/USD');
    if (openAccess?.result === 'success' && openAccess.rates) {
      return openAccess.rates;
    }

    const legacyV4 = await fetchJson<{ rates?: Record<string, number> }>(
      'https://api.exchangerate-api.com/v4/latest/USD'
    );
    if (legacyV4?.rates) {
      return legacyV4.rates;
    }

    const community = await fetchJson<{ usd?: Record<string, number> }>(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'
    );
    if (community?.usd) {
      const rates: Record<string, number> = {};
      for (const [code, value] of Object.entries(community.usd)) {
        if (typeof value === 'number' && value > 0) {
          rates[code.toUpperCase()] = value;
        }
      }
      return Object.keys(rates).length > 0 ? rates : null;
    }

    return null;
  }

  private async fetchXrpUsdSpot(): Promise<number | null> {
    const [coinbase, coinGecko, binance] = await Promise.all([
      this.fetchFromCoinbase(),
      this.fetchFromCoinGecko(),
      this.fetchFromBinance(),
    ]);
    return coinbase ?? coinGecko ?? binance;
  }

  private async fetchFromCoinbase(): Promise<number | null> {
    const data = await fetchJson<{ data?: { amount?: string } }>(
      'https://api.coinbase.com/v2/prices/XRP-USD/spot'
    );
    return parsePositiveRate(data?.data?.amount);
  }

  private async fetchFromCoinGecko(): Promise<number | null> {
    const data = await fetchJson<{ ripple?: { usd?: number } }>(
      'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd'
    );
    return parsePositiveRate(data?.ripple?.usd);
  }

  private async fetchFromBinance(): Promise<number | null> {
    const data = await fetchJson<{ price?: string }>(
      'https://api.binance.com/api/v3/ticker/price?symbol=XRPUSDT'
    );
    return parsePositiveRate(data?.price);
  }

  clearCache(): void {
    this.fiatCache.clear();
    this.xrpUsdCache = null;
  }
}

export const exchangeService = new ExchangeService();
