"use strict";
/**
 * Savings Service
 * Aggregates savings allocation, cashflow, wallets, and transaction history
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
exports.savingsService = exports.SavingsService = void 0;
var supabase_1 = require("../../config/supabase");
var SavingsService = /** @class */ (function () {
    function SavingsService() {
    }
    /**
     * Determine current period range and label based on filter
     * range: this_month | last_month | this_year
     */
    SavingsService.prototype.getPeriodRange = function (range) {
        var now = new Date();
        var year = now.getUTCFullYear();
        var monthIndex = now.getUTCMonth();
        if (range === 'last_month') {
            var lastMonthIndex = monthIndex - 1 >= 0 ? monthIndex - 1 : 11;
            var lastMonthYear = monthIndex - 1 >= 0 ? year : year - 1;
            var start_1 = new Date(Date.UTC(lastMonthYear, lastMonthIndex, 1, 0, 0, 0, 0));
            var end_1 = new Date(Date.UTC(lastMonthYear, lastMonthIndex + 1, 0, 23, 59, 59, 999));
            return { start: start_1, end: end_1, label: 'Last Month' };
        }
        if (range === 'this_year') {
            var start_2 = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
            var end_2 = now;
            return { start: start_2, end: end_2, label: 'This Year' };
        }
        // Default: this_month
        var start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
        var end = now;
        return { start: start, end: end, label: 'This Month' };
    };
    /**
     * Get previous period range given a current range
     */
    SavingsService.prototype.getPreviousPeriodRange = function (range) {
        var now = new Date();
        var year = now.getUTCFullYear();
        var monthIndex = now.getUTCMonth();
        if (range === 'last_month') {
            // Previous of last_month = month before last
            var m = monthIndex - 2;
            var y = year;
            if (m < 0) {
                m += 12;
                y -= 1;
            }
            var start_3 = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
            var end_3 = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
            return { start: start_3, end: end_3 };
        }
        if (range === 'this_year') {
            var prevYear_1 = year - 1;
            var start_4 = new Date(Date.UTC(prevYear_1, 0, 1, 0, 0, 0, 0));
            var end_4 = new Date(Date.UTC(prevYear_1, 11, 31, 23, 59, 59, 999));
            return { start: start_4, end: end_4 };
        }
        // Default: previous month of this_month
        var prevMonthIndex = monthIndex - 1 >= 0 ? monthIndex - 1 : 11;
        var prevYear = monthIndex - 1 >= 0 ? year : year - 1;
        var start = new Date(Date.UTC(prevYear, prevMonthIndex, 1, 0, 0, 0, 0));
        var end = new Date(Date.UTC(prevYear, prevMonthIndex + 1, 0, 23, 59, 59, 999));
        return { start: start, end: end };
    };
    /**
     * Get a simple date range based on range filter for transactions
     * range: daily | weekly | monthly
     */
    SavingsService.prototype.getDateRange = function (range) {
        var end = new Date();
        var start = new Date(end);
        if (range === 'daily') {
            start.setUTCDate(end.getUTCDate() - 1);
        }
        else if (range === 'weekly') {
            start.setUTCDate(end.getUTCDate() - 7);
        }
        else {
            // monthly or default: last 30 days
            start.setUTCDate(end.getUTCDate() - 30);
        }
        return { start: start, end: end };
    };
    /**
     * Determine direction (received/spent) from transaction type
     */
    SavingsService.prototype.getDirection = function (type) {
        var receivedTypes = ['deposit', 'escrow_release', 'transfer'];
        return receivedTypes.includes(type) ? 'received' : 'spent';
    };
    /**
     * Get savings allocation summary
     * GET /api/savings/summary
     */
    SavingsService.prototype.getSummary = function (userId, range) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, start, end, label, prevRange, _b, currentTx, currentError, _c, prevTx, prevError, currentRows, prevRows, sumByWallet, currentTotals, prevTotals, totalUsd_1, prevTotalUsd, walletIds, categoryMap_1, wallets, categories, changePercent, error_1;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 5, , 6]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        _a = this.getPeriodRange(range), start = _a.start, end = _a.end, label = _a.label;
                        prevRange = this.getPreviousPeriodRange(range);
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('savings_wallet_id, amount_usd')
                                .eq('user_id', userId)
                                .not('savings_wallet_id', 'is', null)
                                .gte('created_at', start.toISOString())
                                .lte('created_at', end.toISOString())];
                    case 1:
                        _b = _d.sent(), currentTx = _b.data, currentError = _b.error;
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('savings_wallet_id, amount_usd')
                                .eq('user_id', userId)
                                .not('savings_wallet_id', 'is', null)
                                .gte('created_at', prevRange.start.toISOString())
                                .lte('created_at', prevRange.end.toISOString())];
                    case 2:
                        _c = _d.sent(), prevTx = _c.data, prevError = _c.error;
                        if (currentError || prevError) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch savings summary',
                                    error: 'Failed to fetch savings summary',
                                }];
                        }
                        currentRows = currentTx || [];
                        prevRows = prevTx || [];
                        sumByWallet = function (rows) {
                            var totals = new Map();
                            for (var _i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                                var row = rows_1[_i];
                                if (!row.savings_wallet_id)
                                    continue;
                                var key = row.savings_wallet_id;
                                var current = totals.get(key) || 0;
                                totals.set(key, current + parseFloat(row.amount_usd));
                            }
                            return totals;
                        };
                        currentTotals = sumByWallet(currentRows);
                        prevTotals = sumByWallet(prevRows);
                        totalUsd_1 = Array.from(currentTotals.values()).reduce(function (sum, v) { return sum + v; }, 0);
                        prevTotalUsd = Array.from(prevTotals.values()).reduce(function (sum, v) { return sum + v; }, 0);
                        walletIds = Array.from(new Set(__spreadArray(__spreadArray([], Array.from(currentTotals.keys()), true), Array.from(prevTotals.keys()), true)));
                        categoryMap_1 = {};
                        if (!(walletIds.length > 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, adminClient
                                .from('savings_wallets')
                                .select('id, name')
                                .in('id', walletIds)];
                    case 3:
                        wallets = (_d.sent()).data;
                        categoryMap_1 = (wallets || []).reduce(function (acc, w) {
                            acc[w.id] = { name: w.name };
                            return acc;
                        }, {});
                        _d.label = 4;
                    case 4:
                        categories = Array.from(currentTotals.entries()).map(function (_a) {
                            var _b;
                            var walletId = _a[0], amount = _a[1];
                            var percentage = totalUsd_1 > 0 ? (amount / totalUsd_1) * 100 : 0;
                            return {
                                walletId: walletId,
                                name: ((_b = categoryMap_1[walletId]) === null || _b === void 0 ? void 0 : _b.name) || 'Unnamed',
                                amountUsd: amount,
                                percentage: parseFloat(percentage.toFixed(2)),
                            };
                        });
                        changePercent = undefined;
                        if (prevTotalUsd > 0) {
                            changePercent = ((totalUsd_1 - prevTotalUsd) / prevTotalUsd) * 100;
                        }
                        return [2 /*return*/, {
                                success: true,
                                message: 'Savings summary retrieved successfully',
                                data: {
                                    totalUsd: totalUsd_1,
                                    changePercent: changePercent,
                                    periodLabel: label,
                                    categories: categories,
                                },
                            }];
                    case 5:
                        error_1 = _d.sent();
                        console.error('Error getting savings summary:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                message: error_1 instanceof Error ? error_1.message : 'Failed to get savings summary',
                                error: error_1 instanceof Error ? error_1.message : 'Failed to get savings summary',
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get savings cashflow data
     * GET /api/savings/cashflow
     */
    SavingsService.prototype.getCashflow = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, _a, interval, from, to, adminClient, start, end, _b, rows, error, buckets, formatPeriod, _i, _c, row, period, bucket, direction, amount, points, error_2;
            var _this = this;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        userId = params.userId, _a = params.interval, interval = _a === void 0 ? 'monthly' : _a, from = params.from, to = params.to;
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, , 4]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        start = from ? new Date(from) : (function () {
                            var start = _this.getDateRange('monthly').start;
                            return start;
                        })();
                        end = to ? new Date(to) : new Date();
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('type, amount_usd, created_at')
                                .eq('user_id', userId)
                                .not('savings_wallet_id', 'is', null)
                                .gte('created_at', start.toISOString())
                                .lte('created_at', end.toISOString())];
                    case 2:
                        _b = _d.sent(), rows = _b.data, error = _b.error;
                        if (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch savings cashflow',
                                    error: 'Failed to fetch savings cashflow',
                                }];
                        }
                        buckets = new Map();
                        formatPeriod = function (dateStr) {
                            var d = new Date(dateStr);
                            if (interval === 'weekly') {
                                // Simple weekly label: YYYY-Www
                                var firstJan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                                var days = Math.floor((d.getTime() - firstJan.getTime()) / (1000 * 60 * 60 * 24));
                                var week = Math.floor(days / 7) + 1;
                                return "".concat(d.getUTCFullYear(), "-W").concat(week.toString().padStart(2, '0'));
                            }
                            // Monthly: Jan, Feb, ...
                            var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                            return monthNames[d.getUTCMonth()];
                        };
                        for (_i = 0, _c = rows || []; _i < _c.length; _i++) {
                            row = _c[_i];
                            period = formatPeriod(row.created_at);
                            bucket = buckets.get(period) || { receivedUsd: 0, spentUsd: 0 };
                            direction = this.getDirection(row.type);
                            amount = parseFloat(row.amount_usd);
                            if (direction === 'received') {
                                bucket.receivedUsd += amount;
                            }
                            else {
                                bucket.spentUsd += amount;
                            }
                            buckets.set(period, bucket);
                        }
                        points = Array.from(buckets.entries())
                            .sort(function (_a, _b) {
                            var a = _a[0];
                            var b = _b[0];
                            return a.localeCompare(b);
                        })
                            .map(function (_a) {
                            var period = _a[0], data = _a[1];
                            return ({
                                period: period,
                                receivedUsd: data.receivedUsd,
                                spentUsd: data.spentUsd,
                            });
                        });
                        return [2 /*return*/, {
                                success: true,
                                message: 'Savings cashflow retrieved successfully',
                                data: {
                                    interval: interval,
                                    points: points,
                                },
                            }];
                    case 3:
                        error_2 = _d.sent();
                        console.error('Error getting savings cashflow:', error_2);
                        return [2 /*return*/, {
                                success: false,
                                message: error_2 instanceof Error ? error_2.message : 'Failed to get savings cashflow',
                                error: error_2 instanceof Error ? error_2.message : 'Failed to get savings cashflow',
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get list of savings wallets and their balances
     * GET /api/savings/wallets
     */
    SavingsService.prototype.getWallets = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, wallets, walletsError, walletIds, totalsByWallet_1, txRows, _i, _b, row, key, current, totalUsd_2, items, error_3;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 4, , 5]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('savings_wallets')
                                .select('*')
                                .eq('user_id', userId)
                                .order('sort_order', { ascending: true })];
                    case 1:
                        _a = _c.sent(), wallets = _a.data, walletsError = _a.error;
                        if (walletsError) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch savings wallets',
                                    error: 'Failed to fetch savings wallets',
                                }];
                        }
                        walletIds = (wallets || []).map(function (w) { return w.id; });
                        totalsByWallet_1 = new Map();
                        if (!(walletIds.length > 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('savings_wallet_id, amount_usd')
                                .eq('user_id', userId)
                                .in('savings_wallet_id', walletIds)];
                    case 2:
                        txRows = (_c.sent()).data;
                        totalsByWallet_1 = new Map();
                        for (_i = 0, _b = txRows || []; _i < _b.length; _i++) {
                            row = _b[_i];
                            if (!row.savings_wallet_id)
                                continue;
                            key = row.savings_wallet_id;
                            current = totalsByWallet_1.get(key) || 0;
                            totalsByWallet_1.set(key, current + parseFloat(row.amount_usd));
                        }
                        _c.label = 3;
                    case 3:
                        totalUsd_2 = Array.from(totalsByWallet_1.values()).reduce(function (sum, v) { return sum + v; }, 0);
                        items = (wallets || []).map(function (w) {
                            var amountUsd = totalsByWallet_1.get(w.id) || 0;
                            var percentage = totalUsd_2 > 0 ? (amountUsd / totalUsd_2) * 100 : 0;
                            return {
                                id: w.id,
                                name: w.name,
                                amountUsd: amountUsd,
                                percentage: parseFloat(percentage.toFixed(2)),
                                targetAmountUsd: w.target_amount_usd ? parseFloat(w.target_amount_usd) : undefined,
                            };
                        });
                        return [2 /*return*/, {
                                success: true,
                                message: 'Savings wallets retrieved successfully',
                                data: {
                                    totalUsd: totalUsd_2,
                                    wallets: items,
                                },
                            }];
                    case 4:
                        error_3 = _c.sent();
                        console.error('Error getting savings wallets:', error_3);
                        return [2 /*return*/, {
                                success: false,
                                message: error_3 instanceof Error ? error_3.message : 'Failed to get savings wallets',
                                error: error_3 instanceof Error ? error_3.message : 'Failed to get savings wallets',
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a new savings wallet
     * POST /api/savings/wallets
     */
    SavingsService.prototype.createWallet = function (userId, body) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, name_1, targetAmountUsd, _a, wallet, error, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        name_1 = body.name, targetAmountUsd = body.targetAmountUsd;
                        return [4 /*yield*/, adminClient
                                .from('savings_wallets')
                                .insert({
                                user_id: userId,
                                name: name_1,
                                target_amount_usd: typeof targetAmountUsd === 'number' ? targetAmountUsd : null,
                            })
                                .select()
                                .single()];
                    case 1:
                        _a = _b.sent(), wallet = _a.data, error = _a.error;
                        if (error || !wallet) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to create savings wallet',
                                    error: 'Failed to create savings wallet',
                                }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                message: 'Savings wallet created successfully',
                                data: {
                                    totalUsd: 0,
                                    wallets: [
                                        {
                                            id: wallet.id,
                                            name: wallet.name,
                                            amountUsd: 0,
                                            percentage: 0,
                                            targetAmountUsd: wallet.target_amount_usd
                                                ? parseFloat(wallet.target_amount_usd)
                                                : undefined,
                                        },
                                    ],
                                },
                            }];
                    case 2:
                        error_4 = _b.sent();
                        console.error('Error creating savings wallet:', error_4);
                        return [2 /*return*/, {
                                success: false,
                                message: error_4 instanceof Error ? error_4.message : 'Failed to create savings wallet',
                                error: error_4 instanceof Error ? error_4.message : 'Failed to create savings wallet',
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get savings transaction history
     * GET /api/savings/transactions
     */
    SavingsService.prototype.getTransactions = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, walletId, _a, direction, range, _b, page, _c, pageSize, adminClient, _d, start, end, from, to, query, _e, rows, listError, countQuery, count, txRows, filtered, walletIds, walletNameMap_1, wallets, items, error_5;
            var _this = this;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        userId = params.userId, walletId = params.walletId, _a = params.direction, direction = _a === void 0 ? 'all' : _a, range = params.range, _b = params.page, page = _b === void 0 ? 1 : _b, _c = params.pageSize, pageSize = _c === void 0 ? 10 : _c;
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 6, , 7]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        _d = this.getDateRange(range), start = _d.start, end = _d.end;
                        from = (page - 1) * pageSize;
                        to = from + pageSize - 1;
                        query = adminClient
                            .from('transactions')
                            .select('*')
                            .eq('user_id', userId)
                            .not('savings_wallet_id', 'is', null)
                            .gte('created_at', start.toISOString())
                            .lte('created_at', end.toISOString());
                        if (walletId) {
                            query = query.eq('savings_wallet_id', walletId);
                        }
                        query = query.order('created_at', { ascending: false }).range(from, to);
                        return [4 /*yield*/, query];
                    case 2:
                        _e = _f.sent(), rows = _e.data, listError = _e.error;
                        if (listError) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch savings transactions',
                                    error: 'Failed to fetch savings transactions',
                                }];
                        }
                        countQuery = adminClient
                            .from('transactions')
                            .select('*', { count: 'exact', head: true })
                            .eq('user_id', userId)
                            .not('savings_wallet_id', 'is', null)
                            .gte('created_at', start.toISOString())
                            .lte('created_at', end.toISOString());
                        if (walletId) {
                            countQuery = countQuery.eq('savings_wallet_id', walletId);
                        }
                        return [4 /*yield*/, countQuery];
                    case 3:
                        count = (_f.sent()).count;
                        txRows = rows || [];
                        filtered = txRows.filter(function (row) {
                            var dir = _this.getDirection(row.type);
                            if (direction === 'all')
                                return true;
                            return dir === direction;
                        });
                        walletIds = Array.from(new Set(filtered.map(function (r) { return r.savings_wallet_id; }).filter(Boolean)));
                        walletNameMap_1 = {};
                        if (!(walletIds.length > 0)) return [3 /*break*/, 5];
                        return [4 /*yield*/, adminClient
                                .from('savings_wallets')
                                .select('id, name')
                                .in('id', walletIds)];
                    case 4:
                        wallets = (_f.sent()).data;
                        walletNameMap_1 = (wallets || []).reduce(function (acc, w) {
                            acc[w.id] = w.name;
                            return acc;
                        }, {});
                        _f.label = 5;
                    case 5:
                        items = filtered.map(function (row) {
                            var dir = _this.getDirection(row.type);
                            var label = dir === 'received' ? 'Received' : 'Spent';
                            var createdDate = row.created_at
                                ? new Date(row.created_at).toISOString().split('T')[0]
                                : '';
                            return {
                                id: row.id,
                                walletId: row.savings_wallet_id,
                                walletName: walletNameMap_1[row.savings_wallet_id] || undefined,
                                direction: dir,
                                txLabel: label,
                                txHash: row.xrpl_tx_hash || undefined,
                                amountUsd: parseFloat(row.amount_usd),
                                status: row.status,
                                date: createdDate,
                            };
                        });
                        return [2 /*return*/, {
                                success: true,
                                message: 'Savings transactions retrieved successfully',
                                data: {
                                    transactions: items,
                                    total: count || 0,
                                },
                            }];
                    case 6:
                        error_5 = _f.sent();
                        console.error('Error getting savings transactions:', error_5);
                        return [2 /*return*/, {
                                success: false,
                                message: error_5 instanceof Error ? error_5.message : 'Failed to get savings transactions',
                                error: error_5 instanceof Error ? error_5.message : 'Failed to get savings transactions',
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    return SavingsService;
}());
exports.SavingsService = SavingsService;
exports.savingsService = new SavingsService();
