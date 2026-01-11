"use strict";
/**
 * Trustiscore Service
 * Calculates and manages user trust scores
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
exports.trustiscoreService = exports.TrustiscoreService = void 0;
var supabase_1 = require("../../config/supabase");
var TrustiscoreService = /** @class */ (function () {
    function TrustiscoreService() {
    }
    /**
     * Get trustiscore for a user
     */
    TrustiscoreService.prototype.getTrustiscore = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, trustiscore, error, calculated, _b, newTrustiscore, createError, error_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 5, , 6]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('trustiscore')
                                .select('*')
                                .eq('user_id', userId)
                                .single()];
                    case 1:
                        _a = _c.sent(), trustiscore = _a.data, error = _a.error;
                        if (!(error || !trustiscore)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.calculateTrustiscore(userId)];
                    case 2:
                        calculated = _c.sent();
                        if (!calculated.success || !calculated.data) {
                            return [2 /*return*/, calculated];
                        }
                        return [4 /*yield*/, adminClient
                                .from('trustiscore')
                                .insert({
                                user_id: userId,
                                score: calculated.data.score,
                                level: calculated.data.level,
                                factors: calculated.data.factors || {},
                            })
                                .select()
                                .single()];
                    case 3:
                        _b = _c.sent(), newTrustiscore = _b.data, createError = _b.error;
                        if (createError || !newTrustiscore) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to create trustiscore',
                                    error: 'Failed to create trustiscore',
                                }];
                        }
                        trustiscore = newTrustiscore;
                        _c.label = 4;
                    case 4: return [2 /*return*/, {
                            success: true,
                            message: 'Trustiscore retrieved successfully',
                            data: {
                                score: trustiscore.score,
                                level: trustiscore.level,
                                factors: trustiscore.factors,
                            },
                        }];
                    case 5:
                        error_1 = _c.sent();
                        console.error('Error getting trustiscore:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                message: error_1 instanceof Error ? error_1.message : 'Failed to get trustiscore',
                                error: error_1 instanceof Error ? error_1.message : 'Failed to get trustiscore',
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Calculate trustiscore based on various factors
     */
    TrustiscoreService.prototype.calculateTrustiscore = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, user, accountAgeDays, completedEscrows, totalEscrows, onTimeCompletionRate, disputedEscrows, disputeResolutionRate, transactions, transactionVolume, escrowScore, ageScore, disputeScore, volumeScore, completionScore, totalScore, finalScore, level, factors, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('users')
                                .select('created_at')
                                .eq('id', userId)
                                .single()];
                    case 1:
                        user = (_a.sent()).data;
                        accountAgeDays = user
                            ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
                            : 0;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('*', { count: 'exact', head: true })
                                .eq('user_id', userId)
                                .eq('status', 'completed')];
                    case 2:
                        completedEscrows = (_a.sent()).count;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('*', { count: 'exact', head: true })
                                .eq('user_id', userId)
                                .in('status', ['completed', 'cancelled'])];
                    case 3:
                        totalEscrows = (_a.sent()).count;
                        onTimeCompletionRate = totalEscrows && totalEscrows > 0
                            ? (completedEscrows || 0) / totalEscrows
                            : 0;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('*', { count: 'exact', head: true })
                                .eq('user_id', userId)
                                .eq('status', 'disputed')];
                    case 4:
                        disputedEscrows = (_a.sent()).count;
                        disputeResolutionRate = totalEscrows && totalEscrows > 0
                            ? 1 - ((disputedEscrows || 0) / totalEscrows)
                            : 1;
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('amount_usd')
                                .eq('user_id', userId)
                                .eq('status', 'completed')];
                    case 5:
                        transactions = (_a.sent()).data;
                        transactionVolume = (transactions === null || transactions === void 0 ? void 0 : transactions.reduce(function (sum, tx) { return sum + parseFloat(tx.amount_usd); }, 0)) || 0;
                        escrowScore = Math.min((completedEscrows || 0) * 1, 30);
                        ageScore = Math.min(Math.floor(accountAgeDays / 30) * 1, 20);
                        disputeScore = disputeResolutionRate * 25;
                        volumeScore = Math.min(Math.floor(transactionVolume / 1000) * 1, 15);
                        completionScore = onTimeCompletionRate * 10;
                        totalScore = Math.round(escrowScore + ageScore + disputeScore + volumeScore + completionScore);
                        finalScore = Math.min(Math.max(totalScore, 0), 100);
                        level = 'Bronze';
                        if (finalScore >= 71)
                            level = 'Platinum';
                        else if (finalScore >= 51)
                            level = 'Gold';
                        else if (finalScore >= 31)
                            level = 'Silver';
                        factors = {
                            completedEscrows: completedEscrows || 0,
                            accountAge: accountAgeDays,
                            disputeResolutionRate: disputeResolutionRate,
                            transactionVolume: transactionVolume,
                            onTimeCompletionRate: onTimeCompletionRate,
                        };
                        return [2 /*return*/, {
                                success: true,
                                message: 'Trustiscore calculated successfully',
                                data: {
                                    score: finalScore,
                                    level: level,
                                    factors: factors,
                                },
                            }];
                    case 6:
                        error_2 = _a.sent();
                        console.error('Error calculating trustiscore:', error_2);
                        return [2 /*return*/, {
                                success: false,
                                message: error_2 instanceof Error ? error_2.message : 'Failed to calculate trustiscore',
                                error: error_2 instanceof Error ? error_2.message : 'Failed to calculate trustiscore',
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Update trustiscore (recalculate and update)
     */
    TrustiscoreService.prototype.updateTrustiscore = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var calculated, adminClient, error, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, this.calculateTrustiscore(userId)];
                    case 1:
                        calculated = _a.sent();
                        if (!calculated.success || !calculated.data) {
                            return [2 /*return*/, calculated];
                        }
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('trustiscore')
                                .upsert({
                                user_id: userId,
                                score: calculated.data.score,
                                level: calculated.data.level,
                                factors: calculated.data.factors || {},
                            }, {
                                onConflict: 'user_id',
                            })];
                    case 2:
                        error = (_a.sent()).error;
                        if (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to update trustiscore',
                                    error: 'Failed to update trustiscore',
                                }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                message: 'Trustiscore updated successfully',
                                data: {
                                    score: calculated.data.score,
                                    level: calculated.data.level,
                                },
                            }];
                    case 3:
                        error_3 = _a.sent();
                        console.error('Error updating trustiscore:', error_3);
                        return [2 /*return*/, {
                                success: false,
                                message: error_3 instanceof Error ? error_3.message : 'Failed to update trustiscore',
                                error: error_3 instanceof Error ? error_3.message : 'Failed to update trustiscore',
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return TrustiscoreService;
}());
exports.TrustiscoreService = TrustiscoreService;
exports.trustiscoreService = new TrustiscoreService();
