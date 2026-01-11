"use strict";
/**
 * XRPL DEX Service
 * Handles decentralized exchange operations on XRPL
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
exports.xrplDexService = exports.XRPLDEXService = void 0;
var xrpl_1 = require("xrpl");
var XRPLDEXService = /** @class */ (function () {
    function XRPLDEXService() {
        this.XRPL_NETWORK = process.env.XRPL_NETWORK || 'testnet';
        this.XRPL_SERVER = this.XRPL_NETWORK === 'mainnet'
            ? 'wss://xrplcluster.com'
            : 'wss://s.altnet.rippletest.net:51233';
        // Issuer addresses (same as in xrpl-wallet.service.ts)
        this.USDT_ISSUER = this.XRPL_NETWORK === 'mainnet'
            ? 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B' // Tether USDT mainnet
            : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // Testnet
        this.USDC_ISSUER = this.XRPL_NETWORK === 'mainnet'
            ? 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY' // Circle USDC mainnet
            : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // Testnet
    }
    /**
     * Get issuer address for a currency
     */
    XRPLDEXService.prototype.getIssuer = function (currency) {
        return currency === 'USDT' ? this.USDT_ISSUER : this.USDC_ISSUER;
    };
    /**
     * Check if user has trust line for a token
     */
    XRPLDEXService.prototype.hasTrustLine = function (xrplAddress, currency) {
        return __awaiter(this, void 0, void 0, function () {
            var client, issuer, accountLines, lines, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 7]);
                        return [4 /*yield*/, client.connect()];
                    case 2:
                        _a.sent();
                        issuer = this.getIssuer(currency);
                        return [4 /*yield*/, client.request({
                                command: 'account_lines',
                                account: xrplAddress,
                                ledger_index: 'validated',
                                peer: issuer,
                            })];
                    case 3:
                        accountLines = _a.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 4:
                        _a.sent();
                        lines = accountLines.result.lines || [];
                        return [2 /*return*/, lines.length > 0 && (parseFloat(lines[0].balance) !== 0 || parseFloat(lines[0].limit) > 0)];
                    case 5:
                        error_1 = _a.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 6:
                        _a.sent();
                        console.error("Error checking trust line for ".concat(currency, ":"), error_1);
                        return [2 /*return*/, false];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get current price from DEX orderbook
     */
    XRPLDEXService.prototype.getDEXPrice = function (fromCurrency, toCurrency, amount) {
        return __awaiter(this, void 0, void 0, function () {
            var client, fromIssuer, toIssuer, step1, remainingAmount_1, totalXrp, _i, _a, offer, takerPays_1, takerGets_1, offerAmount, offerXrp, dropsStr, rate, step2, remainingXrp, totalTokens, _b, _c, offer, takerPays_2, takerGets_2, offerXrp, dropsStr, offerTokens, rate, takerGets, takerPays, issuer, issuer, orderbook, remainingAmount, totalReceived, _d, _e, offer, takerPays_3, takerGets_3, offerXrp, dropsStr, offerTokens, rate, offerTokens, offerXrp, dropsStr, rate, error_2;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 21, , 23]);
                        return [4 /*yield*/, client.connect()];
                    case 2:
                        _f.sent();
                        if (!(fromCurrency !== 'XRP' && toCurrency !== 'XRP')) return [3 /*break*/, 14];
                        fromIssuer = this.getIssuer(fromCurrency);
                        toIssuer = this.getIssuer(toCurrency);
                        return [4 /*yield*/, client.request({
                                command: 'book_offers',
                                taker_gets: { currency: 'XRP' },
                                taker_pays: {
                                    currency: 'USD',
                                    issuer: fromIssuer,
                                },
                                limit: 10,
                            })];
                    case 3:
                        step1 = _f.sent();
                        if (!(!step1.result.offers || step1.result.offers.length === 0)) return [3 /*break*/, 5];
                        return [4 /*yield*/, client.disconnect()];
                    case 4:
                        _f.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: "No liquidity available for ".concat(fromCurrency, "/XRP"),
                            }];
                    case 5:
                        remainingAmount_1 = amount;
                        totalXrp = 0;
                        for (_i = 0, _a = step1.result.offers; _i < _a.length; _i++) {
                            offer = _a[_i];
                            takerPays_1 = offer.TakerPays;
                            takerGets_1 = offer.TakerGets;
                            offerAmount = typeof takerPays_1 === 'string' ? parseFloat(takerPays_1) : parseFloat(takerPays_1.value);
                            offerXrp = 0;
                            if (typeof takerGets_1 === 'string') {
                                dropsStr = String(takerGets_1);
                                offerXrp = parseFloat(xrpl_1.dropsToXrp(dropsStr));
                            }
                            rate = offerXrp / offerAmount;
                            if (remainingAmount_1 <= offerAmount) {
                                totalXrp += remainingAmount_1 * rate;
                                remainingAmount_1 = 0;
                                break;
                            }
                            else {
                                totalXrp += offerXrp;
                                remainingAmount_1 -= offerAmount;
                            }
                        }
                        if (!(remainingAmount_1 > 0)) return [3 /*break*/, 7];
                        return [4 /*yield*/, client.disconnect()];
                    case 6:
                        _f.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: "Insufficient liquidity for ".concat(fromCurrency, "/XRP. Available: ").concat(amount - remainingAmount_1),
                            }];
                    case 7: return [4 /*yield*/, client.request({
                            command: 'book_offers',
                            taker_gets: {
                                currency: 'USD',
                                issuer: toIssuer,
                            },
                            taker_pays: { currency: 'XRP' },
                            limit: 10,
                        })];
                    case 8:
                        step2 = _f.sent();
                        if (!(!step2.result.offers || step2.result.offers.length === 0)) return [3 /*break*/, 10];
                        return [4 /*yield*/, client.disconnect()];
                    case 9:
                        _f.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: "No liquidity available for XRP/".concat(toCurrency),
                            }];
                    case 10:
                        remainingXrp = totalXrp;
                        totalTokens = 0;
                        for (_b = 0, _c = step2.result.offers; _b < _c.length; _b++) {
                            offer = _c[_b];
                            takerPays_2 = offer.TakerPays;
                            takerGets_2 = offer.TakerGets;
                            offerXrp = 0;
                            if (typeof takerPays_2 === 'string') {
                                dropsStr = String(takerPays_2);
                                offerXrp = parseFloat(xrpl_1.dropsToXrp(dropsStr));
                            }
                            offerTokens = typeof takerGets_2 === 'string' ? parseFloat(takerGets_2) : parseFloat(takerGets_2.value);
                            rate = offerTokens / offerXrp;
                            if (remainingXrp <= offerXrp) {
                                totalTokens += remainingXrp * rate;
                                remainingXrp = 0;
                                break;
                            }
                            else {
                                totalTokens += offerTokens;
                                remainingXrp -= offerXrp;
                            }
                        }
                        if (!(remainingXrp > 0)) return [3 /*break*/, 12];
                        return [4 /*yield*/, client.disconnect()];
                    case 11:
                        _f.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: "Insufficient liquidity for XRP/".concat(toCurrency, ". Available: ").concat(totalXrp - remainingXrp, " XRP"),
                            }];
                    case 12: return [4 /*yield*/, client.disconnect()];
                    case 13:
                        _f.sent();
                        return [2 /*return*/, {
                                success: true,
                                data: {
                                    fromAmount: amount,
                                    toAmount: totalTokens,
                                    rate: totalTokens / amount,
                                    minAmount: totalTokens * 0.95, // 5% slippage tolerance
                                    estimatedFee: 0.000012, // XRPL transaction fee
                                },
                            }];
                    case 14:
                        takerGets = void 0;
                        takerPays = void 0;
                        if (!(fromCurrency === 'XRP' && toCurrency !== 'XRP')) return [3 /*break*/, 15];
                        issuer = this.getIssuer(toCurrency);
                        takerGets = {
                            currency: 'USD',
                            issuer: issuer,
                        };
                        takerPays = {
                            currency: 'XRP',
                        };
                        return [3 /*break*/, 18];
                    case 15:
                        if (!(fromCurrency !== 'XRP' && toCurrency === 'XRP')) return [3 /*break*/, 16];
                        issuer = this.getIssuer(fromCurrency);
                        takerGets = {
                            currency: 'XRP',
                        };
                        takerPays = {
                            currency: 'USD',
                            issuer: issuer,
                        };
                        return [3 /*break*/, 18];
                    case 16: return [4 /*yield*/, client.disconnect()];
                    case 17:
                        _f.sent();
                        return [2 /*return*/, {
                                success: false,
                                error: 'XRP to XRP swap not supported',
                            }];
                    case 18: return [4 /*yield*/, client.request({
                            command: 'book_offers',
                            taker_gets: takerGets,
                            taker_pays: takerPays,
                            limit: 20, // Get more offers for better price calculation
                        })];
                    case 19:
                        orderbook = _f.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 20:
                        _f.sent();
                        if (!orderbook.result.offers || orderbook.result.offers.length === 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: "No liquidity available for ".concat(fromCurrency, "/").concat(toCurrency),
                                }];
                        }
                        remainingAmount = amount;
                        totalReceived = 0;
                        for (_d = 0, _e = orderbook.result.offers; _d < _e.length; _d++) {
                            offer = _e[_d];
                            takerPays_3 = offer.TakerPays;
                            takerGets_3 = offer.TakerGets;
                            if (fromCurrency === 'XRP') {
                                offerXrp = 0;
                                if (typeof takerPays_3 === 'string') {
                                    dropsStr = String(takerPays_3);
                                    offerXrp = parseFloat(xrpl_1.dropsToXrp(dropsStr));
                                }
                                offerTokens = typeof takerGets_3 === 'string' ? parseFloat(takerGets_3) : parseFloat(takerGets_3.value);
                                rate = offerTokens / offerXrp;
                                if (remainingAmount <= offerXrp) {
                                    totalReceived += remainingAmount * rate;
                                    remainingAmount = 0;
                                    break;
                                }
                                else {
                                    totalReceived += offerTokens;
                                    remainingAmount -= offerXrp;
                                }
                            }
                            else {
                                offerTokens = typeof takerPays_3 === 'string' ? parseFloat(takerPays_3) : parseFloat(takerPays_3.value);
                                offerXrp = 0;
                                if (typeof takerGets_3 === 'string') {
                                    dropsStr = String(takerGets_3);
                                    offerXrp = parseFloat(xrpl_1.dropsToXrp(dropsStr));
                                }
                                rate = offerXrp / offerTokens;
                                if (remainingAmount <= offerTokens) {
                                    totalReceived += remainingAmount * rate;
                                    remainingAmount = 0;
                                    break;
                                }
                                else {
                                    totalReceived += offerXrp;
                                    remainingAmount -= offerTokens;
                                }
                            }
                        }
                        if (remainingAmount > 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: "Insufficient liquidity. Available: ".concat(amount - remainingAmount, " ").concat(fromCurrency),
                                }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                data: {
                                    fromAmount: amount,
                                    toAmount: totalReceived,
                                    rate: totalReceived / amount,
                                    minAmount: totalReceived * 0.95, // 5% slippage tolerance
                                    estimatedFee: 0.000012, // XRPL transaction fee
                                },
                            }];
                    case 21:
                        error_2 = _f.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 22:
                        _f.sent();
                        console.error('Error getting DEX price:', error_2);
                        return [2 /*return*/, {
                                success: false,
                                error: error_2 instanceof Error ? error_2.message : 'Failed to get DEX price',
                            }];
                    case 23: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Prepare swap transaction using Payment with pathfinding
     * This creates a Payment transaction that routes through the DEX
     */
    XRPLDEXService.prototype.prepareSwapTransaction = function (userAddress, fromAmount, fromCurrency, toCurrency, minAmount // Minimum amount to receive (slippage protection)
    ) {
        return __awaiter(this, void 0, void 0, function () {
            var client, payment, issuer, issuer, fromIssuer, toIssuer, toIssuer, fromIssuer, prepared, transactionBlob, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        return [4 /*yield*/, client.connect()];
                    case 1:
                        _a.sent();
                        payment = void 0;
                        // Set what user wants to receive
                        if (toCurrency === 'XRP') {
                            payment = {
                                TransactionType: 'Payment',
                                Account: userAddress,
                                Destination: userAddress, // Same address = currency conversion via DEX
                                Amount: (0, xrpl_1.xrpToDrops)(minAmount.toString()),
                            };
                        }
                        else {
                            issuer = this.getIssuer(toCurrency);
                            payment = {
                                TransactionType: 'Payment',
                                Account: userAddress,
                                Destination: userAddress, // Same address = currency conversion via DEX
                                Amount: {
                                    currency: 'USD',
                                    value: minAmount.toFixed(6),
                                    issuer: issuer,
                                },
                            };
                        }
                        // Set what user is willing to pay (maximum)
                        if (fromCurrency === 'XRP') {
                            payment.SendMax = (0, xrpl_1.xrpToDrops)(fromAmount.toString());
                        }
                        else {
                            issuer = this.getIssuer(fromCurrency);
                            payment.SendMax = {
                                currency: 'USD',
                                value: fromAmount.toFixed(6),
                                issuer: issuer,
                            };
                        }
                        // For currency conversion (Account = Destination), we may need explicit paths
                        // Construct paths based on currency pair
                        // Path structure: [{account: issuer, currency, issuer}, ...]
                        // If converting between tokens (not XRP), route through XRP
                        if (fromCurrency !== 'XRP' && toCurrency !== 'XRP') {
                            fromIssuer = this.getIssuer(fromCurrency);
                            toIssuer = this.getIssuer(toCurrency);
                            payment.Paths = [
                                [
                                    { account: fromIssuer, currency: 'USD', issuer: fromIssuer },
                                    { currency: 'XRP' },
                                    { account: toIssuer, currency: 'USD', issuer: toIssuer },
                                ],
                            ];
                        }
                        else if (fromCurrency === 'XRP' && toCurrency !== 'XRP') {
                            toIssuer = this.getIssuer(toCurrency);
                            payment.Paths = [
                                [
                                    { currency: 'XRP' },
                                    { account: toIssuer, currency: 'USD', issuer: toIssuer },
                                ],
                            ];
                        }
                        else if (fromCurrency !== 'XRP' && toCurrency === 'XRP') {
                            fromIssuer = this.getIssuer(fromCurrency);
                            payment.Paths = [
                                [
                                    { account: fromIssuer, currency: 'USD', issuer: fromIssuer },
                                    { currency: 'XRP' },
                                ],
                            ];
                        }
                        return [4 /*yield*/, client.autofill(payment)];
                    case 2:
                        prepared = _a.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 3:
                        _a.sent();
                        transactionBlob = JSON.stringify(prepared);
                        return [2 /*return*/, {
                                success: true,
                                transaction: prepared,
                                transactionBlob: transactionBlob,
                            }];
                    case 4:
                        error_3 = _a.sent();
                        console.error('Error preparing swap transaction:', error_3);
                        return [2 /*return*/, {
                                success: false,
                                error: error_3 instanceof Error ? error_3.message : 'Failed to prepare swap transaction',
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute swap transaction (for custodial wallets with stored secrets)
     */
    XRPLDEXService.prototype.executeSwap = function (userAddress, walletSecret, fromAmount, fromCurrency, toCurrency, minAmount) {
        return __awaiter(this, void 0, void 0, function () {
            var prepareResult, client, wallet, signed, result, swapMeta, txResult, actualFromAmount, actualToAmount, delivered, deliveredStr, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, this.prepareSwapTransaction(userAddress, fromAmount, fromCurrency, toCurrency, minAmount)];
                    case 1:
                        prepareResult = _a.sent();
                        if (!prepareResult.success || !prepareResult.transaction) {
                            return [2 /*return*/, {
                                    success: false,
                                    error: prepareResult.error || 'Failed to prepare transaction',
                                }];
                        }
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        return [4 /*yield*/, client.connect()];
                    case 2:
                        _a.sent();
                        wallet = xrpl_1.Wallet.fromSeed(walletSecret);
                        signed = wallet.sign(prepareResult.transaction);
                        return [4 /*yield*/, client.submitAndWait(signed.tx_blob)];
                    case 3:
                        result = _a.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 4:
                        _a.sent();
                        swapMeta = result.result.meta;
                        txResult = void 0;
                        if (swapMeta && typeof swapMeta === 'object' && 'TransactionResult' in swapMeta) {
                            txResult = swapMeta.TransactionResult;
                        }
                        if (txResult !== 'tesSUCCESS') {
                            return [2 /*return*/, {
                                    success: false,
                                    error: "Transaction failed: ".concat(txResult || 'Unknown error'),
                                }];
                        }
                        actualFromAmount = fromAmount;
                        actualToAmount = minAmount;
                        if (swapMeta && typeof swapMeta === 'object' && 'DeliveredAmount' in swapMeta) {
                            delivered = swapMeta.DeliveredAmount;
                            if (typeof delivered === 'string') {
                                deliveredStr = String(delivered);
                                actualToAmount = parseFloat(xrpl_1.dropsToXrp(deliveredStr));
                            }
                            else if (delivered && typeof delivered === 'object' && 'value' in delivered) {
                                actualToAmount = parseFloat(String(delivered.value));
                            }
                        }
                        return [2 /*return*/, {
                                success: true,
                                txHash: result.result.hash,
                                actualFromAmount: actualFromAmount,
                                actualToAmount: actualToAmount,
                            }];
                    case 5:
                        error_4 = _a.sent();
                        console.error('Error executing swap:', error_4);
                        return [2 /*return*/, {
                                success: false,
                                error: error_4 instanceof Error ? error_4.message : 'Failed to execute swap',
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Ensure trust line exists for a token
     * Returns true if trust line exists or was created, false otherwise
     */
    XRPLDEXService.prototype.ensureTrustLine = function (userAddress_1, walletSecret_1, currency_1) {
        return __awaiter(this, arguments, void 0, function (userAddress, walletSecret, currency, limit // Default trust line limit
        ) {
            var hasTrust, client, issuer, wallet, trustSet, prepared, signed, trustResult, trustMeta, txResult, error_5;
            if (limit === void 0) { limit = '1000000'; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, this.hasTrustLine(userAddress, currency)];
                    case 1:
                        hasTrust = _a.sent();
                        if (hasTrust) {
                            return [2 /*return*/, {
                                    success: true,
                                    created: false,
                                }];
                        }
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        return [4 /*yield*/, client.connect()];
                    case 2:
                        _a.sent();
                        issuer = this.getIssuer(currency);
                        wallet = xrpl_1.Wallet.fromSeed(walletSecret);
                        trustSet = {
                            TransactionType: 'TrustSet',
                            Account: userAddress,
                            LimitAmount: {
                                currency: 'USD',
                                issuer: issuer,
                                value: limit,
                            },
                        };
                        return [4 /*yield*/, client.autofill(trustSet)];
                    case 3:
                        prepared = _a.sent();
                        signed = wallet.sign(prepared);
                        return [4 /*yield*/, client.submitAndWait(signed.tx_blob)];
                    case 4:
                        trustResult = _a.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 5:
                        _a.sent();
                        trustMeta = trustResult.result.meta;
                        txResult = void 0;
                        if (trustMeta && typeof trustMeta === 'object' && 'TransactionResult' in trustMeta) {
                            txResult = trustMeta.TransactionResult;
                        }
                        if (txResult !== 'tesSUCCESS') {
                            return [2 /*return*/, {
                                    success: false,
                                    created: false,
                                    error: "Failed to create trust line: ".concat(txResult),
                                }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                created: true,
                            }];
                    case 6:
                        error_5 = _a.sent();
                        console.error("Error ensuring trust line for ".concat(currency, ":"), error_5);
                        return [2 /*return*/, {
                                success: false,
                                created: false,
                                error: error_5 instanceof Error ? error_5.message : 'Failed to create trust line',
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    return XRPLDEXService;
}());
exports.XRPLDEXService = XRPLDEXService;
// Export singleton instance
exports.xrplDexService = new XRPLDEXService();
