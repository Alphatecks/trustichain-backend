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
      console.log('[DEBUG] getLiveExchangeRates: Starting');
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
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:58',message:'getLiveExchangeRates: Fetching rate',data:{currency,hasCached:!!cached,cachedRate:cached?.rate},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          console.log('[DEBUG] getLiveExchangeRates fetching rate:', { currency, hasCached: !!cached, cachedRate: cached?.rate });
          const rate = await this.fetchExchangeRate(currency);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:61',message:'getLiveExchangeRates: Rate fetched',data:{currency,rate,isNull:rate===null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          console.log('[DEBUG] getLiveExchangeRates rate fetched:', { currency, rate, isNull: rate === null });
          
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
            console.log('[DEBUG] getLiveExchangeRates using fetched rate:', { currency, rate });
          } else {
            // If rate fetch fails, use cached rate if available (even if expired)
            // Otherwise, skip this currency - no fallback rates
            if (cached) {
              console.log('[DEBUG] getLiveExchangeRates: Rate fetch failed, using expired cached rate', { currency, cachedRate: cached.rate });
              rates.push({
                currency,
                rate: cached.rate,
                change: 0,
                changePercent: 0,
              });
            } else {
              console.warn(`[WARNING] getLiveExchangeRates: Failed to fetch rate for ${currency} and no cached rate available, skipping`);
            }
          }
        }
      }

      console.log('[DEBUG] getLiveExchangeRates: Success', { ratesCount: rates.length, rates });
      return {
        success: true,
        message: 'Exchange rates retrieved successfully',
        data: {
          rates,
          lastUpdated: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('[DEBUG] getLiveExchangeRates: Error in outer catch', {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:116',message:'fetchExchangeRate: Entry',data:{currency},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // Using CoinGecko API as an example
      // In production, you might want to use XRPL's native rates or a more reliable source
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=${currency.toLowerCase()}`;
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:121',message:'fetchExchangeRate: Before fetch',data:{currency,url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const response = await fetch(url);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:124',message:'fetchExchangeRate: After fetch',data:{currency,status:response.status,statusText:response.statusText,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // Log for Render debugging
      console.log('[DEBUG] fetchExchangeRate response:', {
        currency,
        url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries()),
      });

      if (!response.ok) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:127',message:'fetchExchangeRate: Response not OK',data:{currency,status:response.status,statusText:response.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        // Log error response body for debugging
        let errorBody = '';
        try {
          errorBody = await response.text();
          console.log('[DEBUG] fetchExchangeRate error response body:', { currency, status: response.status, body: errorBody });
        } catch (e) {
          console.log('[DEBUG] fetchExchangeRate could not read error body:', { currency, status: response.status });
        }
        // Return null if API fails
        return null;
      }

      const data = await response.json() as { ripple?: Record<string, number> };
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:132',message:'fetchExchangeRate: Parsed response',data:{currency,hasRipple:!!data.ripple,rate:data.ripple?.[currency.toLowerCase()]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const rate = data.ripple?.[currency.toLowerCase()] || null;
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:135',message:'fetchExchangeRate: Returning rate',data:{currency,rate},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.log('[DEBUG] fetchExchangeRate success:', { currency, rate, data });
      return rate;
    } catch (error) {
      // #region agent log
      const errorData = error instanceof Error ? {message:error.message,stack:error.stack,name:error.name} : {error:String(error)};
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:137',message:'fetchExchangeRate: Catch block',data:{currency,errorData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      // Log error details for Render debugging
      console.log('[DEBUG] fetchExchangeRate catch:', {
        currency,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      // Return null if fetch fails
      return null;
    }
  }


  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const exchangeService = new ExchangeService();






