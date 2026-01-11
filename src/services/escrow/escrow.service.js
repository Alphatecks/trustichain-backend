"use strict";
/**
 * Escrow Service
 * Handles escrow operations and statistics
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.escrowService = exports.EscrowService = void 0;
var supabase_1 = require("../../config/supabase");
var xrpl_escrow_service_1 = require("../../xrpl/escrow/xrpl-escrow.service");
var xrpl_wallet_service_1 = require("../../xrpl/wallet/xrpl-wallet.service");
var exchange_service_1 = require("../exchange/exchange.service");
var xumm_service_1 = require("../xumm/xumm.service");
var notification_service_1 = require("../notification/notification.service");
var EscrowService = /** @class */ (function () {
    function EscrowService() {
    }
    /**
     * Format escrow ID as #ESC-YYYY-XXX
     */
    EscrowService.prototype.formatEscrowId = function (year, sequence) {
        return "#ESC-".concat(year, "-").concat(sequence.toString().padStart(3, '0'));
    };
    /**
     * Get party names (initiator and counterparty) for escrows
     */
    EscrowService.prototype.getPartyNames = function (userIds) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, users;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (userIds.length === 0)
                            return [2 /*return*/, {}];
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('users')
                                .select('id, full_name')
                                .in('id', userIds)];
                    case 1:
                        users = (_a.sent()).data;
                        return [2 /*return*/, (users || []).reduce(function (acc, user) {
                                acc[user.id] = user.full_name;
                                return acc;
                            }, {})];
                }
            });
        });
    };
    /**
     * Get milestones for an escrow
     */
    EscrowService.prototype.getMilestones = function (escrowId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, milestones, error;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('escrow_milestones')
                                .select('*')
                                .eq('escrow_id', escrowId)
                                .order('milestone_order', { ascending: true })];
                    case 1:
                        _a = _b.sent(), milestones = _a.data, error = _a.error;
                        if (error || !milestones) {
                            return [2 /*return*/, []];
                        }
                        return [2 /*return*/, milestones.map(function (m) { return ({
                                id: m.id,
                                milestoneDetails: m.milestone_details,
                                milestoneAmount: parseFloat(m.milestone_amount),
                                milestoneAmountUsd: parseFloat(m.milestone_amount_usd),
                                milestoneOrder: m.milestone_order,
                                status: m.status,
                                createdAt: m.created_at,
                                completedAt: m.completed_at || undefined,
                            }); })];
                }
            });
        });
    };
    /**
     * Get active escrows count and locked amount for a user
     */
    EscrowService.prototype.getActiveEscrows = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, escrows, error, count, lockedAmount, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('amount_usd')
                                .eq('user_id', userId)
                                .in('status', ['pending', 'active'])];
                    case 1:
                        _a = _b.sent(), escrows = _a.data, error = _a.error;
                        if (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch active escrows',
                                    error: 'Failed to fetch active escrows',
                                }];
                        }
                        count = (escrows === null || escrows === void 0 ? void 0 : escrows.length) || 0;
                        lockedAmount = (escrows === null || escrows === void 0 ? void 0 : escrows.reduce(function (sum, escrow) { return sum + parseFloat(escrow.amount_usd); }, 0)) || 0;
                        return [2 /*return*/, {
                                success: true,
                                message: 'Active escrows retrieved successfully',
                                data: {
                                    count: count,
                                    lockedAmount: parseFloat(lockedAmount.toFixed(2)),
                                },
                            }];
                    case 2:
                        error_1 = _b.sent();
                        console.error('Error getting active escrows:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                message: error_1 instanceof Error ? error_1.message : 'Failed to get active escrows',
                                error: error_1 instanceof Error ? error_1.message : 'Failed to get active escrows',
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get total escrowed amount (all time, all statuses)
     */
    EscrowService.prototype.getTotalEscrowed = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, escrows, error, totalEscrowed, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('amount_usd')
                                .eq('user_id', userId)];
                    case 1:
                        _a = _b.sent(), escrows = _a.data, error = _a.error;
                        if (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch escrows',
                                    error: 'Failed to fetch escrows',
                                }];
                        }
                        totalEscrowed = (escrows === null || escrows === void 0 ? void 0 : escrows.reduce(function (sum, escrow) { return sum + parseFloat(escrow.amount_usd); }, 0)) || 0;
                        return [2 /*return*/, {
                                success: true,
                                message: 'Total escrowed retrieved successfully',
                                data: {
                                    totalEscrowed: parseFloat(totalEscrowed.toFixed(2)),
                                },
                            }];
                    case 2:
                        error_2 = _b.sent();
                        console.error('Error getting total escrowed:', error_2);
                        return [2 /*return*/, {
                                success: false,
                                message: error_2 instanceof Error ? error_2.message : 'Failed to get total escrowed',
                                error: error_2 instanceof Error ? error_2.message : 'Failed to get total escrowed',
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a new escrow
     */
    EscrowService.prototype.createEscrow = function (userId, request) {
        return __awaiter(this, void 0, void 0, function () {
            var logEntry, fs, path, logPath, adminClient, payerWallet, counterpartyUserId, counterpartyWalletAddress, _a, counterpartyWallet, walletError, _b, counterpartyWallet, walletLookupError, i, milestone, escrowAmount, amountXrp, amountUsd, exchangeRates, usdRate, exchangeRates, usdRate, platformAddress, platformSecret, logDataA, fs, path, logPath, logDataB, fs, path, logPath, trimmedSecret, finishAfter, xrplTxHash, error_3, errorMessage, logError, fs, path, logPath, currentYear, lastEscrow, nextSequence, _c, escrow_1, escrowError, exchangeRates, usdRate_1, milestonesToInsert, milestonesError, notifyError_1, error_4, logCatch, fs, path, logPath;
            var _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        logEntry = { location: 'escrow.service.ts:166', message: 'createEscrow: Function entry', data: { userId: userId, hasRequest: !!request, amount: request.amount, currency: request.currency }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'ENTRY' };
                        console.log('[DEBUG ENTRY]', JSON.stringify(logEntry));
                        console.error('[DEBUG ENTRY]', JSON.stringify(logEntry)); // Also log to stderr
                        try {
                            fs = require('fs');
                            path = require('path');
                            logPath = path.join(process.cwd(), 'debug.log');
                            fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
                        }
                        catch (e) { }
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logEntry) }).catch(function () { });
                        _g.label = 1;
                    case 1:
                        _g.trys.push([1, 27, , 28]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', userId)
                                .single()];
                    case 2:
                        payerWallet = (_g.sent()).data;
                        if (!payerWallet) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Wallet not found. Please create a wallet first.',
                                    error: 'Wallet not found. Please create a wallet first.',
                                }];
                        }
                        counterpartyUserId = null;
                        counterpartyWalletAddress = void 0;
                        if (!request.counterpartyId) return [3 /*break*/, 4];
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address, user_id')
                                .eq('user_id', request.counterpartyId)
                                .maybeSingle()];
                    case 3:
                        _a = _g.sent(), counterpartyWallet = _a.data, walletError = _a.error;
                        if (walletError || !counterpartyWallet) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Counterparty wallet not found',
                                    error: 'Counterparty wallet not found',
                                }];
                        }
                        // Validate that the provided wallet address matches the counterparty's wallet
                        if (counterpartyWallet.xrpl_address !== request.counterpartyXrpWalletAddress) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Provided counterparty wallet address does not match the counterparty user',
                                    error: 'Provided counterparty wallet address does not match the counterparty user',
                                }];
                        }
                        counterpartyUserId = request.counterpartyId;
                        counterpartyWalletAddress = counterpartyWallet.xrpl_address;
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, adminClient
                            .from('wallets')
                            .select('user_id, xrpl_address')
                            .eq('xrpl_address', request.counterpartyXrpWalletAddress)
                            .maybeSingle()];
                    case 5:
                        _b = _g.sent(), counterpartyWallet = _b.data, walletLookupError = _b.error;
                        if (walletLookupError || !counterpartyWallet) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Counterparty wallet not found. The counterparty must have a registered wallet.',
                                    error: 'Counterparty wallet not found. The counterparty must have a registered wallet.',
                                }];
                        }
                        counterpartyUserId = counterpartyWallet.user_id;
                        counterpartyWalletAddress = counterpartyWallet.xrpl_address;
                        _g.label = 6;
                    case 6:
                        // Prevent creating escrow with yourself
                        if (userId === counterpartyUserId) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'You cannot create an escrow with yourself',
                                    error: 'You cannot create an escrow with yourself',
                                }];
                        }
                        // Validate "Time based" release type requirements
                        if (request.releaseType === 'Time based') {
                            if (!request.expectedReleaseDate) {
                                return [2 /*return*/, {
                                        success: false,
                                        message: 'Expected release date is required for time-based escrows',
                                        error: 'Expected release date is required for time-based escrows',
                                    }];
                            }
                            if (request.totalAmount === undefined || request.totalAmount === null) {
                                return [2 /*return*/, {
                                        success: false,
                                        message: 'Total amount is required for time-based escrows',
                                        error: 'Total amount is required for time-based escrows',
                                    }];
                            }
                        }
                        // Validate "Milestones" release type requirements
                        if (request.releaseType === 'Milestones') {
                            if (!request.expectedCompletionDate) {
                                return [2 /*return*/, {
                                        success: false,
                                        message: 'Expected completion date is required for milestone-based escrows',
                                        error: 'Expected completion date is required for milestone-based escrows',
                                    }];
                            }
                            if (request.totalAmount === undefined || request.totalAmount === null) {
                                return [2 /*return*/, {
                                        success: false,
                                        message: 'Total amount is required for milestone-based escrows',
                                        error: 'Total amount is required for milestone-based escrows',
                                    }];
                            }
                            if (!request.milestones || request.milestones.length === 0) {
                                return [2 /*return*/, {
                                        success: false,
                                        message: 'At least one milestone is required for milestone-based escrows',
                                        error: 'At least one milestone is required for milestone-based escrows',
                                    }];
                            }
                            // Validate each milestone
                            for (i = 0; i < request.milestones.length; i++) {
                                milestone = request.milestones[i];
                                if (!milestone.milestoneDetails || milestone.milestoneDetails.trim().length === 0) {
                                    return [2 /*return*/, {
                                            success: false,
                                            message: "Milestone ".concat(i + 1, " details are required"),
                                            error: "Milestone ".concat(i + 1, " details are required"),
                                        }];
                                }
                                if (!milestone.milestoneAmount || milestone.milestoneAmount <= 0) {
                                    return [2 /*return*/, {
                                            success: false,
                                            message: "Milestone ".concat(i + 1, " amount must be greater than 0"),
                                            error: "Milestone ".concat(i + 1, " amount must be greater than 0"),
                                        }];
                                }
                            }
                        }
                        escrowAmount = request.totalAmount !== undefined ? request.totalAmount : request.amount;
                        amountXrp = escrowAmount;
                        amountUsd = escrowAmount;
                        if (!(request.currency === 'USD')) return [3 /*break*/, 8];
                        return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 7:
                        exchangeRates = _g.sent();
                        if (!exchangeRates.success || !exchangeRates.data) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch exchange rates for currency conversion',
                                    error: 'Exchange rate fetch failed',
                                }];
                        }
                        usdRate = (_d = exchangeRates.data.rates.find(function (r) { return r.currency === 'USD'; })) === null || _d === void 0 ? void 0 : _d.rate;
                        if (!usdRate || usdRate <= 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'XRP/USD exchange rate not available',
                                    error: 'Exchange rate not available',
                                }];
                        }
                        amountXrp = escrowAmount / usdRate;
                        return [3 /*break*/, 10];
                    case 8: return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 9:
                        exchangeRates = _g.sent();
                        if (!exchangeRates.success || !exchangeRates.data) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch exchange rates for currency conversion',
                                    error: 'Exchange rate fetch failed',
                                }];
                        }
                        usdRate = (_e = exchangeRates.data.rates.find(function (r) { return r.currency === 'USD'; })) === null || _e === void 0 ? void 0 : _e.rate;
                        if (!usdRate || usdRate <= 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'XRP/USD exchange rate not available',
                                    error: 'Exchange rate not available',
                                }];
                        }
                        amountUsd = escrowAmount * usdRate;
                        _g.label = 10;
                    case 10:
                        platformAddress = process.env.XRPL_PLATFORM_ADDRESS;
                        platformSecret = process.env.XRPL_PLATFORM_SECRET;
                        logDataA = { location: 'escrow.service.ts:355', message: 'createEscrow: Checking platform wallet env vars', data: { hasAddress: !!platformAddress, hasSecret: !!platformSecret, addressLength: platformAddress === null || platformAddress === void 0 ? void 0 : platformAddress.length, secretLength: platformSecret === null || platformSecret === void 0 ? void 0 : platformSecret.length, secretFirst3: platformSecret === null || platformSecret === void 0 ? void 0 : platformSecret.substring(0, 3), secretLast3: platformSecret === null || platformSecret === void 0 ? void 0 : platformSecret.substring(platformSecret.length - 3), hasNewlines: platformSecret === null || platformSecret === void 0 ? void 0 : platformSecret.includes('\n'), hasCarriageReturn: platformSecret === null || platformSecret === void 0 ? void 0 : platformSecret.includes('\r'), hasSpaces: platformSecret === null || platformSecret === void 0 ? void 0 : platformSecret.includes(' '), hasQuotes: (platformSecret === null || platformSecret === void 0 ? void 0 : platformSecret.includes('"')) || (platformSecret === null || platformSecret === void 0 ? void 0 : platformSecret.includes("'")) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' };
                        console.log('[DEBUG]', JSON.stringify(logDataA));
                        console.error('[DEBUG]', JSON.stringify(logDataA)); // Also log to stderr for better visibility
                        try {
                            fs = require('fs');
                            path = require('path');
                            logPath = path.join(process.cwd(), 'debug.log');
                            fs.appendFileSync(logPath, JSON.stringify(logDataA) + '\n');
                        }
                        catch (e) { }
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logDataA) }).catch(function () { });
                        // #endregion
                        if (!platformAddress || !platformSecret) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Platform wallet not configured. XRPL_PLATFORM_ADDRESS and XRPL_PLATFORM_SECRET must be set.',
                                    error: 'Platform wallet not configured',
                                }];
                        }
                        logDataB = { location: 'escrow.service.ts:365', message: 'createEscrow: Platform wallet env vars validated', data: { address: platformAddress, secretLength: platformSecret.length, secretTrimmedLength: platformSecret.trim().length, secretStartsWithS: platformSecret.startsWith('s'), secretMatchesBase58Pattern: /^[a-zA-Z0-9]+$/.test(platformSecret) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' };
                        console.log('[DEBUG]', JSON.stringify(logDataB));
                        console.error('[DEBUG]', JSON.stringify(logDataB)); // Also log to stderr
                        try {
                            fs = require('fs');
                            path = require('path');
                            logPath = path.join(process.cwd(), 'debug.log');
                            fs.appendFileSync(logPath, JSON.stringify(logDataB) + '\n');
                        }
                        catch (e) { }
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logDataB) }).catch(function () { });
                        trimmedSecret = platformSecret.trim();
                        if (trimmedSecret !== platformSecret) {
                            console.warn('[Escrow Create] Platform secret had whitespace, using trimmed version');
                        }
                        finishAfter = void 0;
                        if (request.expectedReleaseDate) {
                            finishAfter = Math.floor(new Date(request.expectedReleaseDate).getTime() / 1000);
                        }
                        else {
                            // Default: 30 days from now (allows escrow to be released after this time)
                            // This satisfies XRPL's requirement while allowing reasonable release time
                            finishAfter = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days in seconds
                        }
                        console.log('[Escrow Create] Creating escrow on XRPL using platform wallet:', {
                            platformAddress: platformAddress,
                            toAddress: counterpartyWalletAddress,
                            amountXrp: amountXrp,
                            finishAfter: new Date(finishAfter * 1000).toISOString(),
                        });
                        xrplTxHash = void 0;
                        _g.label = 11;
                    case 11:
                        _g.trys.push([11, 13, , 14]);
                        return [4 /*yield*/, xrpl_escrow_service_1.xrplEscrowService.createEscrow({
                                fromAddress: platformAddress,
                                toAddress: counterpartyWalletAddress,
                                amountXrp: amountXrp,
                                finishAfter: finishAfter, // XRPL requires either FinishAfter or CancelAfter
                                walletSecret: trimmedSecret, // Use trimmed secret
                            })];
                    case 12:
                        xrplTxHash = _g.sent();
                        console.log('[Escrow Create] Escrow created on XRPL:', {
                            txHash: xrplTxHash,
                            platformAddress: platformAddress,
                            toAddress: counterpartyWalletAddress,
                        });
                        return [3 /*break*/, 14];
                    case 13:
                        error_3 = _g.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : String(error_3);
                        logError = { location: 'escrow.service.ts:393', message: 'createEscrow: XRPL createEscrow call failed', data: { errorMessage: errorMessage, errorName: error_3 instanceof Error ? error_3.name : 'Unknown', errorStack: error_3 instanceof Error ? error_3.stack : undefined, platformAddress: platformAddress, secretLength: trimmedSecret === null || trimmedSecret === void 0 ? void 0 : trimmedSecret.length, secretFirst5: trimmedSecret === null || trimmedSecret === void 0 ? void 0 : trimmedSecret.substring(0, 5) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'ERROR' };
                        console.error('[DEBUG ERROR]', JSON.stringify(logError));
                        try {
                            fs = require('fs');
                            path = require('path');
                            logPath = path.join(process.cwd(), 'debug.log');
                            fs.appendFileSync(logPath, JSON.stringify(logError) + '\n');
                        }
                        catch (e) { }
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logError) }).catch(function () { });
                        // #endregion
                        console.error('[Escrow Create] Failed to create escrow on XRPL:', errorMessage);
                        return [2 /*return*/, {
                                success: false,
                                message: "Failed to create escrow on XRPL: ".concat(errorMessage),
                                error: 'XRPL transaction failed',
                            }];
                    case 14:
                        currentYear = new Date().getFullYear();
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('escrow_sequence')
                                .gte('created_at', new Date(currentYear, 0, 1).toISOString())
                                .order('escrow_sequence', { ascending: false })
                                .limit(1)
                                .maybeSingle()];
                    case 15:
                        lastEscrow = (_g.sent()).data;
                        nextSequence = (lastEscrow === null || lastEscrow === void 0 ? void 0 : lastEscrow.escrow_sequence) ? lastEscrow.escrow_sequence + 1 : 1;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .insert({
                                user_id: userId,
                                counterparty_id: counterpartyUserId,
                                amount_xrp: amountXrp,
                                amount_usd: amountUsd,
                                status: 'active', // Escrow is active because XRPL transaction was submitted
                                xrpl_escrow_id: xrplTxHash, // Store the real XRPL transaction hash
                                description: request.description || "Escrow created on XRPL: ".concat(xrplTxHash),
                                transaction_type: request.transactionType || 'custom',
                                industry: request.industry || null,
                                progress: 0,
                                escrow_sequence: nextSequence,
                                // Payer contact information
                                payer_email: request.payerEmail || null,
                                payer_name: request.payerName || null,
                                payer_phone: request.payerPhoneNumber || null,
                                // Counterparty contact information
                                counterparty_email: request.counterpartyEmail || null,
                                counterparty_name: request.counterpartyName || null,
                                counterparty_phone: request.counterpartyPhoneNumber || null,
                                // Step 2: Terms and Release conditions
                                release_type: request.releaseType || null,
                                expected_completion_date: request.expectedCompletionDate ? new Date(request.expectedCompletionDate).toISOString() : null,
                                expected_release_date: request.expectedReleaseDate ? new Date(request.expectedReleaseDate).toISOString() : null,
                                dispute_resolution_period: request.disputeResolutionPeriod || null,
                                release_conditions: request.releaseConditions || null,
                            })
                                .select()
                                .single()];
                    case 16:
                        _c = _g.sent(), escrow_1 = _c.data, escrowError = _c.error;
                        if (escrowError || !escrow_1) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to create escrow',
                                    error: (escrowError === null || escrowError === void 0 ? void 0 : escrowError.message) || 'Failed to create escrow',
                                }];
                        }
                        if (!(request.releaseType === 'Milestones' && request.milestones && request.milestones.length > 0)) return [3 /*break*/, 19];
                        return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 17:
                        exchangeRates = _g.sent();
                        if (!exchangeRates.success || !exchangeRates.data) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch exchange rates for milestone currency conversion',
                                    error: 'Exchange rate fetch failed',
                                }];
                        }
                        usdRate_1 = (_f = exchangeRates.data.rates.find(function (r) { return r.currency === 'USD'; })) === null || _f === void 0 ? void 0 : _f.rate;
                        if (!usdRate_1 || usdRate_1 <= 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'XRP/USD exchange rate not available for milestones',
                                    error: 'Exchange rate not available',
                                }];
                        }
                        milestonesToInsert = request.milestones.map(function (milestone, index) {
                            var milestoneAmountXrp = milestone.milestoneAmount;
                            var milestoneAmountUsd = milestone.milestoneAmount;
                            // Convert milestone amount to XRP if currency is USD
                            if (request.currency === 'USD') {
                                milestoneAmountXrp = milestone.milestoneAmount / usdRate_1;
                            }
                            else {
                                milestoneAmountUsd = milestone.milestoneAmount * usdRate_1;
                            }
                            return {
                                escrow_id: escrow_1.id,
                                milestone_order: milestone.milestoneOrder || (index + 1),
                                milestone_details: milestone.milestoneDetails,
                                milestone_amount: milestoneAmountXrp,
                                milestone_amount_usd: milestoneAmountUsd,
                                status: 'pending',
                            };
                        });
                        return [4 /*yield*/, adminClient
                                .from('escrow_milestones')
                                .insert(milestonesToInsert)];
                    case 18:
                        milestonesError = (_g.sent()).error;
                        if (milestonesError) {
                            console.error('Error creating milestones:', milestonesError);
                            // Don't fail the escrow creation if milestones fail - log and continue
                            // Optionally, you could rollback the escrow creation here
                        }
                        _g.label = 19;
                    case 19: 
                    // Create completed transaction record for escrow creation
                    return [4 /*yield*/, adminClient
                            .from('transactions')
                            .insert({
                            user_id: userId,
                            type: 'escrow_create',
                            amount_xrp: amountXrp,
                            amount_usd: amountUsd,
                            xrpl_tx_hash: xrplTxHash,
                            status: 'completed',
                            escrow_id: escrow_1.id,
                            description: "Escrow create: ".concat(request.description || 'No description', " | XRPL TX: ").concat(xrplTxHash),
                        })];
                    case 20:
                        // Create completed transaction record for escrow creation
                        _g.sent();
                        _g.label = 21;
                    case 21:
                        _g.trys.push([21, 25, , 26]);
                        // Initiator
                        return [4 /*yield*/, notification_service_1.notificationService.createNotification({
                                userId: userId,
                                type: 'escrow_created',
                                title: 'Escrow created',
                                message: "Escrow was created for ".concat(amountXrp.toFixed(6), " XRP."),
                                metadata: {
                                    escrowId: escrow_1.id,
                                    xrplTxHash: xrplTxHash,
                                },
                            })];
                    case 22:
                        // Initiator
                        _g.sent();
                        if (!counterpartyUserId) return [3 /*break*/, 24];
                        return [4 /*yield*/, notification_service_1.notificationService.createNotification({
                                userId: counterpartyUserId,
                                type: 'escrow_created',
                                title: 'New escrow assigned',
                                message: "You have been added to a new escrow for ".concat(amountXrp.toFixed(6), " XRP."),
                                metadata: {
                                    escrowId: escrow_1.id,
                                    xrplTxHash: xrplTxHash,
                                },
                            })];
                    case 23:
                        _g.sent();
                        _g.label = 24;
                    case 24: return [3 /*break*/, 26];
                    case 25:
                        notifyError_1 = _g.sent();
                        console.warn('Failed to create escrow created notifications:', notifyError_1);
                        return [3 /*break*/, 26];
                    case 26: return [2 /*return*/, {
                            success: true,
                            message: 'Escrow created successfully on XRPL',
                            data: {
                                escrowId: escrow_1.id,
                                amount: {
                                    usd: parseFloat(amountUsd.toFixed(2)),
                                    xrp: parseFloat(amountXrp.toFixed(6)),
                                },
                                status: escrow_1.status,
                                xrplEscrowId: xrplTxHash,
                            },
                        }];
                    case 27:
                        error_4 = _g.sent();
                        logCatch = { location: 'escrow.service.ts:catch', message: 'createEscrow: Outer catch block', data: { errorMessage: error_4 instanceof Error ? error_4.message : String(error_4), errorName: error_4 instanceof Error ? error_4.name : 'Unknown', errorStack: error_4 instanceof Error ? error_4.stack : undefined }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'CATCH' };
                        console.error('[DEBUG CATCH]', JSON.stringify(logCatch));
                        try {
                            fs = require('fs');
                            path = require('path');
                            logPath = path.join(process.cwd(), 'debug.log');
                            fs.appendFileSync(logPath, JSON.stringify(logCatch) + '\n');
                        }
                        catch (e) { }
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logCatch) }).catch(function () { });
                        // #endregion
                        console.error('Error creating escrow:', error_4);
                        return [2 /*return*/, {
                                success: false,
                                message: error_4 instanceof Error ? error_4.message : 'Failed to create escrow',
                                error: error_4 instanceof Error ? error_4.message : 'Failed to create escrow',
                            }];
                    case 28: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get completed escrows count for the current month
     */
    EscrowService.prototype.getCompletedEscrowsForMonth = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, now, year, month, monthStart, monthEnd, monthNames, monthName, _a, count, error, error_5;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        now = new Date();
                        year = now.getFullYear();
                        month = now.getMonth();
                        monthStart = new Date(year, month, 1);
                        monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
                        monthNames = [
                            'January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'
                        ];
                        monthName = monthNames[month];
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('*', { count: 'exact', head: true })
                                .or("user_id.eq.".concat(userId, ",counterparty_id.eq.").concat(userId))
                                .eq('status', 'completed')
                                .not('completed_at', 'is', null)
                                .gte('completed_at', monthStart.toISOString())
                                .lte('completed_at', monthEnd.toISOString())];
                    case 1:
                        _a = _b.sent(), count = _a.count, error = _a.error;
                        if (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch completed escrows for month',
                                    error: 'Failed to fetch completed escrows for month',
                                }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                message: 'Completed escrows for month retrieved successfully',
                                data: {
                                    count: count || 0,
                                    month: monthName,
                                    year: year,
                                },
                            }];
                    case 2:
                        error_5 = _b.sent();
                        console.error('Error getting completed escrows for month:', error_5);
                        return [2 /*return*/, {
                                success: false,
                                message: error_5 instanceof Error ? error_5.message : 'Failed to get completed escrows for month',
                                error: error_5 instanceof Error ? error_5.message : 'Failed to get completed escrows for month',
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get escrow list for a user with filters
     */
    EscrowService.prototype.getEscrowListWithFilters = function (userId_1) {
        return __awaiter(this, arguments, void 0, function (userId, filters) {
            var adminClient, limit, offset, query, monthStart, monthEnd, _a, escrows, escrowError, count, userIds_1, partyNames_1, formattedEscrows, error_6;
            var _this = this;
            if (filters === void 0) { filters = {}; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        limit = filters.limit || 50;
                        offset = filters.offset || 0;
                        query = adminClient
                            .from('escrows')
                            .select('*', { count: 'exact' })
                            .or("user_id.eq.".concat(userId, ",counterparty_id.eq.").concat(userId));
                        // Apply transaction type filter
                        if (filters.transactionType && filters.transactionType !== 'all') {
                            query = query.eq('transaction_type', filters.transactionType);
                        }
                        // Apply industry filter
                        if (filters.industry && filters.industry !== 'all') {
                            query = query.ilike('industry', "%".concat(filters.industry, "%"));
                        }
                        // Apply date filter (month/year)
                        if (filters.month && filters.year) {
                            monthStart = new Date(filters.year, filters.month - 1, 1);
                            monthEnd = new Date(filters.year, filters.month, 0, 23, 59, 59, 999);
                            query = query.gte('created_at', monthStart.toISOString())
                                .lte('created_at', monthEnd.toISOString());
                        }
                        return [4 /*yield*/, query
                                .order('created_at', { ascending: false })
                                .range(offset, offset + limit - 1)];
                    case 1:
                        _a = _b.sent(), escrows = _a.data, escrowError = _a.error, count = _a.count;
                        if (escrowError) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch escrows',
                                    error: 'Failed to fetch escrows',
                                }];
                        }
                        userIds_1 = new Set();
                        (escrows || []).forEach(function (escrow) {
                            if (escrow.user_id)
                                userIds_1.add(escrow.user_id);
                            if (escrow.counterparty_id)
                                userIds_1.add(escrow.counterparty_id);
                        });
                        return [4 /*yield*/, this.getPartyNames(Array.from(userIds_1))];
                    case 2:
                        partyNames_1 = _b.sent();
                        formattedEscrows = (escrows || []).map(function (escrow) {
                            var year = new Date(escrow.created_at).getFullYear();
                            var escrowId = _this.formatEscrowId(year, escrow.escrow_sequence || 1);
                            return {
                                id: escrow.id,
                                escrowId: escrowId,
                                userId: escrow.user_id,
                                counterpartyId: escrow.counterparty_id || '',
                                initiatorName: partyNames_1[escrow.user_id] || 'Unknown',
                                counterpartyName: escrow.counterparty_id ? partyNames_1[escrow.counterparty_id] : undefined,
                                amount: {
                                    usd: parseFloat(escrow.amount_usd),
                                    xrp: parseFloat(escrow.amount_xrp),
                                },
                                status: escrow.status,
                                transactionType: escrow.transaction_type,
                                industry: escrow.industry || null,
                                progress: parseFloat(escrow.progress || 0),
                                description: escrow.description || undefined,
                                xrplEscrowId: escrow.xrpl_escrow_id || undefined,
                                createdAt: escrow.created_at,
                                updatedAt: escrow.updated_at,
                                completedAt: escrow.completed_at || undefined,
                                cancelReason: escrow.cancel_reason || undefined,
                                // Contact information
                                payerEmail: escrow.payer_email || undefined,
                                payerName: escrow.payer_name || undefined,
                                payerPhone: escrow.payer_phone || undefined,
                                counterpartyEmail: escrow.counterparty_email || undefined,
                                counterpartyPhone: escrow.counterparty_phone || undefined,
                                // Step 2: Terms and Release conditions
                                releaseType: escrow.release_type,
                                expectedCompletionDate: escrow.expected_completion_date || undefined,
                                expectedReleaseDate: escrow.expected_release_date || undefined,
                                disputeResolutionPeriod: escrow.dispute_resolution_period || undefined,
                                releaseConditions: escrow.release_conditions || undefined,
                            };
                        });
                        return [2 /*return*/, {
                                success: true,
                                message: 'Escrows retrieved successfully',
                                data: {
                                    escrows: formattedEscrows,
                                    total: count || 0,
                                },
                            }];
                    case 3:
                        error_6 = _b.sent();
                        console.error('Error getting escrow list:', error_6);
                        return [2 /*return*/, {
                                success: false,
                                message: error_6 instanceof Error ? error_6.message : 'Failed to get escrow list',
                                error: error_6 instanceof Error ? error_6.message : 'Failed to get escrow list',
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get escrow list for a user (backward compatibility)
     */
    EscrowService.prototype.getEscrowList = function (userId_1) {
        return __awaiter(this, arguments, void 0, function (userId, limit, offset) {
            if (limit === void 0) { limit = 50; }
            if (offset === void 0) { offset = 0; }
            return __generator(this, function (_a) {
                return [2 /*return*/, this.getEscrowListWithFilters(userId, { limit: limit, offset: offset })];
            });
        });
    };
    /**
     * Get escrow by ID with full details
     */
    EscrowService.prototype.getEscrowById = function (userId, escrowId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, escrow, error, userIds, partyNames, milestones, year, formattedEscrowId, formattedEscrow, error_7;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 4, , 5]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('*')
                                .eq('id', escrowId)
                                .or("user_id.eq.".concat(userId, ",counterparty_id.eq.").concat(userId))
                                .single()];
                    case 1:
                        _a = _b.sent(), escrow = _a.data, error = _a.error;
                        if (error || !escrow) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Escrow not found or access denied',
                                    error: 'Escrow not found or access denied',
                                }];
                        }
                        userIds = [escrow.user_id];
                        if (escrow.counterparty_id)
                            userIds.push(escrow.counterparty_id);
                        return [4 /*yield*/, this.getPartyNames(userIds)];
                    case 2:
                        partyNames = _b.sent();
                        return [4 /*yield*/, this.getMilestones(escrow.id)];
                    case 3:
                        milestones = _b.sent();
                        year = new Date(escrow.created_at).getFullYear();
                        formattedEscrowId = this.formatEscrowId(year, escrow.escrow_sequence || 1);
                        formattedEscrow = {
                            id: escrow.id,
                            escrowId: formattedEscrowId,
                            userId: escrow.user_id,
                            counterpartyId: escrow.counterparty_id || '',
                            initiatorName: partyNames[escrow.user_id] || 'Unknown',
                            counterpartyName: escrow.counterparty_id ? partyNames[escrow.counterparty_id] : undefined,
                            amount: {
                                usd: parseFloat(escrow.amount_usd),
                                xrp: parseFloat(escrow.amount_xrp),
                            },
                            status: escrow.status,
                            transactionType: escrow.transaction_type,
                            industry: escrow.industry || null,
                            progress: parseFloat(escrow.progress || 0),
                            description: escrow.description || undefined,
                            xrplEscrowId: escrow.xrpl_escrow_id || undefined,
                            createdAt: escrow.created_at,
                            updatedAt: escrow.updated_at,
                            completedAt: escrow.completed_at || undefined,
                            cancelReason: escrow.cancel_reason || undefined,
                            // Contact information
                            payerEmail: escrow.payer_email || undefined,
                            payerName: escrow.payer_name || undefined,
                            payerPhone: escrow.payer_phone || undefined,
                            counterpartyEmail: escrow.counterparty_email || undefined,
                            counterpartyPhone: escrow.counterparty_phone || undefined,
                            // Step 2: Terms and Release conditions
                            releaseType: escrow.release_type,
                            expectedCompletionDate: escrow.expected_completion_date || undefined,
                            expectedReleaseDate: escrow.expected_release_date || undefined,
                            disputeResolutionPeriod: escrow.dispute_resolution_period || undefined,
                            releaseConditions: escrow.release_conditions || undefined,
                            milestones: milestones.length > 0 ? milestones : undefined,
                        };
                        return [2 /*return*/, {
                                success: true,
                                message: 'Escrow retrieved successfully',
                                data: formattedEscrow,
                            }];
                    case 4:
                        error_7 = _b.sent();
                        console.error('Error getting escrow by ID:', error_7);
                        return [2 /*return*/, {
                                success: false,
                                message: error_7 instanceof Error ? error_7.message : 'Failed to get escrow',
                                error: error_7 instanceof Error ? error_7.message : 'Failed to get escrow',
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get detailed escrow status from XRPL
     * Checks the actual state of the escrow on XRPL ledger
     */
    EscrowService.prototype.getEscrowXrplStatus = function (userId, escrowId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, escrow, fetchError, platformAddress, status_1, error_8;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('*')
                                .eq('id', escrowId)
                                .or("user_id.eq.".concat(userId, ",counterparty_id.eq.").concat(userId))
                                .single()];
                    case 1:
                        _a = _b.sent(), escrow = _a.data, fetchError = _a.error;
                        if (fetchError || !escrow) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Escrow not found or access denied',
                                    error: 'Escrow not found or access denied',
                                }];
                        }
                        if (!escrow.xrpl_escrow_id) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Escrow does not have an XRPL transaction hash',
                                    error: 'No XRPL transaction hash',
                                }];
                        }
                        platformAddress = process.env.XRPL_PLATFORM_ADDRESS;
                        if (!platformAddress) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Platform wallet not configured',
                                    error: 'Platform wallet not configured',
                                }];
                        }
                        return [4 /*yield*/, xrpl_escrow_service_1.xrplEscrowService.getEscrowStatus(escrow.xrpl_escrow_id, platformAddress)];
                    case 2:
                        status_1 = _b.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: 'Escrow status retrieved successfully',
                                data: status_1,
                            }];
                    case 3:
                        error_8 = _b.sent();
                        console.error('Error getting escrow XRPL status:', error_8);
                        return [2 /*return*/, {
                                success: false,
                                message: error_8 instanceof Error ? error_8.message : 'Failed to get escrow status',
                                error: error_8 instanceof Error ? error_8.message : 'Failed to get escrow status',
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Release (finish) an escrow
     */
    EscrowService.prototype.releaseEscrow = function (userId, escrowId, notes) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, escrow_2, fetchError, platformAddress_1, platformSecret, escrowDetails, counterpartyWalletAddress_1, counterpartyWallet, Client, _b, xrpToDrops, dropsToXrp, xrplNetwork, xrplServer, client, transactionSequence_1, txResponse, txError_1, accountObjectsResponse, escrowObjects, targetAmountDrops_1, escrowObject, escrowAmount, amountDropsStr, amount, sequenceToUse, fallbackError_1, Client, xrplNetwork, xrplServer, client, txResponse, txSequence_1, accountTxResponse, transactions, relatedTx, tx, wasFinished, checkError_1, error_9, finishTxHash, error_10, errorMessage, updatedEscrow, senderWallet, senderBalances, error_11, receiverWallet, receiverBalances, error_12, userIds, partyNames, milestones, year, formattedEscrowId, formattedEscrow, notifyError_2, xrplError_1, errorMessage, error_13;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 68, , 69]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('*')
                                .eq('id', escrowId)
                                .or("user_id.eq.".concat(userId, ",counterparty_id.eq.").concat(userId))
                                .single()];
                    case 1:
                        _a = _c.sent(), escrow_2 = _a.data, fetchError = _a.error;
                        if (fetchError || !escrow_2) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Escrow not found or access denied',
                                    error: 'Escrow not found or access denied',
                                }];
                        }
                        // Check if escrow can be released
                        if (escrow_2.status === 'completed') {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Escrow is already completed',
                                    error: 'Escrow is already completed',
                                }];
                        }
                        if (escrow_2.status === 'cancelled') {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Cannot release a cancelled escrow',
                                    error: 'Cannot release a cancelled escrow',
                                }];
                        }
                        platformAddress_1 = process.env.XRPL_PLATFORM_ADDRESS;
                        platformSecret = process.env.XRPL_PLATFORM_SECRET;
                        if (!platformAddress_1 || !platformSecret) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Platform wallet not configured. XRPL_PLATFORM_ADDRESS and XRPL_PLATFORM_SECRET must be set.',
                                    error: 'Platform wallet not configured',
                                }];
                        }
                        // Finish escrow on XRPL
                        // First, retrieve the escrow sequence number from XRPL using the transaction hash
                        if (!escrow_2.xrpl_escrow_id) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Cannot release escrow: XRPL transaction hash not found. Escrow may not have been created on XRPL.',
                                    error: 'XRPL transaction hash missing',
                                }];
                        }
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 66, , 67]);
                        // Get escrow details from XRPL to retrieve the sequence number
                        // The escrow owner is the platform wallet (since escrows are created using platform wallet)
                        console.log('[Escrow Release] Retrieving escrow details from XRPL:', {
                            txHash: escrow_2.xrpl_escrow_id,
                            ownerAddress: platformAddress_1,
                        });
                        return [4 /*yield*/, xrpl_escrow_service_1.xrplEscrowService.getEscrowDetailsByTxHash(escrow_2.xrpl_escrow_id, platformAddress_1)];
                    case 3:
                        escrowDetails = _c.sent();
                        if (!!escrowDetails) return [3 /*break*/, 19];
                        console.log('[Escrow Release] Transaction hash lookup failed, trying fallback: querying account_objects');
                        counterpartyWalletAddress_1 = null;
                        if (!escrow_2.counterparty_id) return [3 /*break*/, 5];
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', escrow_2.counterparty_id)
                                .single()];
                    case 4:
                        counterpartyWallet = (_c.sent()).data;
                        counterpartyWalletAddress_1 = (counterpartyWallet === null || counterpartyWallet === void 0 ? void 0 : counterpartyWallet.xrpl_address) || null;
                        _c.label = 5;
                    case 5:
                        _c.trys.push([5, 18, , 19]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('xrpl'); })];
                    case 6:
                        Client = (_c.sent()).Client;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('xrpl'); })];
                    case 7:
                        _b = _c.sent(), xrpToDrops = _b.xrpToDrops, dropsToXrp = _b.dropsToXrp;
                        xrplNetwork = process.env.XRPL_NETWORK || 'testnet';
                        xrplServer = xrplNetwork === 'mainnet'
                            ? 'wss://xrplcluster.com'
                            : 'wss://s.altnet.rippletest.net:51233';
                        client = new Client(xrplServer);
                        return [4 /*yield*/, client.connect()];
                    case 8:
                        _c.sent();
                        _c.label = 9;
                    case 9:
                        _c.trys.push([9, , 15, 17]);
                        transactionSequence_1 = null;
                        if (!(escrow_2.xrpl_escrow_id && /^[a-f0-9]{64}$/i.test(escrow_2.xrpl_escrow_id))) return [3 /*break*/, 13];
                        _c.label = 10;
                    case 10:
                        _c.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, client.request({
                                command: 'tx',
                                transaction: escrow_2.xrpl_escrow_id,
                            })];
                    case 11:
                        txResponse = _c.sent();
                        if (txResponse.result && txResponse.result.Sequence) {
                            transactionSequence_1 = txResponse.result.Sequence;
                            console.log('[Escrow Release] Got transaction sequence from hash:', transactionSequence_1);
                        }
                        return [3 /*break*/, 13];
                    case 12:
                        txError_1 = _c.sent();
                        // Transaction hash query failed, continue with fallback
                        console.log('[Escrow Release] Could not get sequence from transaction hash, continuing with account_objects fallback');
                        return [3 /*break*/, 13];
                    case 13: return [4 /*yield*/, client.request({
                            command: 'account_objects',
                            account: platformAddress_1,
                            type: 'escrow',
                        })];
                    case 14:
                        accountObjectsResponse = _c.sent();
                        escrowObjects = accountObjectsResponse.result.account_objects || [];
                        targetAmountDrops_1 = xrpToDrops(escrow_2.amount_xrp.toString());
                        escrowObject = escrowObjects.find(function (obj) {
                            var matchesDestination = !counterpartyWalletAddress_1 ||
                                obj.Destination === counterpartyWalletAddress_1;
                            var objAmount = obj.Amount;
                            var matchesAmount = objAmount && Math.abs(parseInt(String(objAmount)) - parseInt(String(targetAmountDrops_1))) < 1000; // Allow small difference for fees
                            // If we have a transaction hash, also try to match by PreviousTxnID
                            var matchesTxHash = !escrow_2.xrpl_escrow_id || obj.PreviousTxnID === escrow_2.xrpl_escrow_id;
                            return matchesDestination && matchesAmount && (transactionSequence_1 !== null || matchesTxHash);
                        });
                        if (escrowObject) {
                            escrowAmount = escrowObject.Amount;
                            amountDropsStr = escrowAmount ? String(escrowAmount) : '0';
                            amount = parseFloat(dropsToXrp(amountDropsStr));
                            sequenceToUse = transactionSequence_1 || null;
                            if (!sequenceToUse) {
                                console.error('[Escrow Release] Fallback method cannot determine transaction sequence - cannot proceed');
                                throw new Error('Cannot determine escrow transaction sequence for EscrowFinish');
                            }
                            escrowDetails = {
                                sequence: sequenceToUse, // Use transaction sequence, not escrow object sequence
                                amount: amount,
                                destination: escrowObject.Destination || '',
                                finishAfter: escrowObject.FinishAfter ? escrowObject.FinishAfter : undefined,
                                cancelAfter: escrowObject.CancelAfter ? escrowObject.CancelAfter : undefined,
                                condition: escrowObject.Condition || undefined,
                            };
                            console.log('[Escrow Release] Found escrow via fallback method:', {
                                sequence: escrowDetails.sequence,
                                amount: escrowDetails.amount,
                                destination: escrowDetails.destination,
                            });
                        }
                        return [3 /*break*/, 17];
                    case 15: return [4 /*yield*/, client.disconnect()];
                    case 16:
                        _c.sent();
                        return [7 /*endfinally*/];
                    case 17: return [3 /*break*/, 19];
                    case 18:
                        fallbackError_1 = _c.sent();
                        console.error('[Escrow Release] Fallback query failed:', fallbackError_1);
                        return [3 /*break*/, 19];
                    case 19:
                        if (!!escrowDetails) return [3 /*break*/, 36];
                        _c.label = 20;
                    case 20:
                        _c.trys.push([20, 34, , 35]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('xrpl'); })];
                    case 21:
                        Client = (_c.sent()).Client;
                        xrplNetwork = process.env.XRPL_NETWORK || 'testnet';
                        xrplServer = xrplNetwork === 'mainnet'
                            ? 'wss://xrplcluster.com'
                            : 'wss://s.altnet.rippletest.net:51233';
                        client = new Client(xrplServer);
                        return [4 /*yield*/, client.connect()];
                    case 22:
                        _c.sent();
                        _c.label = 23;
                    case 23:
                        _c.trys.push([23, 31, , 33]);
                        return [4 /*yield*/, client.request({
                                command: 'tx',
                                transaction: escrow_2.xrpl_escrow_id,
                            })];
                    case 24:
                        txResponse = _c.sent();
                        if (!txResponse.result) return [3 /*break*/, 29];
                        txSequence_1 = txResponse.result.Sequence;
                        return [4 /*yield*/, client.request({
                                command: 'account_tx',
                                account: platformAddress_1,
                                ledger_index_min: -1,
                                ledger_index_max: -1,
                                limit: 200,
                            })];
                    case 25:
                        accountTxResponse = _c.sent();
                        transactions = accountTxResponse.result.transactions || [];
                        relatedTx = transactions.find(function (txData) {
                            var tx = txData.tx || txData;
                            return (tx.TransactionType === 'EscrowFinish' || tx.TransactionType === 'EscrowCancel') &&
                                tx.Owner === platformAddress_1 &&
                                tx.OfferSequence === txSequence_1;
                        });
                        if (!relatedTx) return [3 /*break*/, 29];
                        tx = relatedTx.tx || relatedTx;
                        wasFinished = tx.TransactionType === 'EscrowFinish';
                        if (!(escrow_2.status === 'active')) return [3 /*break*/, 27];
                        console.log("[Escrow Release] Updating database: Escrow was already ".concat(wasFinished ? 'finished' : 'cancelled', " on XRPL"));
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .update({
                                status: wasFinished ? 'completed' : 'cancelled',
                                completed_at: wasFinished ? new Date().toISOString() : null,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', escrowId)];
                    case 26:
                        _c.sent();
                        _c.label = 27;
                    case 27: return [4 /*yield*/, client.disconnect()];
                    case 28:
                        _c.sent();
                        return [2 /*return*/, {
                                success: false,
                                message: "Cannot release escrow: The escrow was already ".concat(wasFinished ? 'finished' : 'cancelled', " on XRPL. The database status has been updated."),
                                error: "Escrow already ".concat(wasFinished ? 'finished' : 'cancelled'),
                            }];
                    case 29: return [4 /*yield*/, client.disconnect()];
                    case 30:
                        _c.sent();
                        return [3 /*break*/, 33];
                    case 31:
                        checkError_1 = _c.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 32:
                        _c.sent();
                        console.error('[Escrow Release] Error checking escrow status:', checkError_1);
                        return [3 /*break*/, 33];
                    case 33: return [3 /*break*/, 35];
                    case 34:
                        error_9 = _c.sent();
                        console.error('[Escrow Release] Error checking transaction history:', error_9);
                        return [3 /*break*/, 35];
                    case 35: return [2 /*return*/, {
                            success: false,
                            message: 'Cannot release escrow: Escrow not found on XRPL. The escrow object does not exist, which means it was already finished or cancelled on the XRPL ledger. Please refresh your escrow list to see the updated status.',
                            error: 'Escrow not found on XRPL - already finished or cancelled',
                        }];
                    case 36:
                        console.log('[Escrow Release] Found escrow on XRPL:', {
                            sequence: escrowDetails.sequence,
                            sequenceType: typeof escrowDetails.sequence,
                            amount: escrowDetails.amount,
                            destination: escrowDetails.destination,
                            txHash: escrow_2.xrpl_escrow_id,
                            platformAddress: platformAddress_1,
                        });
                        // Check if escrow has a condition that requires fulfillment
                        if (escrowDetails.condition) {
                            // Conditional escrows require fulfillment - this is not yet implemented
                            // For now, return error. In future, this could accept fulfillment parameter
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Cannot release escrow: Escrow has a condition that requires fulfillment. This feature is not yet implemented.',
                                    error: 'Conditional escrow not supported',
                                }];
                        }
                        // Finish escrow on XRPL using platform wallet (sign directly, no XUMM)
                        console.log('[Escrow Release] Finishing escrow on XRPL using platform wallet:', {
                            escrowSequence: escrowDetails.sequence,
                            ownerAddress: platformAddress_1,
                        });
                        finishTxHash = void 0;
                        _c.label = 37;
                    case 37:
                        _c.trys.push([37, 39, , 40]);
                        return [4 /*yield*/, xrpl_escrow_service_1.xrplEscrowService.finishEscrow({
                                ownerAddress: platformAddress_1,
                                escrowSequence: escrowDetails.sequence,
                                condition: escrowDetails.condition,
                                fulfillment: undefined, // TODO: Implement fulfillment if condition exists
                                walletSecret: platformSecret,
                            })];
                    case 38:
                        finishTxHash = _c.sent();
                        console.log('[Escrow Release] Escrow finished on XRPL:', {
                            txHash: finishTxHash,
                            escrowSequence: escrowDetails.sequence,
                        });
                        return [3 /*break*/, 40];
                    case 39:
                        error_10 = _c.sent();
                        errorMessage = error_10 instanceof Error ? error_10.message : String(error_10);
                        console.error('[Escrow Release] Failed to finish escrow on XRPL:', errorMessage);
                        throw new Error("Failed to finish escrow on XRPL: ".concat(errorMessage));
                    case 40: return [4 /*yield*/, adminClient
                            .from('escrows')
                            .update({
                            status: 'completed',
                            progress: 100,
                            completed_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                            description: escrow_2.description
                                ? "".concat(escrow_2.description, " | Released: ").concat(finishTxHash)
                                : "Escrow released: ".concat(finishTxHash),
                        })
                            .eq('id', escrowId)
                            .select()
                            .single()];
                    case 41:
                        updatedEscrow = (_c.sent()).data;
                        // Create completed transaction record
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .insert({
                                user_id: userId,
                                type: 'escrow_release',
                                amount_xrp: parseFloat(escrow_2.amount_xrp),
                                amount_usd: parseFloat(escrow_2.amount_usd),
                                xrpl_tx_hash: finishTxHash,
                                status: 'completed',
                                escrow_id: escrowId,
                                description: notes
                                    ? "".concat(notes, " | XRPL TX: ").concat(finishTxHash)
                                    : "Escrow release: ".concat(escrow_2.description || 'No description', " | XRPL TX: ").concat(finishTxHash),
                            })];
                    case 42:
                        // Create completed transaction record
                        _c.sent();
                        if (!updatedEscrow) return [3 /*break*/, 56];
                        _c.label = 43;
                    case 43:
                        _c.trys.push([43, 48, , 49]);
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', updatedEscrow.user_id)
                                .single()];
                    case 44:
                        senderWallet = (_c.sent()).data;
                        if (!senderWallet) return [3 /*break*/, 47];
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(senderWallet.xrpl_address)];
                    case 45:
                        senderBalances = _c.sent();
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: senderBalances.xrp,
                                balance_usdt: senderBalances.usdt,
                                balance_usdc: senderBalances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('user_id', updatedEscrow.user_id)];
                    case 46:
                        _c.sent();
                        _c.label = 47;
                    case 47: return [3 /*break*/, 49];
                    case 48:
                        error_11 = _c.sent();
                        console.error('Error updating sender wallet balance:', error_11);
                        return [3 /*break*/, 49];
                    case 49:
                        if (!updatedEscrow.counterparty_id) return [3 /*break*/, 56];
                        _c.label = 50;
                    case 50:
                        _c.trys.push([50, 55, , 56]);
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', updatedEscrow.counterparty_id)
                                .single()];
                    case 51:
                        receiverWallet = (_c.sent()).data;
                        if (!receiverWallet) return [3 /*break*/, 54];
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(receiverWallet.xrpl_address)];
                    case 52:
                        receiverBalances = _c.sent();
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: receiverBalances.xrp,
                                balance_usdt: receiverBalances.usdt,
                                balance_usdc: receiverBalances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('user_id', updatedEscrow.counterparty_id)];
                    case 53:
                        _c.sent();
                        _c.label = 54;
                    case 54: return [3 /*break*/, 56];
                    case 55:
                        error_12 = _c.sent();
                        console.error('Error updating receiver wallet balance:', error_12);
                        return [3 /*break*/, 56];
                    case 56:
                        userIds = [updatedEscrow.user_id];
                        if (updatedEscrow.counterparty_id)
                            userIds.push(updatedEscrow.counterparty_id);
                        return [4 /*yield*/, this.getPartyNames(userIds)];
                    case 57:
                        partyNames = _c.sent();
                        return [4 /*yield*/, this.getMilestones(updatedEscrow.id)];
                    case 58:
                        milestones = _c.sent();
                        year = new Date(updatedEscrow.created_at).getFullYear();
                        formattedEscrowId = this.formatEscrowId(year, updatedEscrow.escrow_sequence || 1);
                        formattedEscrow = {
                            id: updatedEscrow.id,
                            escrowId: formattedEscrowId,
                            userId: updatedEscrow.user_id,
                            counterpartyId: updatedEscrow.counterparty_id || '',
                            initiatorName: partyNames[updatedEscrow.user_id] || 'Unknown',
                            counterpartyName: updatedEscrow.counterparty_id ? partyNames[updatedEscrow.counterparty_id] : undefined,
                            amount: {
                                usd: parseFloat(updatedEscrow.amount_usd),
                                xrp: parseFloat(updatedEscrow.amount_xrp),
                            },
                            status: updatedEscrow.status,
                            transactionType: updatedEscrow.transaction_type,
                            industry: updatedEscrow.industry || null,
                            progress: 100,
                            description: updatedEscrow.description || undefined,
                            xrplEscrowId: updatedEscrow.xrpl_escrow_id || undefined,
                            createdAt: updatedEscrow.created_at,
                            updatedAt: updatedEscrow.updated_at,
                            completedAt: updatedEscrow.completed_at || undefined,
                            payerEmail: updatedEscrow.payer_email || undefined,
                            payerName: updatedEscrow.payer_name || undefined,
                            payerPhone: updatedEscrow.payer_phone || undefined,
                            counterpartyEmail: updatedEscrow.counterparty_email || undefined,
                            counterpartyPhone: updatedEscrow.counterparty_phone || undefined,
                            releaseType: updatedEscrow.release_type,
                            expectedCompletionDate: updatedEscrow.expected_completion_date || undefined,
                            expectedReleaseDate: updatedEscrow.expected_release_date || undefined,
                            disputeResolutionPeriod: updatedEscrow.dispute_resolution_period || undefined,
                            releaseConditions: updatedEscrow.release_conditions || undefined,
                            milestones: milestones.length > 0 ? milestones : undefined,
                        };
                        _c.label = 59;
                    case 59:
                        _c.trys.push([59, 64, , 65]);
                        if (!updatedEscrow.user_id) return [3 /*break*/, 61];
                        return [4 /*yield*/, notification_service_1.notificationService.createNotification({
                                userId: updatedEscrow.user_id,
                                type: 'escrow_completed',
                                title: 'Escrow released',
                                message: 'Funds for your escrow have been released.',
                                metadata: {
                                    escrowId: updatedEscrow.id,
                                    xrplTxHash: updatedEscrow.xrpl_escrow_id,
                                },
                            })];
                    case 60:
                        _c.sent();
                        _c.label = 61;
                    case 61:
                        if (!updatedEscrow.counterparty_id) return [3 /*break*/, 63];
                        return [4 /*yield*/, notification_service_1.notificationService.createNotification({
                                userId: updatedEscrow.counterparty_id,
                                type: 'escrow_completed',
                                title: 'Escrow completed',
                                message: 'You received funds from a completed escrow.',
                                metadata: {
                                    escrowId: updatedEscrow.id,
                                    xrplTxHash: updatedEscrow.xrpl_escrow_id,
                                },
                            })];
                    case 62:
                        _c.sent();
                        _c.label = 63;
                    case 63: return [3 /*break*/, 65];
                    case 64:
                        notifyError_2 = _c.sent();
                        console.warn('Failed to create escrow completed notifications:', notifyError_2);
                        return [3 /*break*/, 65];
                    case 65: return [2 /*return*/, {
                            success: true,
                            message: 'Escrow released successfully',
                            data: formattedEscrow,
                        }];
                    case 66:
                        xrplError_1 = _c.sent();
                        errorMessage = xrplError_1 instanceof Error ? xrplError_1.message : String(xrplError_1);
                        console.error('[Escrow Release] XRPL finish escrow error:', {
                            error: errorMessage,
                            escrowId: escrowId,
                            txHash: escrow_2.xrpl_escrow_id,
                        });
                        // DO NOT update database if XRPL transaction fails
                        return [2 /*return*/, {
                                success: false,
                                message: "Failed to release escrow on XRPL: ".concat(errorMessage),
                                error: 'XRPL transaction failed',
                            }];
                    case 67: return [3 /*break*/, 69];
                    case 68:
                        error_13 = _c.sent();
                        console.error('Error releasing escrow:', error_13);
                        return [2 /*return*/, {
                                success: false,
                                message: error_13 instanceof Error ? error_13.message : 'Failed to release escrow',
                                error: error_13 instanceof Error ? error_13.message : 'Failed to release escrow',
                            }];
                    case 69: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get XUMM payload status for escrow release and complete the release if signed
     * Similar to getXUMMPayloadStatus for deposits
     */
    EscrowService.prototype.getEscrowReleaseXUMMStatus = function (userId, escrowId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, escrow, fetchError, transaction, uuidMatch, xummUuid, payloadStatus, submitResult, finishTxHash, updatedEscrow, senderWallet, senderBalances, error_14, receiverWallet, receiverBalances, error_15, userIds, partyNames, milestones, year, formattedEscrowId, formattedEscrow, finishTxHash, updatedEscrow, userIds, partyNames, milestones, year, formattedEscrowId, formattedEscrow, error_16;
            var _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _g.trys.push([0, 29, , 30]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('*')
                                .eq('id', escrowId)
                                .or("user_id.eq.".concat(userId, ",counterparty_id.eq.").concat(userId))
                                .single()];
                    case 1:
                        _a = _g.sent(), escrow = _a.data, fetchError = _a.error;
                        if (fetchError || !escrow) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Escrow not found or access denied',
                                    error: 'Escrow not found or access denied',
                                }];
                        }
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('*')
                                .eq('escrow_id', escrowId)
                                .eq('type', 'escrow_release')
                                .eq('status', 'pending')
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .maybeSingle()];
                    case 2:
                        transaction = (_g.sent()).data;
                        if (!transaction) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'No pending escrow release transaction found',
                                    error: 'No pending transaction',
                                }];
                        }
                        uuidMatch = (_b = transaction.description) === null || _b === void 0 ? void 0 : _b.match(/XUMM_UUID:([a-f0-9-]+)/i);
                        if (!uuidMatch) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'XUMM UUID not found for this escrow release',
                                    error: 'XUMM UUID not found',
                                }];
                        }
                        xummUuid = uuidMatch[1];
                        return [4 /*yield*/, xumm_service_1.xummService.getPayloadStatus(xummUuid)];
                    case 3:
                        payloadStatus = _g.sent();
                        if (!(payloadStatus.meta.signed && ((_c = payloadStatus.response) === null || _c === void 0 ? void 0 : _c.hex))) return [3 /*break*/, 23];
                        // Case 1: Transaction signed but not yet submitted to XRPL
                        console.log('[Escrow Release XUMM] Submitting signed transaction to XRPL');
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.submitSignedTransaction(payloadStatus.response.hex)];
                    case 4:
                        submitResult = _g.sent();
                        if (submitResult.status !== 'tesSUCCESS') {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Escrow release transaction failed on XRPL: ".concat(submitResult.status),
                                    error: 'XRPL transaction failed',
                                    data: {
                                        signed: true,
                                        signedTxBlob: payloadStatus.response.hex,
                                        cancelled: payloadStatus.meta.cancelled,
                                        expired: payloadStatus.meta.expired,
                                        xrplTxHash: submitResult.hash,
                                    },
                                }];
                        }
                        finishTxHash = submitResult.hash;
                        // Update transaction record
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                xrpl_tx_hash: finishTxHash,
                                status: 'completed',
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transaction.id)];
                    case 5:
                        // Update transaction record
                        _g.sent();
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .update({
                                status: 'completed',
                                progress: 100,
                                completed_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', escrowId)
                                .select()
                                .single()];
                    case 6:
                        updatedEscrow = (_g.sent()).data;
                        if (!updatedEscrow) return [3 /*break*/, 20];
                        _g.label = 7;
                    case 7:
                        _g.trys.push([7, 12, , 13]);
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', updatedEscrow.user_id)
                                .single()];
                    case 8:
                        senderWallet = (_g.sent()).data;
                        if (!senderWallet) return [3 /*break*/, 11];
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(senderWallet.xrpl_address)];
                    case 9:
                        senderBalances = _g.sent();
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: senderBalances.xrp,
                                balance_usdt: senderBalances.usdt,
                                balance_usdc: senderBalances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('user_id', updatedEscrow.user_id)];
                    case 10:
                        _g.sent();
                        _g.label = 11;
                    case 11: return [3 /*break*/, 13];
                    case 12:
                        error_14 = _g.sent();
                        console.error('Error updating sender wallet balance:', error_14);
                        return [3 /*break*/, 13];
                    case 13:
                        if (!updatedEscrow.counterparty_id) return [3 /*break*/, 20];
                        _g.label = 14;
                    case 14:
                        _g.trys.push([14, 19, , 20]);
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', updatedEscrow.counterparty_id)
                                .single()];
                    case 15:
                        receiverWallet = (_g.sent()).data;
                        if (!receiverWallet) return [3 /*break*/, 18];
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(receiverWallet.xrpl_address)];
                    case 16:
                        receiverBalances = _g.sent();
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: receiverBalances.xrp,
                                balance_usdt: receiverBalances.usdt,
                                balance_usdc: receiverBalances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('user_id', updatedEscrow.counterparty_id)];
                    case 17:
                        _g.sent();
                        _g.label = 18;
                    case 18: return [3 /*break*/, 20];
                    case 19:
                        error_15 = _g.sent();
                        console.error('Error updating receiver wallet balance:', error_15);
                        return [3 /*break*/, 20];
                    case 20:
                        userIds = [updatedEscrow.user_id];
                        if (updatedEscrow.counterparty_id)
                            userIds.push(updatedEscrow.counterparty_id);
                        return [4 /*yield*/, this.getPartyNames(userIds)];
                    case 21:
                        partyNames = _g.sent();
                        return [4 /*yield*/, this.getMilestones(updatedEscrow.id)];
                    case 22:
                        milestones = _g.sent();
                        year = new Date(updatedEscrow.created_at).getFullYear();
                        formattedEscrowId = this.formatEscrowId(year, updatedEscrow.escrow_sequence || 1);
                        formattedEscrow = {
                            id: updatedEscrow.id,
                            escrowId: formattedEscrowId,
                            userId: updatedEscrow.user_id,
                            counterpartyId: updatedEscrow.counterparty_id || '',
                            initiatorName: partyNames[updatedEscrow.user_id] || 'Unknown',
                            counterpartyName: updatedEscrow.counterparty_id ? partyNames[updatedEscrow.counterparty_id] : undefined,
                            amount: {
                                usd: parseFloat(updatedEscrow.amount_usd),
                                xrp: parseFloat(updatedEscrow.amount_xrp),
                            },
                            status: updatedEscrow.status,
                            transactionType: updatedEscrow.transaction_type,
                            industry: updatedEscrow.industry || null,
                            progress: 100,
                            description: updatedEscrow.description || undefined,
                            xrplEscrowId: updatedEscrow.xrpl_escrow_id || undefined,
                            createdAt: updatedEscrow.created_at,
                            updatedAt: updatedEscrow.updated_at,
                            completedAt: updatedEscrow.completed_at || undefined,
                            payerEmail: updatedEscrow.payer_email || undefined,
                            payerName: updatedEscrow.payer_name || undefined,
                            payerPhone: updatedEscrow.payer_phone || undefined,
                            counterpartyEmail: updatedEscrow.counterparty_email || undefined,
                            counterpartyPhone: updatedEscrow.counterparty_phone || undefined,
                            releaseType: updatedEscrow.release_type,
                            expectedCompletionDate: updatedEscrow.expected_completion_date || undefined,
                            expectedReleaseDate: updatedEscrow.expected_release_date || undefined,
                            disputeResolutionPeriod: updatedEscrow.dispute_resolution_period || undefined,
                            releaseConditions: updatedEscrow.release_conditions || undefined,
                            milestones: milestones.length > 0 ? milestones : undefined,
                        };
                        return [2 /*return*/, {
                                success: true,
                                message: 'Escrow released successfully',
                                data: {
                                    signed: true,
                                    signedTxBlob: payloadStatus.response.hex,
                                    cancelled: false,
                                    expired: false,
                                    xrplTxHash: finishTxHash,
                                    escrow: formattedEscrow,
                                },
                            }];
                    case 23:
                        if (!(payloadStatus.meta.signed && ((_d = payloadStatus.response) === null || _d === void 0 ? void 0 : _d.txid) && payloadStatus.meta.submit)) return [3 /*break*/, 28];
                        finishTxHash = payloadStatus.response.txid;
                        // Update transaction record
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                xrpl_tx_hash: finishTxHash,
                                status: 'completed',
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transaction.id)];
                    case 24:
                        // Update transaction record
                        _g.sent();
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .update({
                                status: 'completed',
                                progress: 100,
                                completed_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', escrowId)
                                .select()
                                .single()];
                    case 25:
                        updatedEscrow = (_g.sent()).data;
                        if (!updatedEscrow) return [3 /*break*/, 28];
                        userIds = [updatedEscrow.user_id];
                        if (updatedEscrow.counterparty_id)
                            userIds.push(updatedEscrow.counterparty_id);
                        return [4 /*yield*/, this.getPartyNames(userIds)];
                    case 26:
                        partyNames = _g.sent();
                        return [4 /*yield*/, this.getMilestones(updatedEscrow.id)];
                    case 27:
                        milestones = _g.sent();
                        year = new Date(updatedEscrow.created_at).getFullYear();
                        formattedEscrowId = this.formatEscrowId(year, updatedEscrow.escrow_sequence || 1);
                        formattedEscrow = {
                            id: updatedEscrow.id,
                            escrowId: formattedEscrowId,
                            userId: updatedEscrow.user_id,
                            counterpartyId: updatedEscrow.counterparty_id || '',
                            initiatorName: partyNames[updatedEscrow.user_id] || 'Unknown',
                            counterpartyName: updatedEscrow.counterparty_id ? partyNames[updatedEscrow.counterparty_id] : undefined,
                            amount: {
                                usd: parseFloat(updatedEscrow.amount_usd),
                                xrp: parseFloat(updatedEscrow.amount_xrp),
                            },
                            status: updatedEscrow.status,
                            transactionType: updatedEscrow.transaction_type,
                            industry: updatedEscrow.industry || null,
                            progress: 100,
                            description: updatedEscrow.description || undefined,
                            xrplEscrowId: updatedEscrow.xrpl_escrow_id || undefined,
                            createdAt: updatedEscrow.created_at,
                            updatedAt: updatedEscrow.updated_at,
                            completedAt: updatedEscrow.completed_at || undefined,
                            payerEmail: updatedEscrow.payer_email || undefined,
                            payerName: updatedEscrow.payer_name || undefined,
                            payerPhone: updatedEscrow.payer_phone || undefined,
                            counterpartyEmail: updatedEscrow.counterparty_email || undefined,
                            counterpartyPhone: updatedEscrow.counterparty_phone || undefined,
                            releaseType: updatedEscrow.release_type,
                            expectedCompletionDate: updatedEscrow.expected_completion_date || undefined,
                            expectedReleaseDate: updatedEscrow.expected_release_date || undefined,
                            disputeResolutionPeriod: updatedEscrow.dispute_resolution_period || undefined,
                            releaseConditions: updatedEscrow.release_conditions || undefined,
                            milestones: milestones.length > 0 ? milestones : undefined,
                        };
                        return [2 /*return*/, {
                                success: true,
                                message: 'Escrow released successfully (auto-submitted by XUMM)',
                                data: {
                                    signed: true,
                                    signedTxBlob: null,
                                    cancelled: false,
                                    expired: false,
                                    xrplTxHash: finishTxHash,
                                    escrow: formattedEscrow,
                                },
                            }];
                    case 28: 
                    // Transaction not yet signed
                    return [2 /*return*/, {
                            success: true,
                            message: 'Transaction status retrieved',
                            data: {
                                signed: payloadStatus.meta.signed,
                                signedTxBlob: ((_e = payloadStatus.response) === null || _e === void 0 ? void 0 : _e.hex) || null,
                                cancelled: payloadStatus.meta.cancelled,
                                expired: payloadStatus.meta.expired,
                                xrplTxHash: ((_f = payloadStatus.response) === null || _f === void 0 ? void 0 : _f.txid) || null,
                            },
                        }];
                    case 29:
                        error_16 = _g.sent();
                        console.error('Error getting escrow release XUMM status:', error_16);
                        return [2 /*return*/, {
                                success: false,
                                message: error_16 instanceof Error ? error_16.message : 'Failed to get XUMM status',
                                error: error_16 instanceof Error ? error_16.message : 'Failed to get XUMM status',
                            }];
                    case 30: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get XUMM payload status for escrow creation and finalize on XRPL when signed
     * Mirrors wallet.getXUMMPayloadStatus but for EscrowCreate + escrow records
     */
    EscrowService.prototype.getEscrowCreateXUMMStatus = function (userId, escrowId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, escrow, fetchError, transaction, uuidMatch, xummUuid, payloadStatus, xrplTxHash, submitResult, updatedEscrow, error_17;
            var _b, _c, _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        _h.trys.push([0, 14, , 15]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('*')
                                .eq('id', escrowId)
                                .or("user_id.eq.".concat(userId, ",counterparty_id.eq.").concat(userId))
                                .single()];
                    case 1:
                        _a = _h.sent(), escrow = _a.data, fetchError = _a.error;
                        if (fetchError || !escrow) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Escrow not found or access denied',
                                    error: 'Escrow not found or access denied',
                                }];
                        }
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('*')
                                .eq('escrow_id', escrowId)
                                .eq('type', 'escrow_create')
                                .eq('status', 'pending')
                                .order('created_at', { ascending: false })
                                .limit(1)
                                .maybeSingle()];
                    case 2:
                        transaction = (_h.sent()).data;
                        if (!transaction) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'No pending escrow create transaction found',
                                    error: 'No pending transaction',
                                }];
                        }
                        uuidMatch = (_b = transaction.description) === null || _b === void 0 ? void 0 : _b.match(/XUMM_UUID:([a-f0-9-]+)/i);
                        if (!uuidMatch) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'XUMM UUID not found for this escrow creation',
                                    error: 'XUMM UUID not found',
                                }];
                        }
                        xummUuid = uuidMatch[1];
                        return [4 /*yield*/, xumm_service_1.xummService.getPayloadStatus(xummUuid)];
                    case 3:
                        payloadStatus = _h.sent();
                        // If not yet resolved, return current status
                        if (!payloadStatus.meta.resolved) {
                            return [2 /*return*/, {
                                    success: true,
                                    message: 'Escrow creation pending user action in XUMM',
                                    data: {
                                        signed: payloadStatus.meta.signed,
                                        signedTxBlob: ((_c = payloadStatus.response) === null || _c === void 0 ? void 0 : _c.hex) || null,
                                        cancelled: payloadStatus.meta.cancelled,
                                        expired: payloadStatus.meta.expired,
                                        xrplTxHash: ((_d = payloadStatus.response) === null || _d === void 0 ? void 0 : _d.txid) || null,
                                        escrow: escrow,
                                    },
                                }];
                        }
                        if (!(payloadStatus.meta.cancelled || payloadStatus.meta.expired)) return [3 /*break*/, 5];
                        // Mark transaction as cancelled
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                status: 'cancelled',
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transaction.id)];
                    case 4:
                        // Mark transaction as cancelled
                        _h.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: payloadStatus.meta.cancelled
                                    ? 'Escrow creation cancelled in XUMM'
                                    : 'Escrow creation payload expired in XUMM',
                                data: {
                                    signed: false,
                                    signedTxBlob: null,
                                    cancelled: payloadStatus.meta.cancelled,
                                    expired: payloadStatus.meta.expired,
                                    xrplTxHash: null,
                                    escrow: escrow,
                                },
                            }];
                    case 5:
                        xrplTxHash = null;
                        if (!(payloadStatus.meta.signed && ((_e = payloadStatus.response) === null || _e === void 0 ? void 0 : _e.hex))) return [3 /*break*/, 7];
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.submitSignedTransaction(payloadStatus.response.hex)];
                    case 6:
                        submitResult = _h.sent();
                        if (submitResult.status !== 'tesSUCCESS') {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Escrow create transaction failed on XRPL: ".concat(submitResult.status),
                                    error: 'XRPL transaction failed',
                                    data: {
                                        signed: true,
                                        signedTxBlob: payloadStatus.response.hex,
                                        cancelled: false,
                                        expired: false,
                                        xrplTxHash: submitResult.hash || null,
                                        escrow: escrow,
                                    },
                                }];
                        }
                        xrplTxHash = submitResult.hash;
                        return [3 /*break*/, 10];
                    case 7:
                        if (!(payloadStatus.meta.signed &&
                            payloadStatus.meta.submit &&
                            ((_f = payloadStatus.response) === null || _f === void 0 ? void 0 : _f.txid))) return [3 /*break*/, 8];
                        // Case 2: XUMM auto-submitted the transaction (already on XRPL)
                        xrplTxHash = payloadStatus.response.txid;
                        return [3 /*break*/, 10];
                    case 8: 
                    // Signed = false but resolved (e.g. user declined)
                    return [4 /*yield*/, adminClient
                            .from('transactions')
                            .update({
                            status: 'cancelled',
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', transaction.id)];
                    case 9:
                        // Signed = false but resolved (e.g. user declined)
                        _h.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: 'Escrow creation not signed by user in XUMM',
                                data: {
                                    signed: false,
                                    signedTxBlob: null,
                                    cancelled: true,
                                    expired: false,
                                    xrplTxHash: null,
                                    escrow: escrow,
                                },
                            }];
                    case 10: 
                    // Finalize escrow in database: store real XRPL tx hash and mark active
                    return [4 /*yield*/, adminClient
                            .from('escrows')
                            .update({
                            xrpl_escrow_id: xrplTxHash,
                            status: 'active',
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', escrowId)];
                    case 11:
                        // Finalize escrow in database: store real XRPL tx hash and mark active
                        _h.sent();
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                status: 'completed',
                                xrpl_tx_hash: xrplTxHash,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transaction.id)];
                    case 12:
                        _h.sent();
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('*')
                                .eq('id', escrowId)
                                .single()];
                    case 13:
                        updatedEscrow = (_h.sent()).data;
                        return [2 /*return*/, {
                                success: true,
                                message: 'Escrow created successfully on XRPL',
                                data: {
                                    signed: true,
                                    signedTxBlob: ((_g = payloadStatus.response) === null || _g === void 0 ? void 0 : _g.hex) || null,
                                    cancelled: false,
                                    expired: false,
                                    xrplTxHash: xrplTxHash,
                                    escrow: updatedEscrow,
                                },
                            }];
                    case 14:
                        error_17 = _h.sent();
                        console.error('Error getting escrow create XUMM status:', error_17);
                        return [2 /*return*/, {
                                success: false,
                                message: error_17 instanceof Error ? error_17.message : 'Failed to get escrow create XUMM status',
                                error: error_17 instanceof Error ? error_17.message : 'Failed to get escrow create XUMM status',
                            }];
                    case 15: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Cancel an escrow
     */
    EscrowService.prototype.cancelEscrow = function (userId, escrowId, reason) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, escrow, fetchError, wallet, cancelTxHash, xrplError_2, _b, updatedEscrow, updateError, userIds, partyNames, milestones, year, formattedEscrowId, formattedEscrow, error_18;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 11, , 12]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('*')
                                .eq('id', escrowId)
                                .or("user_id.eq.".concat(userId, ",counterparty_id.eq.").concat(userId))
                                .single()];
                    case 1:
                        _a = _c.sent(), escrow = _a.data, fetchError = _a.error;
                        if (fetchError || !escrow) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Escrow not found or access denied',
                                    error: 'Escrow not found or access denied',
                                }];
                        }
                        // Check if escrow can be cancelled
                        if (escrow.status === 'completed') {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Cannot cancel a completed escrow',
                                    error: 'Cannot cancel a completed escrow',
                                }];
                        }
                        if (escrow.status === 'cancelled') {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Escrow is already cancelled',
                                    error: 'Escrow is already cancelled',
                                }];
                        }
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', userId)
                                .single()];
                    case 2:
                        wallet = (_c.sent()).data;
                        if (!wallet) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Wallet not found',
                                    error: 'Wallet not found',
                                }];
                        }
                        cancelTxHash = void 0;
                        if (!escrow.xrpl_escrow_id) return [3 /*break*/, 6];
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, xrpl_escrow_service_1.xrplEscrowService.cancelEscrow({
                                ownerAddress: wallet.xrpl_address,
                                escrowSequence: 0, // This should be retrieved from XRPL
                            })];
                    case 4:
                        cancelTxHash = _c.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        xrplError_2 = _c.sent();
                        console.error('XRPL cancel escrow error:', xrplError_2);
                        return [3 /*break*/, 6];
                    case 6: return [4 /*yield*/, adminClient
                            .from('escrows')
                            .update({
                            status: 'cancelled',
                            cancel_reason: reason,
                        })
                            .eq('id', escrowId)
                            .select()
                            .single()];
                    case 7:
                        _b = _c.sent(), updatedEscrow = _b.data, updateError = _b.error;
                        if (updateError || !updatedEscrow) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to cancel escrow',
                                    error: 'Failed to cancel escrow',
                                }];
                        }
                        // Create transaction record
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .insert({
                                user_id: userId,
                                type: 'escrow_cancel',
                                amount_xrp: parseFloat(updatedEscrow.amount_xrp),
                                amount_usd: parseFloat(updatedEscrow.amount_usd),
                                xrpl_tx_hash: cancelTxHash,
                                status: 'completed',
                                escrow_id: updatedEscrow.id,
                                description: "Escrow cancelled: ".concat(reason),
                            })];
                    case 8:
                        // Create transaction record
                        _c.sent();
                        userIds = [updatedEscrow.user_id];
                        if (updatedEscrow.counterparty_id)
                            userIds.push(updatedEscrow.counterparty_id);
                        return [4 /*yield*/, this.getPartyNames(userIds)];
                    case 9:
                        partyNames = _c.sent();
                        return [4 /*yield*/, this.getMilestones(updatedEscrow.id)];
                    case 10:
                        milestones = _c.sent();
                        year = new Date(updatedEscrow.created_at).getFullYear();
                        formattedEscrowId = this.formatEscrowId(year, updatedEscrow.escrow_sequence || 1);
                        formattedEscrow = {
                            id: updatedEscrow.id,
                            escrowId: formattedEscrowId,
                            userId: updatedEscrow.user_id,
                            counterpartyId: updatedEscrow.counterparty_id || '',
                            initiatorName: partyNames[updatedEscrow.user_id] || 'Unknown',
                            counterpartyName: updatedEscrow.counterparty_id ? partyNames[updatedEscrow.counterparty_id] : undefined,
                            amount: {
                                usd: parseFloat(updatedEscrow.amount_usd),
                                xrp: parseFloat(updatedEscrow.amount_xrp),
                            },
                            status: updatedEscrow.status,
                            transactionType: updatedEscrow.transaction_type,
                            industry: updatedEscrow.industry || null,
                            progress: parseFloat(updatedEscrow.progress || 0),
                            description: updatedEscrow.description || undefined,
                            xrplEscrowId: updatedEscrow.xrpl_escrow_id || undefined,
                            createdAt: updatedEscrow.created_at,
                            updatedAt: updatedEscrow.updated_at,
                            completedAt: updatedEscrow.completed_at || undefined,
                            cancelReason: reason,
                            // Contact information
                            payerEmail: updatedEscrow.payer_email || undefined,
                            payerName: updatedEscrow.payer_name || undefined,
                            payerPhone: updatedEscrow.payer_phone || undefined,
                            counterpartyEmail: updatedEscrow.counterparty_email || undefined,
                            counterpartyPhone: updatedEscrow.counterparty_phone || undefined,
                            // Step 2: Terms and Release conditions
                            releaseType: updatedEscrow.release_type,
                            expectedCompletionDate: updatedEscrow.expected_completion_date || undefined,
                            expectedReleaseDate: updatedEscrow.expected_release_date || undefined,
                            disputeResolutionPeriod: updatedEscrow.dispute_resolution_period || undefined,
                            releaseConditions: updatedEscrow.release_conditions || undefined,
                            milestones: milestones.length > 0 ? milestones : undefined,
                        };
                        return [2 /*return*/, {
                                success: true,
                                message: 'Escrow cancelled successfully',
                                data: formattedEscrow,
                            }];
                    case 11:
                        error_18 = _c.sent();
                        console.error('Error cancelling escrow:', error_18);
                        return [2 /*return*/, {
                                success: false,
                                message: error_18 instanceof Error ? error_18.message : 'Failed to cancel escrow',
                                error: error_18 instanceof Error ? error_18.message : 'Failed to cancel escrow',
                            }];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get unique industries, optionally filtered by transaction type
     */
    EscrowService.prototype.getUniqueIndustries = function (userId, transactionType) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, query, _a, escrows, error, industries, error_19;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        query = adminClient
                            .from('escrows')
                            .select('industry')
                            .or("user_id.eq.".concat(userId, ",counterparty_id.eq.").concat(userId))
                            .not('industry', 'is', null);
                        // Filter by transaction type if provided
                        if (transactionType) {
                            query = query.eq('transaction_type', transactionType);
                        }
                        return [4 /*yield*/, query];
                    case 1:
                        _a = _b.sent(), escrows = _a.data, error = _a.error;
                        if (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch industries',
                                    error: 'Failed to fetch industries',
                                }];
                        }
                        industries = __spreadArray([], new Set((escrows || [])
                            .map(function (e) { return e.industry; })
                            .filter(function (ind) { return ind !== null && ind !== undefined; })
                            .sort()), true);
                        return [2 /*return*/, {
                                success: true,
                                message: 'Industries retrieved successfully',
                                data: {
                                    industries: industries,
                                },
                            }];
                    case 2:
                        error_19 = _b.sent();
                        console.error('Error getting industries:', error_19);
                        return [2 /*return*/, {
                                success: false,
                                message: error_19 instanceof Error ? error_19.message : 'Failed to get industries',
                                error: error_19 instanceof Error ? error_19.message : 'Failed to get industries',
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return EscrowService;
}());
exports.EscrowService = EscrowService;
exports.escrowService = new EscrowService();
