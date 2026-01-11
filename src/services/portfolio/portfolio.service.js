"use strict";
/**
 * Portfolio Service
 * Handles portfolio performance data aggregation
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
exports.portfolioService = exports.PortfolioService = void 0;
var supabase_1 = require("../../config/supabase");
var PortfolioService = /** @class */ (function () {
    function PortfolioService() {
    }
    /**
     * Get portfolio performance data for a specific timeframe
     */
    PortfolioService.prototype.getPortfolioPerformance = function (userId_1) {
        return __awaiter(this, arguments, void 0, function (userId, timeframe) {
            var adminClient, now, startDate, _a, portfolioData, error, generatedData, formattedData, error_1;
            var _this = this;
            if (timeframe === void 0) { timeframe = 'monthly'; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 4, , 5]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        now = new Date();
                        startDate = this.getStartDate(now, timeframe);
                        return [4 /*yield*/, adminClient
                                .from('portfolio_performance')
                                .select('period, value_usd')
                                .eq('user_id', userId)
                                .gte('period', startDate.toISOString().split('T')[0])
                                .order('period', { ascending: true })];
                    case 1:
                        _a = _b.sent(), portfolioData = _a.data, error = _a.error;
                        if (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch portfolio data',
                                    error: 'Failed to fetch portfolio data',
                                }];
                        }
                        if (!(!portfolioData || portfolioData.length === 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.generatePortfolioData(userId, timeframe, startDate)];
                    case 2:
                        generatedData = _b.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: 'Portfolio performance retrieved successfully',
                                data: {
                                    timeframe: timeframe,
                                    data: generatedData,
                                },
                            }];
                    case 3:
                        formattedData = portfolioData.map(function (item) { return ({
                            period: _this.formatPeriod(item.period, timeframe),
                            value: parseFloat(item.value_usd),
                        }); });
                        return [2 /*return*/, {
                                success: true,
                                message: 'Portfolio performance retrieved successfully',
                                data: {
                                    timeframe: timeframe,
                                    data: formattedData,
                                },
                            }];
                    case 4:
                        error_1 = _b.sent();
                        console.error('Error getting portfolio performance:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                message: error_1 instanceof Error ? error_1.message : 'Failed to get portfolio performance',
                                error: error_1 instanceof Error ? error_1.message : 'Failed to get portfolio performance',
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate portfolio data from transactions if no portfolio_performance data exists
     */
    PortfolioService.prototype.generatePortfolioData = function (userId, timeframe, startDate) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, transactions, aggregated, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('created_at, amount_usd, type')
                                .eq('user_id', userId)
                                .gte('created_at', startDate.toISOString())
                                .eq('status', 'completed')
                                .order('created_at', { ascending: true })];
                    case 1:
                        transactions = (_a.sent()).data;
                        if (!transactions || transactions.length === 0) {
                            // Return empty data points for the timeframe
                            return [2 /*return*/, this.generateEmptyDataPoints(startDate, new Date(), timeframe)];
                        }
                        aggregated = this.aggregateByTimeframe(transactions, timeframe);
                        return [2 /*return*/, aggregated];
                    case 2:
                        error_2 = _a.sent();
                        console.error('Error generating portfolio data:', error_2);
                        return [2 /*return*/, []];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get start date based on timeframe
     */
    PortfolioService.prototype.getStartDate = function (now, timeframe) {
        var date = new Date(now);
        switch (timeframe) {
            case 'daily':
                date.setDate(date.getDate() - 30); // Last 30 days
                break;
            case 'weekly':
                date.setDate(date.getDate() - 84); // Last 12 weeks
                break;
            case 'monthly':
                date.setMonth(date.getMonth() - 6); // Last 6 months
                break;
            case 'yearly':
                date.setFullYear(date.getFullYear() - 2); // Last 2 years
                break;
            default:
                date.setMonth(date.getMonth() - 6);
        }
        return date;
    };
    /**
     * Format period string based on timeframe
     */
    PortfolioService.prototype.formatPeriod = function (dateString, timeframe) {
        var date = new Date(dateString);
        switch (timeframe) {
            case 'daily':
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            case 'weekly':
                return "Week ".concat(this.getWeekNumber(date));
            case 'monthly':
                return date.toLocaleDateString('en-US', { month: 'short' });
            case 'yearly':
                return date.getFullYear().toString();
            default:
                return date.toLocaleDateString('en-US', { month: 'short' });
        }
    };
    /**
     * Get week number
     */
    PortfolioService.prototype.getWeekNumber = function (date) {
        var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        var dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    };
    /**
     * Aggregate transactions by timeframe
     */
    PortfolioService.prototype.aggregateByTimeframe = function (transactions, timeframe) {
        var _this = this;
        var aggregated = new Map();
        var runningTotal = 0;
        transactions.forEach(function (tx) {
            var date = new Date(tx.created_at);
            var period = _this.getPeriodKey(date, timeframe);
            // Add to running total (deposits and escrow releases increase, withdrawals decrease)
            if (tx.type === 'deposit' || tx.type === 'escrow_release') {
                runningTotal += parseFloat(tx.amount_usd);
            }
            else if (tx.type === 'withdrawal' || tx.type === 'escrow_create') {
                runningTotal -= parseFloat(tx.amount_usd);
            }
            // Store the running total for this period
            aggregated.set(period, runningTotal);
        });
        // Convert to array and format
        return Array.from(aggregated.entries())
            .map(function (_a) {
            var period = _a[0], value = _a[1];
            return ({
                period: _this.formatPeriodKey(period, timeframe),
                value: parseFloat(value.toFixed(2)),
            });
        })
            .sort(function (a, b) { return a.period.localeCompare(b.period); });
    };
    /**
     * Get period key for aggregation
     */
    PortfolioService.prototype.getPeriodKey = function (date, timeframe) {
        switch (timeframe) {
            case 'daily':
                return date.toISOString().split('T')[0];
            case 'weekly':
                return "".concat(date.getFullYear(), "-W").concat(this.getWeekNumber(date));
            case 'monthly':
                return "".concat(date.getFullYear(), "-").concat(String(date.getMonth() + 1).padStart(2, '0'));
            case 'yearly':
                return date.getFullYear().toString();
            default:
                return date.toISOString().split('T')[0];
        }
    };
    /**
     * Format period key for display
     */
    PortfolioService.prototype.formatPeriodKey = function (key, timeframe) {
        if (timeframe === 'daily') {
            var date = new Date(key);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        else if (timeframe === 'weekly') {
            return key.replace('W', ' Week ');
        }
        else if (timeframe === 'monthly') {
            var _a = key.split('-'), year = _a[0], month = _a[1];
            var date = new Date(parseInt(year), parseInt(month) - 1);
            return date.toLocaleDateString('en-US', { month: 'short' });
        }
        else {
            return key;
        }
    };
    /**
     * Generate empty data points for a date range
     */
    PortfolioService.prototype.generateEmptyDataPoints = function (startDate, endDate, timeframe) {
        var points = [];
        var current = new Date(startDate);
        while (current <= endDate) {
            points.push({
                period: this.formatPeriod(current.toISOString(), timeframe),
                value: 0,
            });
            // Increment based on timeframe
            switch (timeframe) {
                case 'daily':
                    current.setDate(current.getDate() + 1);
                    break;
                case 'weekly':
                    current.setDate(current.getDate() + 7);
                    break;
                case 'monthly':
                    current.setMonth(current.getMonth() + 1);
                    break;
                case 'yearly':
                    current.setFullYear(current.getFullYear() + 1);
                    break;
            }
        }
        return points;
    };
    return PortfolioService;
}());
exports.PortfolioService = PortfolioService;
exports.portfolioService = new PortfolioService();
