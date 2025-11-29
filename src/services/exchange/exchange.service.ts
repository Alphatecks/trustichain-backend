/**
 * Exchange Rate Service
 * Fetches live exchange rates for XRP against major currencies
 */

interface CachedRate {
  rate: number;
  previousRate: number;
  timestamp: number;
}

interface ExchangeRate {
  currency: string;
  rate: number;
  change: number;
  changePercent: number;
}

export class ExchangeService {
  private cache: Map<string, CachedRate> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get live exchange rates for XRP against USD, EUR, GBP, JPY
   * Uses cached data if available and fresh
   */
  async getLiveExchangeRates(): Promise<{
    success: boolean;
    message: string;
    data?: {
      rates: ExchangeRate[];
      lastUpdated: string;
    };
    error?: string;
  }> {
    try {
      const now = Date.now();
      const currencies = ['USD', 'EUR', 'GBP', 'JPY'];
      const rates: ExchangeRate[] = [];

      for (const currency of currencies) {
        const cached = this.cache.get(currency);
        
        // Use cache if it's still valid
        if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
          const change = cached.rate - cached.previousRate;
          const changePercent = cached.previousRate > 0 
            ? (change / cached.previousRate) * 100 
            : 0;

          rates.push({
            currency,
            rate: cached.rate,
            change,
            changePercent: parseFloat(changePercent.toFixed(2)),
          });
        } else {
          // Fetch fresh rate
          const rate = await this.fetchExchangeRate(currency);
          
          if (rate !== null) {
            const previousRate = cached?.rate || rate;
            const change = rate - previousRate;
            const changePercent = previousRate > 0 
              ? (change / previousRate) * 100 
              : 0;

            // Update cache
            this.cache.set(currency, {
              rate,
              previousRate,
              timestamp: now,
            });

            rates.push({
              currency,
              rate,
              change,
              changePercent: parseFloat(changePercent.toFixed(2)),
            });
          } else {
            // Fallback to cached data even if expired, or use default
            const fallbackRate = cached?.rate || this.getDefaultRate(currency);
            rates.push({
              currency,
              rate: fallbackRate,
              change: 0,
              changePercent: 0,
            });
          }
        }
      }

      return {
        success: true,
        message: 'Exchange rates retrieved successfully',
        data: {
          rates,
          lastUpdated: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch exchange rates',
        error: error instanceof Error ? error.message : 'Failed to fetch exchange rates',
      };
    }
  }

  /**
   * Fetch exchange rate from external API
   * In production, use a real exchange rate API like CoinGecko, CoinMarketCap, or XRPL's own rates
   */
  private async fetchExchangeRate(currency: string): Promise<number | null> {
    try {
      // Using CoinGecko API as an example
      // In production, you might want to use XRPL's native rates or a more reliable source
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=${currency.toLowerCase()}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch rate for ${currency}`);
      }

      const data = await response.json() as { ripple?: Record<string, number> };
      return data.ripple?.[currency.toLowerCase()] || null;
    } catch (error) {
      console.error(`Error fetching ${currency} rate:`, error);
      return null;
    }
  }

  /**
   * Get default/fallback exchange rate
   */
  private getDefaultRate(currency: string): number {
    const defaults: Record<string, number> = {
      USD: 0.5430,
      EUR: 0.4920,
      GBP: 0.4310,
      JPY: 81.20,
    };
    return defaults[currency] || 0.5;
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const exchangeService = new ExchangeService();


