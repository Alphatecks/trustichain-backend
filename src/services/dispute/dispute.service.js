"use strict";
/**
 * Dispute Service
 * Handles dispute statistics and listing for the dispute dashboard
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
exports.disputeService = exports.DisputeService = void 0;
var supabase_1 = require("../../config/supabase");
var exchange_service_1 = require("../exchange/exchange.service");
var DisputeService = /** @class */ (function () {
    function DisputeService() {
    }
    /**
     * Format dispute case ID as #DSP-YYYY-XXX
     */
    DisputeService.prototype.formatDisputeId = function (year, sequence) {
        return "#DSP-".concat(year, "-").concat(sequence.toString().padStart(3, '0'));
    };
    /**
     * Get party names (initiator and respondent) for disputes
     */
    DisputeService.prototype.getPartyNames = function (userIds) {
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
     * Compute start and end of a month (UTC) from "YYYY-MM" or current month
     */
    DisputeService.prototype.getMonthRange = function (month) {
        var year;
        var monthIndex; // 0-based
        if (month) {
            var _a = month.split('-').map(Number), y = _a[0], m = _a[1];
            year = y;
            monthIndex = (m || 1) - 1;
        }
        else {
            var now = new Date();
            year = now.getUTCFullYear();
            monthIndex = now.getUTCMonth();
        }
        var start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
        var end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
        return { start: start, end: end };
    };
    /**
     * Get previous month range for a given month
     */
    DisputeService.prototype.getPreviousMonthRange = function (month) {
        var year;
        var monthIndex; // 0-based
        if (month) {
            var _a = month.split('-').map(Number), y = _a[0], m = _a[1];
            year = y;
            monthIndex = (m || 1) - 1;
        }
        else {
            var now = new Date();
            year = now.getUTCFullYear();
            monthIndex = now.getUTCMonth();
        }
        // Move to previous month
        monthIndex -= 1;
        if (monthIndex < 0) {
            monthIndex = 11;
            year -= 1;
        }
        var start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
        var end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
        return { start: start, end: end };
    };
    /**
     * Get dispute summary metrics for the dashboard
     * GET /api/disputes/summary
     */
    DisputeService.prototype.getSummary = function (userId, month) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, start, end, prevRange, _b, currentDisputes, currentError, _c, prevDisputes, prevError, computeMetrics, current, previous, percentChange, error_1;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 3, , 4]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        _a = this.getMonthRange(month), start = _a.start, end = _a.end;
                        prevRange = this.getPreviousMonthRange(month);
                        return [4 /*yield*/, adminClient
                                .from('disputes')
                                .select('status, opened_at, resolved_at')
                                .or("initiator_user_id.eq.".concat(userId, ",respondent_user_id.eq.").concat(userId))
                                .gte('opened_at', start.toISOString())
                                .lte('opened_at', end.toISOString())];
                    case 1:
                        _b = _d.sent(), currentDisputes = _b.data, currentError = _b.error;
                        return [4 /*yield*/, adminClient
                                .from('disputes')
                                .select('status, opened_at, resolved_at')
                                .or("initiator_user_id.eq.".concat(userId, ",respondent_user_id.eq.").concat(userId))
                                .gte('opened_at', prevRange.start.toISOString())
                                .lte('opened_at', prevRange.end.toISOString())];
                    case 2:
                        _c = _d.sent(), prevDisputes = _c.data, prevError = _c.error;
                        if (currentError || prevError) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch dispute summary',
                                    error: 'Failed to fetch dispute summary',
                                }];
                        }
                        computeMetrics = function (rows) {
                            var total = rows.length;
                            var active = rows.filter(function (d) { return d.status === 'pending' || d.status === 'active'; }).length;
                            var resolved = rows.filter(function (d) { return d.status === 'resolved'; }).length;
                            var resolvedRows = rows.filter(function (d) { return d.status === 'resolved' && d.resolved_at; });
                            var avgResolutionTimeSeconds = 0;
                            if (resolvedRows.length > 0) {
                                var totalSeconds = resolvedRows.reduce(function (sum, d) {
                                    var opened = new Date(d.opened_at).getTime();
                                    var resolvedAt = new Date(d.resolved_at).getTime();
                                    return sum + Math.max(0, (resolvedAt - opened) / 1000);
                                }, 0);
                                avgResolutionTimeSeconds = totalSeconds / resolvedRows.length;
                            }
                            return { total: total, active: active, resolved: resolved, avgResolutionTimeSeconds: avgResolutionTimeSeconds };
                        };
                        current = computeMetrics(currentDisputes || []);
                        previous = computeMetrics(prevDisputes || []);
                        percentChange = function (currentValue, previousValue) {
                            if (previousValue === 0)
                                return undefined;
                            return ((currentValue - previousValue) / previousValue) * 100;
                        };
                        return [2 /*return*/, {
                                success: true,
                                message: 'Dispute summary retrieved successfully',
                                data: {
                                    metrics: {
                                        totalDisputes: current.total,
                                        activeDisputes: current.active,
                                        resolvedDisputes: current.resolved,
                                        avgResolutionTimeSeconds: current.avgResolutionTimeSeconds,
                                        totalChangePercent: percentChange(current.total, previous.total),
                                        activeChangePercent: percentChange(current.active, previous.active),
                                        resolvedChangePercent: percentChange(current.resolved, previous.resolved),
                                        avgResolutionTimeChangePercent: percentChange(current.avgResolutionTimeSeconds, previous.avgResolutionTimeSeconds),
                                    },
                                },
                            }];
                    case 3:
                        error_1 = _d.sent();
                        console.error('Error getting dispute summary:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                message: error_1 instanceof Error ? error_1.message : 'Failed to get dispute summary',
                                error: error_1 instanceof Error ? error_1.message : 'Failed to get dispute summary',
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get list of disputes for the table
     * GET /api/disputes
     */
    DisputeService.prototype.getDisputes = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, _a, status, month, _b, page, _c, pageSize, adminClient, _d, start, end, from, to, query, _e, disputes, listError, countQuery, count, rows, userIds, partyNames_1, now_1, formatted, error_2;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        userId = params.userId, _a = params.status, status = _a === void 0 ? 'all' : _a, month = params.month, _b = params.page, page = _b === void 0 ? 1 : _b, _c = params.pageSize, pageSize = _c === void 0 ? 10 : _c;
                        _f.label = 1;
                    case 1:
                        _f.trys.push([1, 5, , 6]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        _d = this.getMonthRange(month), start = _d.start, end = _d.end;
                        from = (page - 1) * pageSize;
                        to = from + pageSize - 1;
                        query = adminClient
                            .from('disputes')
                            .select('*')
                            .or("initiator_user_id.eq.".concat(userId, ",respondent_user_id.eq.").concat(userId))
                            .gte('opened_at', start.toISOString())
                            .lte('opened_at', end.toISOString());
                        if (status !== 'all') {
                            query = query.eq('status', status);
                        }
                        query = query.order('opened_at', { ascending: false }).range(from, to);
                        return [4 /*yield*/, query];
                    case 2:
                        _e = _f.sent(), disputes = _e.data, listError = _e.error;
                        countQuery = adminClient
                            .from('disputes')
                            .select('*', { count: 'exact', head: true })
                            .or("initiator_user_id.eq.".concat(userId, ",respondent_user_id.eq.").concat(userId))
                            .gte('opened_at', start.toISOString())
                            .lte('opened_at', end.toISOString());
                        if (status !== 'all') {
                            countQuery = countQuery.eq('status', status);
                        }
                        return [4 /*yield*/, countQuery];
                    case 3:
                        count = (_f.sent()).count;
                        if (listError) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch disputes',
                                    error: 'Failed to fetch disputes',
                                }];
                        }
                        rows = disputes || [];
                        userIds = Array.from(new Set(rows.flatMap(function (d) { return [d.initiator_user_id, d.respondent_user_id]; }).filter(Boolean)));
                        return [4 /*yield*/, this.getPartyNames(userIds)];
                    case 4:
                        partyNames_1 = _f.sent();
                        now_1 = new Date();
                        formatted = rows.map(function (d) {
                            var openedAt = new Date(d.opened_at);
                            var endTime = d.resolved_at ? new Date(d.resolved_at) : now_1;
                            var durationSeconds = Math.max(0, (endTime.getTime() - openedAt.getTime()) / 1000);
                            return {
                                id: d.id,
                                caseId: d.case_id,
                                initiatorName: partyNames_1[d.initiator_user_id] || 'Unknown',
                                respondentName: partyNames_1[d.respondent_user_id] || 'Unknown',
                                amount: {
                                    xrp: parseFloat(d.amount_xrp),
                                    usd: parseFloat(d.amount_usd),
                                },
                                status: d.status,
                                reason: d.reason,
                                openedAt: d.opened_at,
                                resolvedAt: d.resolved_at || undefined,
                                durationSeconds: durationSeconds,
                            };
                        });
                        return [2 /*return*/, {
                                success: true,
                                message: 'Disputes retrieved successfully',
                                data: {
                                    disputes: formatted,
                                    total: count || 0,
                                },
                            }];
                    case 5:
                        error_2 = _f.sent();
                        console.error('Error getting disputes:', error_2);
                        return [2 /*return*/, {
                                success: false,
                                message: error_2 instanceof Error ? error_2.message : 'Failed to get disputes',
                                error: error_2 instanceof Error ? error_2.message : 'Failed to get disputes',
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get dispute detail by ID
     * GET /api/disputes/:id
     */
    DisputeService.prototype.getDisputeById = function (userId, disputeId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, dispute, error, userIds, partyNames, openedAt, endTime, durationSeconds, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('disputes')
                                .select('*')
                                .eq('id', disputeId)
                                .or("initiator_user_id.eq.".concat(userId, ",respondent_user_id.eq.").concat(userId))
                                .single()];
                    case 1:
                        _a = _b.sent(), dispute = _a.data, error = _a.error;
                        if (error || !dispute) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Dispute not found or access denied',
                                    error: 'Dispute not found or access denied',
                                }];
                        }
                        userIds = [dispute.initiator_user_id, dispute.respondent_user_id].filter(Boolean);
                        return [4 /*yield*/, this.getPartyNames(userIds)];
                    case 2:
                        partyNames = _b.sent();
                        openedAt = new Date(dispute.opened_at);
                        endTime = dispute.resolved_at ? new Date(dispute.resolved_at) : new Date();
                        durationSeconds = Math.max(0, (endTime.getTime() - openedAt.getTime()) / 1000);
                        return [2 /*return*/, {
                                success: true,
                                message: 'Dispute retrieved successfully',
                                data: {
                                    id: dispute.id,
                                    caseId: dispute.case_id,
                                    initiatorName: partyNames[dispute.initiator_user_id] || 'Unknown',
                                    respondentName: partyNames[dispute.respondent_user_id] || 'Unknown',
                                    amount: {
                                        xrp: parseFloat(dispute.amount_xrp),
                                        usd: parseFloat(dispute.amount_usd),
                                    },
                                    status: dispute.status,
                                    reason: dispute.reason,
                                    openedAt: dispute.opened_at,
                                    resolvedAt: dispute.resolved_at || undefined,
                                    durationSeconds: durationSeconds,
                                    description: dispute.description || undefined,
                                    cancelReason: dispute.cancel_reason || undefined,
                                    escrowId: dispute.escrow_id || undefined,
                                },
                            }];
                    case 3:
                        error_3 = _b.sent();
                        console.error('Error getting dispute detail:', error_3);
                        return [2 /*return*/, {
                                success: false,
                                message: error_3 instanceof Error ? error_3.message : 'Failed to get dispute',
                                error: error_3 instanceof Error ? error_3.message : 'Failed to get dispute',
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a new dispute
     * POST /api/disputes
     */
    DisputeService.prototype.createDispute = function (userId, request) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, escrowIdInput, isUUID, isFormattedId, isXrplEscrowId, escrow, escrowError, result, xrplId, result, match, year, sequence, yearStart, yearEnd, result, _a, payerWallet, payerWalletError, _b, respondentWallet, respondentWalletError, respondentUserId, amountXrp, amountUsd, exchangeRates, usdRate, exchangeRates, usdRate, currentYear, lastDispute, maxSequence, _i, lastDispute_1, dispute_1, match, seq, nextSequence, caseId, _c, dispute_2, disputeError, evidenceRecords, evidenceError, error_4;
            var _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _f.trys.push([0, 20, , 21]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        // Validate required fields
                        if (!request.escrowId) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Escrow ID is required',
                                    error: 'Escrow ID is required',
                                }];
                        }
                        if (!request.disputeCategory || !request.disputeReasonType) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Dispute category and reason type are required',
                                    error: 'Missing required fields',
                                }];
                        }
                        if (!request.payerXrpWalletAddress || !request.respondentXrpWalletAddress) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Both payer and respondent XRP wallet addresses are required',
                                    error: 'Wallet addresses required',
                                }];
                        }
                        if (!request.disputeReason || !request.description) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Dispute reason and description are required',
                                    error: 'Missing required fields',
                                }];
                        }
                        if (!request.amount || request.amount <= 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Amount must be greater than 0',
                                    error: 'Invalid amount',
                                }];
                        }
                        escrowIdInput = (request.escrowId || '').trim();
                        console.log('[DEBUG] createDispute: Escrow ID validation', {
                            original: request.escrowId,
                            trimmed: escrowIdInput,
                            length: escrowIdInput.length,
                            firstChar: escrowIdInput[0],
                            lastChar: escrowIdInput[escrowIdInput.length - 1],
                        });
                        isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(escrowIdInput);
                        isFormattedId = /^#?ESC[-_]?\d{4}[-_]?\d{3}$/i.test(escrowIdInput) || /^#ESC-\d{4}-\d{3}$/i.test(escrowIdInput);
                        isXrplEscrowId = /^#[0-9a-f]+$/i.test(escrowIdInput);
                        escrow = void 0;
                        escrowError = void 0;
                        if (!isUUID) return [3 /*break*/, 2];
                        // Query by UUID
                        console.log('[DEBUG] createDispute: Querying by UUID', { escrowId: escrowIdInput });
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('id, user_id, counterparty_id, escrow_sequence, created_at')
                                .eq('id', escrowIdInput)
                                .single()];
                    case 1:
                        result = _f.sent();
                        escrow = result.data;
                        escrowError = result.error;
                        return [3 /*break*/, 9];
                    case 2:
                        if (!isXrplEscrowId) return [3 /*break*/, 4];
                        // Query by XRPL escrow ID (hexadecimal with # prefix, e.g., #60A8AEC3)
                        console.log('[DEBUG] createDispute: Querying by XRPL escrow ID', { escrowId: escrowIdInput });
                        xrplId = escrowIdInput.startsWith('#') ? escrowIdInput.substring(1) : escrowIdInput;
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('id, user_id, counterparty_id, escrow_sequence, created_at')
                                .eq('xrpl_escrow_id', xrplId)
                                .single()];
                    case 3:
                        result = _f.sent();
                        escrow = result.data;
                        escrowError = result.error;
                        console.log('[DEBUG] createDispute: XRPL escrow ID query result', {
                            found: !!escrow,
                            error: escrowError === null || escrowError === void 0 ? void 0 : escrowError.message,
                        });
                        return [3 /*break*/, 9];
                    case 4:
                        if (!isFormattedId) return [3 /*break*/, 8];
                        // Parse formatted ID: #ESC-YYYY-XXX (with various formats)
                        console.log('[DEBUG] createDispute: Querying by formatted ID', { escrowId: escrowIdInput });
                        match = escrowIdInput.match(/^#?ESC[-_]?(\d{4})[-_]?(\d{3})$/i);
                        if (!match) {
                            match = escrowIdInput.match(/^#ESC-(\d{4})-(\d{3})$/i);
                        }
                        if (!match) return [3 /*break*/, 6];
                        year = parseInt(match[1], 10);
                        sequence = parseInt(match[2], 10);
                        console.log('[DEBUG] createDispute: Parsed formatted ID', { year: year, sequence: sequence });
                        yearStart = new Date(year, 0, 1).toISOString();
                        yearEnd = new Date(year, 11, 31, 23, 59, 59, 999).toISOString();
                        return [4 /*yield*/, adminClient
                                .from('escrows')
                                .select('id, user_id, counterparty_id, escrow_sequence, created_at')
                                .eq('escrow_sequence', sequence)
                                .gte('created_at', yearStart)
                                .lte('created_at', yearEnd)
                                .single()];
                    case 5:
                        result = _f.sent();
                        escrow = result.data;
                        escrowError = result.error;
                        console.log('[DEBUG] createDispute: Formatted ID query result', {
                            found: !!escrow,
                            error: escrowError === null || escrowError === void 0 ? void 0 : escrowError.message,
                        });
                        return [3 /*break*/, 7];
                    case 6:
                        console.error('[DEBUG] createDispute: Failed to parse formatted ID', { escrowId: escrowIdInput });
                        return [2 /*return*/, {
                                success: false,
                                message: "Invalid escrow ID format: \"".concat(escrowIdInput, "\". Expected format: #ESC-YYYY-XXX or UUID"),
                                error: 'Invalid escrow ID format',
                            }];
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        console.error('[DEBUG] createDispute: Escrow ID does not match any format', {
                            escrowId: escrowIdInput,
                            isUUID: isUUID,
                            isFormattedId: isFormattedId,
                            isXrplEscrowId: isXrplEscrowId,
                            charCodes: escrowIdInput.split('').map(function (c) { return c.charCodeAt(0); }),
                        });
                        return [2 /*return*/, {
                                success: false,
                                message: "Invalid escrow ID format: \"".concat(escrowIdInput, "\". Expected format: UUID, #ESC-YYYY-XXX, or #hexadecimal (XRPL escrow ID)"),
                                error: 'Invalid escrow ID format',
                            }];
                    case 9:
                        if (escrowError || !escrow) {
                            console.error('Error fetching escrow:', {
                                escrowId: request.escrowId,
                                error: escrowError,
                                isUUID: isUUID,
                                isFormattedId: isFormattedId,
                            });
                            // Provide more helpful error message
                            if ((escrowError === null || escrowError === void 0 ? void 0 : escrowError.code) === 'PGRST116') {
                                return [2 /*return*/, {
                                        success: false,
                                        message: 'Escrow not found. Please verify the escrow ID is correct.',
                                        error: 'Escrow not found',
                                    }];
                            }
                            return [2 /*return*/, {
                                    success: false,
                                    message: (escrowError === null || escrowError === void 0 ? void 0 : escrowError.message) || 'Escrow not found',
                                    error: (escrowError === null || escrowError === void 0 ? void 0 : escrowError.message) || 'Escrow not found',
                                }];
                        }
                        // Verify user is either the initiator or counterparty of the escrow
                        if (escrow.user_id !== userId && escrow.counterparty_id !== userId) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'You do not have access to this escrow',
                                    error: 'Access denied',
                                }];
                        }
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('user_id, xrpl_address')
                                .eq('xrpl_address', request.payerXrpWalletAddress)
                                .maybeSingle()];
                    case 10:
                        _a = _f.sent(), payerWallet = _a.data, payerWalletError = _a.error;
                        if (payerWalletError || !payerWallet) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Payer wallet not found. The payer must have a registered wallet.',
                                    error: 'Payer wallet not found',
                                }];
                        }
                        // Verify the payer wallet belongs to the authenticated user
                        if (payerWallet.user_id !== userId) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Payer wallet address does not match your registered wallet',
                                    error: 'Wallet address mismatch',
                                }];
                        }
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('user_id, xrpl_address')
                                .eq('xrpl_address', request.respondentXrpWalletAddress)
                                .maybeSingle()];
                    case 11:
                        _b = _f.sent(), respondentWallet = _b.data, respondentWalletError = _b.error;
                        if (respondentWalletError || !respondentWallet) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Respondent wallet not found. The respondent must have a registered wallet.',
                                    error: 'Respondent wallet not found',
                                }];
                        }
                        respondentUserId = respondentWallet.user_id;
                        // Prevent creating dispute with yourself
                        if (userId === respondentUserId) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'You cannot create a dispute with yourself',
                                    error: 'Invalid dispute parties',
                                }];
                        }
                        amountXrp = request.amount;
                        amountUsd = request.amount;
                        if (!(request.currency === 'USD')) return [3 /*break*/, 13];
                        return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 12:
                        exchangeRates = _f.sent();
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
                        amountXrp = request.amount / usdRate;
                        return [3 /*break*/, 15];
                    case 13: return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 14:
                        exchangeRates = _f.sent();
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
                        amountUsd = request.amount * usdRate;
                        _f.label = 15;
                    case 15:
                        // Round to appropriate decimal places
                        amountXrp = parseFloat(amountXrp.toFixed(6));
                        amountUsd = parseFloat(amountUsd.toFixed(2));
                        currentYear = new Date().getFullYear();
                        return [4 /*yield*/, adminClient
                                .from('disputes')
                                .select('case_id')
                                .gte('created_at', new Date(currentYear, 0, 1).toISOString())
                                .order('created_at', { ascending: false })
                                .limit(100)];
                    case 16:
                        lastDispute = (_f.sent()).data;
                        maxSequence = 0;
                        if (lastDispute && lastDispute.length > 0) {
                            for (_i = 0, lastDispute_1 = lastDispute; _i < lastDispute_1.length; _i++) {
                                dispute_1 = lastDispute_1[_i];
                                match = dispute_1.case_id.match(/^#DSP-\d{4}-(\d{3})$/);
                                if (match) {
                                    seq = parseInt(match[1], 10);
                                    if (seq > maxSequence) {
                                        maxSequence = seq;
                                    }
                                }
                            }
                        }
                        nextSequence = maxSequence + 1;
                        caseId = this.formatDisputeId(currentYear, nextSequence);
                        return [4 /*yield*/, adminClient
                                .from('disputes')
                                .insert({
                                case_id: caseId,
                                escrow_id: request.escrowId,
                                initiator_user_id: userId,
                                respondent_user_id: respondentUserId,
                                amount_xrp: amountXrp,
                                amount_usd: amountUsd,
                                status: 'pending',
                                reason: request.disputeReason,
                                description: request.description,
                                dispute_category: request.disputeCategory,
                                dispute_reason_type: request.disputeReasonType,
                                payer_name: request.payerName || null,
                                payer_email: request.payerEmail || null,
                                payer_phone: request.payerPhone || null,
                                respondent_name: request.respondentName || null,
                                respondent_email: request.respondentEmail || null,
                                respondent_phone: request.respondentPhone || null,
                                resolution_period: request.resolutionPeriod || null,
                                expected_resolution_date: request.expectedResolutionDate
                                    ? new Date(request.expectedResolutionDate).toISOString()
                                    : null,
                                payer_xrp_wallet_address: request.payerXrpWalletAddress,
                                respondent_xrp_wallet_address: request.respondentXrpWalletAddress,
                            })
                                .select()
                                .single()];
                    case 17:
                        _c = _f.sent(), dispute_2 = _c.data, disputeError = _c.error;
                        if (disputeError || !dispute_2) {
                            console.error('Failed to create dispute:', disputeError);
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to create dispute record',
                                    error: 'Database error',
                                }];
                        }
                        if (!(request.evidence && request.evidence.length > 0)) return [3 /*break*/, 19];
                        evidenceRecords = request.evidence.map(function (item) { return ({
                            dispute_id: dispute_2.id,
                            file_url: item.fileUrl,
                            file_name: item.fileName,
                            file_type: item.fileType || null,
                            file_size: item.fileSize || null,
                            uploaded_by_user_id: userId,
                        }); });
                        return [4 /*yield*/, adminClient
                                .from('dispute_evidence')
                                .insert(evidenceRecords)];
                    case 18:
                        evidenceError = (_f.sent()).error;
                        if (evidenceError) {
                            console.error('Failed to create evidence records:', evidenceError);
                            // Don't fail the dispute creation if evidence fails, just log it
                        }
                        _f.label = 19;
                    case 19: return [2 /*return*/, {
                            success: true,
                            message: 'Dispute created successfully',
                            data: {
                                disputeId: dispute_2.id,
                                caseId: dispute_2.case_id,
                            },
                        }];
                    case 20:
                        error_4 = _f.sent();
                        console.error('Error creating dispute:', error_4);
                        return [2 /*return*/, {
                                success: false,
                                message: error_4 instanceof Error ? error_4.message : 'Failed to create dispute',
                                error: error_4 instanceof Error ? error_4.message : 'Failed to create dispute',
                            }];
                    case 21: return [2 /*return*/];
                }
            });
        });
    };
    return DisputeService;
}());
exports.DisputeService = DisputeService;
exports.disputeService = new DisputeService();
