"use strict";
/**
 * Exchange Rate Service
 * Fetches live exchange rates for XRP against major currencies
 * Primary: Binance API (XRP/USDT ≈ USD)
 * Backup: XRPL Price Oracles (placeholder for future implementation)
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exchangeService = exports.ExchangeService = void 0;
var ExchangeService = /** @class */ (function () {
    function ExchangeService() {
        this.cache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    }
    // XRPL server config for future XRPL price oracle implementation
    // private readonly XRPL_NETWORK = process.env.XRPL_NETWORK || 'testnet';
    // private readonly XRPL_SERVER = this.XRPL_NETWORK === 'mainnet'
    //   ? 'wss://xrplcluster.com'
    //   : 'wss://s.altnet.rippletest.net:51233';
    /**
     * Get live exchange rates for XRP against USD, EUR, GBP, JPY
     * Uses cached data if available and fresh
     */
    ExchangeService.prototype.getLiveExchangeRates = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, currencies, rates, usdCurrency, usdCached, usdRate, previousRate, _i, _a, currency, cached, change, changePercent, fiatRate, rate, previousRate, change, changePercent, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 10, , 11]);
                        console.log('[DEBUG] getLiveExchangeRates: Starting');
                        now = Date.now();
                        currencies = ['USD', 'EUR', 'GBP', 'JPY'];
                        rates = [];
                        usdCurrency = 'USD';
                        usdCached = this.cache.get(usdCurrency);
                        usdRate = null;
                        if (!(usdCached && (now - usdCached.timestamp) < this.CACHE_TTL)) return [3 /*break*/, 1];
                        usdRate = usdCached.rate;
                        rates.push({
                            currency: usdCurrency,
                            rate: usdCached.rate,
                            change: usdCached.rate - usdCached.previousRate,
                            changePercent: usdCached.previousRate > 0
                                ? ((usdCached.rate - usdCached.previousRate) / usdCached.previousRate) * 100
                                : 0,
                        });
                        return [3 /*break*/, 3];
                    case 1: return [4 /*yield*/, this.fetchExchangeRate(usdCurrency)];
                    case 2:
                        usdRate = _b.sent();
                        if (usdRate !== null) {
                            previousRate = (usdCached === null || usdCached === void 0 ? void 0 : usdCached.rate) || usdRate;
                            this.cache.set(usdCurrency, {
                                rate: usdRate,
                                previousRate: previousRate,
                                timestamp: now,
                            });
                            rates.push({
                                currency: usdCurrency,
                                rate: usdRate,
                                change: usdRate - previousRate,
                                changePercent: previousRate > 0 ? ((usdRate - previousRate) / previousRate) * 100 : 0,
                            });
                        }
                        else if (usdCached) {
                            // Use expired cache if fetch fails
                            usdRate = usdCached.rate;
                            rates.push({
                                currency: usdCurrency,
                                rate: usdCached.rate,
                                change: 0,
                                changePercent: 0,
                            });
                        }
                        _b.label = 3;
                    case 3:
                        _i = 0, _a = currencies.filter(function (c) { return c !== 'USD'; });
                        _b.label = 4;
                    case 4:
                        if (!(_i < _a.length)) return [3 /*break*/, 9];
                        currency = _a[_i];
                        cached = this.cache.get(currency);
                        if (!(cached && (now - cached.timestamp) < this.CACHE_TTL)) return [3 /*break*/, 5];
                        change = cached.rate - cached.previousRate;
                        changePercent = cached.previousRate > 0
                            ? (change / cached.previousRate) * 100
                            : 0;
                        rates.push({
                            currency: currency,
                            rate: cached.rate,
                            change: change,
                            changePercent: parseFloat(changePercent.toFixed(2)),
                        });
                        return [3 /*break*/, 8];
                    case 5:
                        if (!!usdRate) return [3 /*break*/, 6];
                        // If USD rate is not available, can't convert other currencies
                        if (cached) {
                            console.log('[DEBUG] getLiveExchangeRates: USD rate not available, using expired cached rate', { currency: currency, cachedRate: cached.rate });
                            rates.push({
                                currency: currency,
                                rate: cached.rate,
                                change: 0,
                                changePercent: 0,
                            });
                        }
                        else {
                            console.warn("[WARNING] getLiveExchangeRates: USD rate not available, cannot convert ".concat(currency, ", skipping"));
                        }
                        return [3 /*break*/, 8];
                    case 6: return [4 /*yield*/, this.fetchFiatExchangeRate(currency)];
                    case 7:
                        fiatRate = _b.sent();
                        if (fiatRate !== null && fiatRate > 0) {
                            rate = usdRate * fiatRate;
                            previousRate = (cached === null || cached === void 0 ? void 0 : cached.rate) || rate;
                            change = rate - previousRate;
                            changePercent = previousRate > 0
                                ? (change / previousRate) * 100
                                : 0;
                            // Update cache
                            this.cache.set(currency, {
                                rate: rate,
                                previousRate: previousRate,
                                timestamp: now,
                            });
                            rates.push({
                                currency: currency,
                                rate: rate,
                                change: change,
                                changePercent: parseFloat(changePercent.toFixed(2)),
                            });
                            console.log('[DEBUG] getLiveExchangeRates: Converted rate from USD', { currency: currency, usdRate: usdRate, fiatRate: fiatRate, rate: rate });
                        }
                        else if (cached) {
                            // Use expired cache if fiat rate fetch fails
                            console.log('[DEBUG] getLiveExchangeRates: Fiat rate fetch failed, using expired cached rate', { currency: currency, cachedRate: cached.rate });
                            rates.push({
                                currency: currency,
                                rate: cached.rate,
                                change: 0,
                                changePercent: 0,
                            });
                        }
                        else {
                            console.warn("[WARNING] getLiveExchangeRates: Failed to fetch fiat rate for ".concat(currency, " and no cached rate available, skipping"));
                        }
                        _b.label = 8;
                    case 8:
                        _i++;
                        return [3 /*break*/, 4];
                    case 9:
                        console.log('[DEBUG] getLiveExchangeRates: Success', { ratesCount: rates.length, rates: rates });
                        return [2 /*return*/, {
                                success: true,
                                message: 'Exchange rates retrieved successfully',
                                data: {
                                    rates: rates,
                                    lastUpdated: new Date().toISOString(),
                                },
                            }];
                    case 10:
                        error_1 = _b.sent();
                        console.error('[DEBUG] getLiveExchangeRates: Error in outer catch', {
                            errorMessage: error_1 instanceof Error ? error_1.message : String(error_1),
                            errorStack: error_1 instanceof Error ? error_1.stack : undefined,
                        });
                        return [2 /*return*/, {
                                success: false,
                                message: error_1 instanceof Error ? error_1.message : 'Failed to fetch exchange rates',
                                error: error_1 instanceof Error ? error_1.message : 'Failed to fetch exchange rates',
                            }];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetch exchange rate from multiple sources (in order of preference)
     * 1. Binance API (primary) - may be geo-blocked in some regions
     * 2. CoinGecko API (alternative) - more widely available
     * 3. CryptoCompare API (alternative) - backup option
     * 4. XRPL price oracles (when configured) - for USD only
     */
    ExchangeService.prototype.fetchExchangeRate = function (currency) {
        return __awaiter(this, void 0, void 0, function () {
            var binanceRate, coinGeckoRate, cryptoCompareRate, xrplRate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetchFromBinance(currency)];
                    case 1:
                        binanceRate = _a.sent();
                        if (binanceRate !== null) {
                            return [2 /*return*/, binanceRate];
                        }
                        return [4 /*yield*/, this.fetchFromCoinGecko(currency)];
                    case 2:
                        coinGeckoRate = _a.sent();
                        if (coinGeckoRate !== null) {
                            return [2 /*return*/, coinGeckoRate];
                        }
                        return [4 /*yield*/, this.fetchFromCryptoCompare(currency)];
                    case 3:
                        cryptoCompareRate = _a.sent();
                        if (cryptoCompareRate !== null) {
                            return [2 /*return*/, cryptoCompareRate];
                        }
                        if (!(currency === 'USD')) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.fetchFromXRPLOracle('USD')];
                    case 4:
                        xrplRate = _a.sent();
                        if (xrplRate !== null) {
                            return [2 /*return*/, xrplRate];
                        }
                        _a.label = 5;
                    case 5: return [2 /*return*/, null];
                }
            });
        });
    };
    /**
     * Fetch XRP/USDT rate from Binance API (primary source)
     * USDT is treated as USD equivalent (1:1)
     */
    ExchangeService.prototype.fetchFromBinance = function (currency) {
        return __awaiter(this, void 0, void 0, function () {
            var url, response, errorBody, e_1, data, rate, error_2, errorData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 10, , 11]);
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'exchange.service.ts:fetchFromBinance', message: 'fetchFromBinance: Entry', data: { currency: currency }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        if (!(currency === 'USD')) return [3 /*break*/, 8];
                        url = 'https://api.binance.com/api/v3/ticker/price?symbol=XRPUSDT';
                        console.log('[DEBUG] fetchFromBinance: Fetching XRP/USDT from Binance', { currency: currency, url: url });
                        return [4 /*yield*/, fetch(url, {
                                method: 'GET',
                                headers: {
                                    'Accept': 'application/json',
                                },
                            })];
                    case 1:
                        response = _a.sent();
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'exchange.service.ts:fetchFromBinance', message: 'fetchFromBinance: Response received', data: { currency: currency, status: response.status, ok: response.ok }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        if (!!response.ok) return [3 /*break*/, 6];
                        errorBody = '';
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, response.text()];
                    case 3:
                        errorBody = _a.sent();
                        console.log('[DEBUG] fetchFromBinance: Response not OK', {
                            currency: currency,
                            status: response.status,
                            statusText: response.statusText,
                            errorBody: errorBody
                        });
                        return [3 /*break*/, 5];
                    case 4:
                        e_1 = _a.sent();
                        console.log('[DEBUG] fetchFromBinance: Response not OK (could not read body)', {
                            currency: currency,
                            status: response.status,
                            statusText: response.statusText
                        });
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/, null];
                    case 6: return [4 /*yield*/, response.json()];
                    case 7:
                        data = _a.sent();
                        console.log('[DEBUG] fetchFromBinance: Parsed response data', { currency: currency, data: data, dataType: typeof data, hasPrice: 'price' in data });
                        rate = parseFloat(data.price);
                        console.log('[DEBUG] fetchFromBinance: Parsed rate', { currency: currency, priceString: data.price, rate: rate, isNaN: isNaN(rate) });
                        if (isNaN(rate) || rate <= 0) {
                            console.warn('[WARNING] fetchFromBinance: Invalid rate returned', { currency: currency, rate: rate, data: data, isNaN: isNaN(rate), isPositive: rate > 0 });
                            return [2 /*return*/, null];
                        }
                        console.log('[DEBUG] fetchFromBinance: Success', { currency: currency, rate: rate, symbol: data.symbol });
                        return [2 /*return*/, rate];
                    case 8: 
                    // For non-USD currencies, we'll convert from USD using fiat exchange rates
                    // This method will be called after USD is fetched
                    return [2 /*return*/, null];
                    case 9: return [3 /*break*/, 11];
                    case 10:
                        error_2 = _a.sent();
                        errorData = error_2 instanceof Error ? { message: error_2.message, stack: error_2.stack, name: error_2.name } : { error: String(error_2) };
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'exchange.service.ts:fetchFromBinance', message: 'fetchFromBinance: Error', data: { currency: currency, errorData: errorData }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        // #endregion
                        console.log('[DEBUG] fetchFromBinance: Error', {
                            currency: currency,
                            errorMessage: error_2 instanceof Error ? error_2.message : String(error_2),
                        });
                        return [2 /*return*/, null];
                    case 11: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetch XRP/USD rate from XRPL price oracles (backup for USD)
     */
    ExchangeService.prototype.fetchFromXRPLOracle = function (currency) {
        return __awaiter(this, void 0, void 0, function () {
            var errorData;
            return __generator(this, function (_a) {
                // Only use XRPL oracles for USD
                if (currency !== 'USD') {
                    return [2 /*return*/, null];
                }
                try {
                    // #region agent log
                    fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'exchange.service.ts:fetchFromXRPLOracle', message: 'fetchFromXRPLOracle: Entry', data: { currency: currency }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                    // #endregion
                    console.log('[DEBUG] fetchFromXRPLOracle: Attempting to fetch from XRPL price oracles', { currency: currency });
                    // Note: XRPL price oracles require oracle account addresses and document IDs
                    // This is a simplified implementation - in production, you'd need to maintain
                    // a list of trusted oracle accounts
                    // For now, we'll skip XRPL oracles as they require setup
                    // TODO: Implement XRPL price oracle support when oracle accounts are configured
                    console.log('[DEBUG] fetchFromXRPLOracle: XRPL oracles not yet configured, skipping');
                    return [2 /*return*/, null];
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
                }
                catch (error) {
                    errorData = error instanceof Error ? { message: error.message, stack: error.stack, name: error.name } : { error: String(error) };
                    fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'exchange.service.ts:fetchFromXRPLOracle', message: 'fetchFromXRPLOracle: Error', data: { currency: currency, errorData: errorData }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                    // #endregion
                    console.log('[DEBUG] fetchFromXRPLOracle: Error', {
                        currency: currency,
                        errorMessage: error instanceof Error ? error.message : String(error),
                    });
                    return [2 /*return*/, null];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Fetch XRP rate from CoinGecko API (alternative source when Binance is blocked)
     */
    ExchangeService.prototype.fetchFromCoinGecko = function (currency) {
        return __awaiter(this, void 0, void 0, function () {
            var url, response, data, rate, error_3;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        console.log('[DEBUG] fetchFromCoinGecko: Attempting to fetch from CoinGecko', { currency: currency });
                        url = "https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=".concat(currency.toLowerCase());
                        return [4 /*yield*/, fetch(url, {
                                method: 'GET',
                                headers: {
                                    'Accept': 'application/json',
                                },
                            })];
                    case 1:
                        response = _b.sent();
                        if (!response.ok) {
                            console.log('[DEBUG] fetchFromCoinGecko: Response not OK', {
                                currency: currency,
                                status: response.status,
                                statusText: response.statusText
                            });
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _b.sent();
                        rate = ((_a = data.ripple) === null || _a === void 0 ? void 0 : _a[currency.toLowerCase()]) || null;
                        if (rate !== null && rate > 0) {
                            console.log('[DEBUG] fetchFromCoinGecko: Success', { currency: currency, rate: rate });
                            return [2 /*return*/, rate];
                        }
                        console.log('[DEBUG] fetchFromCoinGecko: Invalid or missing rate', { currency: currency, data: data, rate: rate });
                        return [2 /*return*/, null];
                    case 3:
                        error_3 = _b.sent();
                        console.log('[DEBUG] fetchFromCoinGecko: Error', {
                            currency: currency,
                            errorMessage: error_3 instanceof Error ? error_3.message : String(error_3),
                        });
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetch XRP rate from CryptoCompare API (another alternative source)
     */
    ExchangeService.prototype.fetchFromCryptoCompare = function (currency) {
        return __awaiter(this, void 0, void 0, function () {
            var url, response, data, rate, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        console.log('[DEBUG] fetchFromCryptoCompare: Attempting to fetch from CryptoCompare', { currency: currency });
                        url = "https://min-api.cryptocompare.com/data/price?fsym=XRP&tsyms=".concat(currency);
                        return [4 /*yield*/, fetch(url, {
                                method: 'GET',
                                headers: {
                                    'Accept': 'application/json',
                                },
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            console.log('[DEBUG] fetchFromCryptoCompare: Response not OK', {
                                currency: currency,
                                status: response.status,
                                statusText: response.statusText
                            });
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        rate = data[currency];
                        if (rate && rate > 0) {
                            console.log('[DEBUG] fetchFromCryptoCompare: Success', { currency: currency, rate: rate });
                            return [2 /*return*/, rate];
                        }
                        console.log('[DEBUG] fetchFromCryptoCompare: Invalid or missing rate', { currency: currency, data: data, rate: rate });
                        return [2 /*return*/, null];
                    case 3:
                        error_4 = _a.sent();
                        console.log('[DEBUG] fetchFromCryptoCompare: Error', {
                            currency: currency,
                            errorMessage: error_4 instanceof Error ? error_4.message : String(error_4),
                        });
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fetch fiat currency exchange rate (EUR, GBP, JPY) relative to USD
     * Used to convert XRP/USD to XRP/EUR, XRP/GBP, XRP/JPY
     */
    ExchangeService.prototype.fetchFiatExchangeRate = function (currency) {
        return __awaiter(this, void 0, void 0, function () {
            var url, response, data, rate, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        url = "https://api.exchangerate-api.com/v4/latest/USD";
                        return [4 /*yield*/, fetch(url)];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _a.sent();
                        rate = data.rates[currency];
                        if (!rate || rate <= 0) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, rate];
                    case 3:
                        error_5 = _a.sent();
                        console.log('[DEBUG] fetchFiatExchangeRate: Error', {
                            currency: currency,
                            errorMessage: error_5 instanceof Error ? error_5.message : String(error_5),
                        });
                        return [2 /*return*/, null];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clear cache (useful for testing or forced refresh)
     */
    ExchangeService.prototype.clearCache = function () {
        this.cache.clear();
    };
    return ExchangeService;
}());
exports.ExchangeService = ExchangeService;
exports.exchangeService = new ExchangeService();
