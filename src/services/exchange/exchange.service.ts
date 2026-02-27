/**
 * Exchange Rate Service
 * Fetches live exchange rates for XRP against major currencies
 * Primary: Binance API (XRP/USDT ≈ USD)
 * Backup: XRPL Price Oracles (placeholder for future implementation)
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
  private readonly CACHE_TTL = 60 * 1000; // 1 minute - keep XRP/USD closer to live
  private readonly MAX_STALE_AGE = 2 * 60 * 1000; // Don't use expired cache older than 2 minutes
  // XRPL server config for future XRPL price oracle implementation
  // private readonly XRPL_NETWORK = process.env.XRPL_NETWORK || 'testnet';
  // private readonly XRPL_SERVER = this.XRPL_NETWORK === 'mainnet'
  //   ? 'wss://xrplcluster.com'
  //   : 'wss://s.altnet.rippletest.net:51233';

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

      // Fetch USD first (required for other currency conversions)
      const usdCurrency = 'USD';
      const usdCached = this.cache.get(usdCurrency);
      
      let usdRate: number | null = null;
      if (usdCached && (now - usdCached.timestamp) < this.CACHE_TTL) {
        usdRate = usdCached.rate;
        rates.push({
          currency: usdCurrency,
          rate: usdCached.rate,
          change: usdCached.rate - usdCached.previousRate,
          changePercent: usdCached.previousRate > 0 
            ? ((usdCached.rate - usdCached.previousRate) / usdCached.previousRate) * 100 
            : 0,
        });
      } else {
        usdRate = await this.fetchExchangeRate(usdCurrency);
        if (usdRate !== null) {
          const previousRate = usdCached?.rate || usdRate;
          this.cache.set(usdCurrency, {
            rate: usdRate,
            previousRate,
            timestamp: now,
          });
          rates.push({
            currency: usdCurrency,
            rate: usdRate,
            change: usdRate - previousRate,
            changePercent: previousRate > 0 ? ((usdRate - previousRate) / previousRate) * 100 : 0,
          });
        } else if (usdCached && (now - usdCached.timestamp) < this.MAX_STALE_AGE) {
          // Use expired cache only if not too old (avoid showing very stale rate)
          usdRate = usdCached.rate;
          rates.push({
            currency: usdCurrency,
            rate: usdCached.rate,
            change: 0,
            changePercent: 0,
          });
        }
      }

      // Process other currencies (EUR, GBP, JPY) which depend on USD
      for (const currency of currencies.filter(c => c !== 'USD')) {
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
          // Convert from USD using fiat exchange rates
          if (!usdRate) {
            // If USD rate is not available, can't convert other currencies
            if (cached) {
              console.log('[DEBUG] getLiveExchangeRates: USD rate not available, using expired cached rate', { currency, cachedRate: cached.rate });
              rates.push({
                currency,
                rate: cached.rate,
                change: 0,
                changePercent: 0,
              });
            } else {
              console.warn(`[WARNING] getLiveExchangeRates: USD rate not available, cannot convert ${currency}, skipping`);
            }
          } else {
            // Fetch fiat exchange rate (USD to target currency)
            const fiatRate = await this.fetchFiatExchangeRate(currency);
            if (fiatRate !== null && fiatRate > 0) {
              const rate = usdRate * fiatRate;
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
              console.log('[DEBUG] getLiveExchangeRates: Converted rate from USD', { currency, usdRate, fiatRate, rate });
            } else if (cached) {
              // Use expired cache if fiat rate fetch fails
              console.log('[DEBUG] getLiveExchangeRates: Fiat rate fetch failed, using expired cached rate', { currency, cachedRate: cached.rate });
              rates.push({
                currency,
                rate: cached.rate,
                change: 0,
                changePercent: 0,
              });
            } else {
              console.warn(`[WARNING] getLiveExchangeRates: Failed to fetch fiat rate for ${currency} and no cached rate available, skipping`);
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
   * Fetch exchange rate from multiple sources (in order of preference)
   * 1. Binance API (primary) - may be geo-blocked in some regions
   * 2. CoinGecko API (alternative) - more widely available
   * 3. CryptoCompare API (alternative) - backup option
   * 4. XRPL price oracles (when configured) - for USD only
   */
  private async fetchExchangeRate(currency: string): Promise<number | null> {
    // Try Binance API first (primary)
    const binanceRate = await this.fetchFromBinance(currency);
    if (binanceRate !== null) {
      return binanceRate;
    }

    // If Binance fails, try CoinGecko (alternative source, not a fallback rate)
    const coinGeckoRate = await this.fetchFromCoinGecko(currency);
    if (coinGeckoRate !== null) {
      return coinGeckoRate;
    }

    // If CoinGecko fails, try CryptoCompare (another alternative source)
    const cryptoCompareRate = await this.fetchFromCryptoCompare(currency);
    if (cryptoCompareRate !== null) {
      return cryptoCompareRate;
    }

    // If all APIs fail and currency is USD, try XRPL price oracles (backup)
    if (currency === 'USD') {
      const xrplRate = await this.fetchFromXRPLOracle('USD');
      if (xrplRate !== null) {
        return xrplRate;
      }
    }

    return null;
  }

  /**
   * Fetch XRP/USDT rate from Binance API (primary source)
   * USDT is treated as USD equivalent (1:1)
   */
  private async fetchFromBinance(currency: string): Promise<number | null> {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:fetchFromBinance',message:'fetchFromBinance: Entry',data:{currency},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      // Binance provides XRP/USDT, which we use as USD equivalent
      // For other currencies, we'll need to convert from USD
      if (currency === 'USD') {
        const url = 'https://api.binance.com/api/v3/ticker/price?symbol=XRPUSDT';
        console.log('[DEBUG] fetchFromBinance: Fetching XRP/USDT from Binance', { currency, url });
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:fetchFromBinance',message:'fetchFromBinance: Response received',data:{currency,status:response.status,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        if (!response.ok) {
          let errorBody = '';
          try {
            errorBody = await response.text();
            console.log('[DEBUG] fetchFromBinance: Response not OK', { 
              currency, 
              status: response.status, 
              statusText: response.statusText,
              errorBody 
            });
          } catch (e) {
            console.log('[DEBUG] fetchFromBinance: Response not OK (could not read body)', { 
              currency, 
              status: response.status, 
              statusText: response.statusText 
            });
          }
          return null;
        }

        const data = await response.json() as { symbol: string; price: string };
        console.log('[DEBUG] fetchFromBinance: Parsed response data', { currency, data, dataType: typeof data, hasPrice: 'price' in data });
        
        const rate = parseFloat(data.price);
        console.log('[DEBUG] fetchFromBinance: Parsed rate', { currency, priceString: data.price, rate, isNaN: isNaN(rate) });
        
        if (isNaN(rate) || rate <= 0) {
          console.warn('[WARNING] fetchFromBinance: Invalid rate returned', { currency, rate, data, isNaN: isNaN(rate), isPositive: rate > 0 });
          return null;
        }

        console.log('[DEBUG] fetchFromBinance: Success', { currency, rate, symbol: data.symbol });
        return rate;
      } else {
        // For non-USD currencies, we'll convert from USD using fiat exchange rates
        // This method will be called after USD is fetched
        return null;
      }
    } catch (error) {
      // #region agent log
      const errorData = error instanceof Error ? {message:error.message,stack:error.stack,name:error.name} : {error:String(error)};
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:fetchFromBinance',message:'fetchFromBinance: Error',data:{currency,errorData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.log('[DEBUG] fetchFromBinance: Error', {
        currency,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch XRP/USD rate from XRPL price oracles (backup for USD)
   */
  private async fetchFromXRPLOracle(currency: string): Promise<number | null> {
    // Only use XRPL oracles for USD
    if (currency !== 'USD') {
      return null;
    }

    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:fetchFromXRPLOracle',message:'fetchFromXRPLOracle: Entry',data:{currency},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      console.log('[DEBUG] fetchFromXRPLOracle: Attempting to fetch from XRPL price oracles', { currency });
      
      // Note: XRPL price oracles require oracle account addresses and document IDs
      // This is a simplified implementation - in production, you'd need to maintain
      // a list of trusted oracle accounts
      // For now, we'll skip XRPL oracles as they require setup
      // TODO: Implement XRPL price oracle support when oracle accounts are configured
      
      console.log('[DEBUG] fetchFromXRPLOracle: XRPL oracles not yet configured, skipping');
      return null;
      
      /* Future implementation:
      const client = new Client(this.XRPL_SERVER);
      await client.connect();
      
      try {
        // You'll need to provide oracle account addresses and document IDs
        const request = {
          command: 'get_aggregate_price',
          base_asset: 'XRP',
          quote_asset: 'USD',
          oracles: [
            // Add trusted oracle accounts here
          ],
        };
        
        const response = await client.request(request);
        await client.disconnect();
        
        // Extract mean price from aggregate response
        const meanPrice = response.result?.mean;
        if (meanPrice && meanPrice > 0) {
          return parseFloat(meanPrice);
        }
      } catch (oracleError) {
        await client.disconnect();
        throw oracleError;
      }
      */
    } catch (error) {
      // #region agent log
      const errorData = error instanceof Error ? {message:error.message,stack:error.stack,name:error.name} : {error:String(error)};
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'exchange.service.ts:fetchFromXRPLOracle',message:'fetchFromXRPLOracle: Error',data:{currency,errorData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.log('[DEBUG] fetchFromXRPLOracle: Error', {
        currency,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch XRP rate from CoinGecko API (alternative source when Binance is blocked)
   */
  private async fetchFromCoinGecko(currency: string): Promise<number | null> {
    try {
      console.log('[DEBUG] fetchFromCoinGecko: Attempting to fetch from CoinGecko', { currency });
      
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=${currency.toLowerCase()}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.log('[DEBUG] fetchFromCoinGecko: Response not OK', { 
          currency, 
          status: response.status, 
          statusText: response.statusText 
        });
        return null;
      }

      const data = await response.json() as { ripple?: Record<string, number> };
      const rate = data.ripple?.[currency.toLowerCase()] || null;
      
      if (rate !== null && rate > 0) {
        console.log('[DEBUG] fetchFromCoinGecko: Success', { currency, rate });
        return rate;
      }

      console.log('[DEBUG] fetchFromCoinGecko: Invalid or missing rate', { currency, data, rate });
      return null;
    } catch (error) {
      console.log('[DEBUG] fetchFromCoinGecko: Error', {
        currency,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch XRP rate from CryptoCompare API (another alternative source)
   */
  private async fetchFromCryptoCompare(currency: string): Promise<number | null> {
    try {
      console.log('[DEBUG] fetchFromCryptoCompare: Attempting to fetch from CryptoCompare', { currency });
      
      // CryptoCompare free tier: https://min-api.cryptocompare.com/
      // Note: For production, you might want to use an API key for higher rate limits
      const url = `https://min-api.cryptocompare.com/data/price?fsym=XRP&tsyms=${currency}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.log('[DEBUG] fetchFromCryptoCompare: Response not OK', { 
          currency, 
          status: response.status, 
          statusText: response.statusText 
        });
        return null;
      }

      const data = await response.json() as Record<string, number>;
      const rate = data[currency];
      
      if (rate && rate > 0) {
        console.log('[DEBUG] fetchFromCryptoCompare: Success', { currency, rate });
        return rate;
      }

      console.log('[DEBUG] fetchFromCryptoCompare: Invalid or missing rate', { currency, data, rate });
      return null;
    } catch (error) {
      console.log('[DEBUG] fetchFromCryptoCompare: Error', {
        currency,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch fiat currency exchange rate (EUR, GBP, JPY) relative to USD
   * Used to convert XRP/USD to XRP/EUR, XRP/GBP, XRP/JPY
   */
  private async fetchFiatExchangeRate(currency: string): Promise<number | null> {
    try {
      // Using exchangerate-api.com free tier (no API key needed for basic usage)
      // Alternatively, you could use fixer.io, exchangeratesapi.io, or similar
      const url = `https://api.exchangerate-api.com/v4/latest/USD`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json() as { rates: Record<string, number> };
      const rate = data.rates[currency];
      
      if (!rate || rate <= 0) {
        return null;
      }

      return rate;
    } catch (error) {
      console.log('[DEBUG] fetchFiatExchangeRate: Error', {
        currency,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
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






