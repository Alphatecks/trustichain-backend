"use strict";
/**
 * Exchange Rate Service
 * Fetches live exchange rates for XRP against major currencies
 * XRP/USD: Coinbase spot API only (https://api.coinbase.com/v2/prices/XRP-USD/spot)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeService = exports.ExchangeService = void 0;
class ExchangeService {
    constructor() {
        this.cache = new Map();
        this.CACHE_TTL = 60 * 1000; // 1 minute - keep XRP/USD closer to live
        this.MAX_STALE_AGE = 2 * 60 * 1000; // Don't use expired cache older than 2 minutes
    }
    /**
     * Get live exchange rates for XRP against USD, EUR, GBP, JPY
     * Uses cached data if available and fresh
     */
    async getLiveExchangeRates() {
        try {
            console.log('[DEBUG] getLiveExchangeRates: Starting');
            const now = Date.now();
            const currencies = ['USD', 'EUR', 'GBP', 'JPY'];
            const rates = [];
            // Fetch USD first (required for other currency conversions)
            const usdCurrency = 'USD';
            const usdCached = this.cache.get(usdCurrency);
            let usdRate = null;
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
            }
            else {
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
                }
                else if (usdCached && (now - usdCached.timestamp) < this.MAX_STALE_AGE) {
                    // Use expired cache only if not too old (avoid showing very stale rate)
                    usdRate = usdCached.rate;
                    rates.push({
                        currency: usdCurrency,
                        rate: usdCached.rate,
                        change: 0,
                        changePercent: 0,
                    });
                }
                else if (usdCurrency === 'USD') {
                    // When Coinbase is unavailable, optional env fallback so balance USD still displays (e.g. on Render).
                    const fallback = process.env.FALLBACK_XRP_USD_RATE;
                    const fallbackRate = fallback != null ? parseFloat(fallback) : NaN;
                    if (Number.isFinite(fallbackRate) && fallbackRate > 0) {
                        usdRate = fallbackRate;
                        rates.push({
                            currency: usdCurrency,
                            rate: fallbackRate,
                            change: 0,
                            changePercent: 0,
                        });
                        console.warn('[Exchange] Using FALLBACK_XRP_USD_RATE (Coinbase unavailable)', {
                            rate: fallbackRate,
                            hint: 'Set FALLBACK_XRP_USD_RATE in Render env to a rough XRP/USD value; update periodically.',
                        });
                    }
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
                }
                else {
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
                        }
                        else {
                            console.warn(`[WARNING] getLiveExchangeRates: USD rate not available, cannot convert ${currency}, skipping`);
                        }
                    }
                    else {
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
                        }
                        else if (cached) {
                            // Use expired cache if fiat rate fetch fails
                            console.log('[DEBUG] getLiveExchangeRates: Fiat rate fetch failed, using expired cached rate', { currency, cachedRate: cached.rate });
                            rates.push({
                                currency,
                                rate: cached.rate,
                                change: 0,
                                changePercent: 0,
                            });
                        }
                        else {
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
        }
        catch (error) {
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
     * Fetch XRP spot price vs USD from Coinbase (sole live source for XRP/USD).
     */
    async fetchExchangeRate(currency) {
        if (currency !== 'USD') {
            return null;
        }
        return this.fetchFromCoinbase();
    }
    /**
     * Coinbase public API: XRP-USD spot price (1 XRP in USD).
     * @see https://docs.cloud.coinbase.com/sign-in-with-coinbase/docs/api-prices#get-spot-price
     */
    async fetchFromCoinbase() {
        try {
            const url = 'https://api.coinbase.com/v2/prices/XRP-USD/spot';
            console.log('[DEBUG] fetchFromCoinbase: Fetching XRP/USD spot from Coinbase', { url });
            const response = await fetch(url, {
                method: 'GET',
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                let errorBody = '';
                try {
                    errorBody = await response.text();
                    console.log('[DEBUG] fetchFromCoinbase: Response not OK', {
                        status: response.status,
                        statusText: response.statusText,
                        errorBody,
                    });
                }
                catch {
                    console.log('[DEBUG] fetchFromCoinbase: Response not OK (could not read body)', {
                        status: response.status,
                        statusText: response.statusText,
                    });
                }
                return null;
            }
            const data = await response.json();
            const amountStr = data.data?.amount;
            const rate = amountStr != null ? parseFloat(amountStr) : NaN;
            if (isNaN(rate) || rate <= 0) {
                console.warn('[WARNING] fetchFromCoinbase: Invalid rate', { data, rate });
                return null;
            }
            console.log('[DEBUG] fetchFromCoinbase: Success', { rate });
            return rate;
        }
        catch (error) {
            console.log('[DEBUG] fetchFromCoinbase: Error', {
                errorMessage: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    /**
     * Fetch fiat currency exchange rate (EUR, GBP, JPY) relative to USD
     * Used to convert XRP/USD to XRP/EUR, XRP/GBP, XRP/JPY
     */
    async fetchFiatExchangeRate(currency) {
        try {
            // Using exchangerate-api.com free tier (no API key needed for basic usage)
            // Alternatively, you could use fixer.io, exchangeratesapi.io, or similar
            const url = `https://api.exchangerate-api.com/v4/latest/USD`;
            const response = await fetch(url);
            if (!response.ok) {
                return null;
            }
            const data = await response.json();
            const rate = data.rates[currency];
            if (!rate || rate <= 0) {
                return null;
            }
            return rate;
        }
        catch (error) {
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
    clearCache() {
        this.cache.clear();
    }
}
exports.ExchangeService = ExchangeService;
exports.exchangeService = new ExchangeService();
//# sourceMappingURL=exchange.service.js.map