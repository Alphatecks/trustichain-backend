"use strict";
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
exports.escrowController = exports.EscrowController = void 0;
require("../../types/express");
var escrow_service_1 = require("../services/escrow/escrow.service");
var EscrowController = /** @class */ (function () {
    function EscrowController() {
    }
    /**
     * Get active escrows count and locked amount
     * GET /api/escrow/active
     */
    EscrowController.prototype.getActiveEscrows = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, result, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        return [4 /*yield*/, escrow_service_1.escrowService.getActiveEscrows(userId)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(200).json(result);
                        }
                        else {
                            res.status(400).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _a.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : 'An unexpected error occurred';
                        res.status(500).json({
                            success: false,
                            message: errorMessage,
                            error: 'Internal server error',
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get total escrowed amount
     * GET /api/escrow/total
     */
    EscrowController.prototype.getTotalEscrowed = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, result, error_2, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        return [4 /*yield*/, escrow_service_1.escrowService.getTotalEscrowed(userId)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(200).json(result);
                        }
                        else {
                            res.status(400).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _a.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : 'An unexpected error occurred';
                        res.status(500).json({
                            success: false,
                            message: errorMessage,
                            error: 'Internal server error',
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a new escrow
     * POST /api/escrow/create
     */
    EscrowController.prototype.createEscrow = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, result, error_3, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        return [4 /*yield*/, escrow_service_1.escrowService.createEscrow(userId, req.body)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(201).json(result);
                        }
                        else {
                            res.status(400).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_3 = _a.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : 'An unexpected error occurred';
                        res.status(500).json({
                            success: false,
                            message: errorMessage,
                            error: 'Internal server error',
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get completed escrows count for the current month
     * GET /api/escrow/completed/month
     */
    EscrowController.prototype.getCompletedEscrowsForMonth = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, result, error_4, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        return [4 /*yield*/, escrow_service_1.escrowService.getCompletedEscrowsForMonth(userId)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(200).json(result);
                        }
                        else {
                            res.status(400).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _a.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : 'An unexpected error occurred';
                        res.status(500).json({
                            success: false,
                            message: errorMessage,
                            error: 'Internal server error',
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get escrow list with filters
     * GET /api/escrow/list?transactionType=freelance&industry=Technology&month=11&year=2024&limit=50&offset=0
     */
    EscrowController.prototype.getEscrowList = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, filters, result, error_5, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        filters = {
                            transactionType: req.query.transactionType,
                            industry: req.query.industry,
                            month: req.query.month ? parseInt(req.query.month) : undefined,
                            year: req.query.year ? parseInt(req.query.year) : undefined,
                            limit: req.query.limit ? parseInt(req.query.limit) : 50,
                            offset: req.query.offset ? parseInt(req.query.offset) : 0,
                        };
                        return [4 /*yield*/, escrow_service_1.escrowService.getEscrowListWithFilters(userId, filters)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(200).json(result);
                        }
                        else {
                            res.status(400).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_5 = _a.sent();
                        errorMessage = error_5 instanceof Error ? error_5.message : 'An unexpected error occurred';
                        res.status(500).json({
                            success: false,
                            message: errorMessage,
                            error: 'Internal server error',
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get escrow by ID
     * GET /api/escrow/:id
     */
    EscrowController.prototype.getEscrowById = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, escrowId, result, error_6, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        escrowId = req.params.id;
                        return [4 /*yield*/, escrow_service_1.escrowService.getEscrowById(userId, escrowId)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(200).json(result);
                        }
                        else {
                            res.status(404).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_6 = _a.sent();
                        errorMessage = error_6 instanceof Error ? error_6.message : 'An unexpected error occurred';
                        res.status(500).json({
                            success: false,
                            message: errorMessage,
                            error: 'Internal server error',
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get escrow XRPL status
     * GET /api/escrow/:id/xrpl-status
     */
    EscrowController.prototype.getEscrowXrplStatus = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, escrowId, result, error_7, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        escrowId = req.params.id;
                        return [4 /*yield*/, escrow_service_1.escrowService.getEscrowXrplStatus(userId, escrowId)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(200).json(result);
                        }
                        else {
                            res.status(400).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_7 = _a.sent();
                        errorMessage = error_7 instanceof Error ? error_7.message : 'An unexpected error occurred';
                        res.status(500).json({
                            success: false,
                            message: errorMessage,
                            error: 'Internal server error',
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Release (finish) an escrow
     * POST /api/escrow/:id/release
     */
    EscrowController.prototype.releaseEscrow = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, escrowId, notes, result, error_8, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        escrowId = req.params.id;
                        notes = req.body.notes;
                        return [4 /*yield*/, escrow_service_1.escrowService.releaseEscrow(userId, escrowId, notes)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(200).json(result);
                        }
                        else {
                            res.status(400).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_8 = _a.sent();
                        errorMessage = error_8 instanceof Error ? error_8.message : 'An unexpected error occurred';
                        res.status(500).json({
                            success: false,
                            message: errorMessage,
                            error: 'Internal server error',
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get XUMM payload status for escrow release
     * GET /api/escrow/:id/release/status
     */
    EscrowController.prototype.getEscrowReleaseXUMMStatus = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, escrowId, result, error_9, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        escrowId = req.params.id;
                        return [4 /*yield*/, escrow_service_1.escrowService.getEscrowReleaseXUMMStatus(userId, escrowId)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(200).json(result);
                        }
                        else {
                            res.status(400).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_9 = _a.sent();
                        errorMessage = error_9 instanceof Error ? error_9.message : 'An unexpected error occurred';
                        res.status(500).json({
                            success: false,
                            message: errorMessage,
                            error: 'Internal server error',
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Cancel an escrow
     * POST /api/escrow/:id/cancel
     */
    EscrowController.prototype.cancelEscrow = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, escrowId, reason, result, error_10, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        escrowId = req.params.id;
                        reason = req.body.reason;
                        if (!reason || reason.trim().length === 0) {
                            res.status(400).json({
                                success: false,
                                message: 'Cancel reason is required',
                                error: 'Cancel reason is required',
                            });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, escrow_service_1.escrowService.cancelEscrow(userId, escrowId, reason)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(200).json(result);
                        }
                        else {
                            res.status(400).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_10 = _a.sent();
                        errorMessage = error_10 instanceof Error ? error_10.message : 'An unexpected error occurred';
                        res.status(500).json({
                            success: false,
                            message: errorMessage,
                            error: 'Internal server error',
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get unique industries
     * GET /api/escrow/industries?transactionType=freelance
     */
    EscrowController.prototype.getIndustries = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, transactionType, result, error_11, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        transactionType = req.query.transactionType;
                        return [4 /*yield*/, escrow_service_1.escrowService.getUniqueIndustries(userId, transactionType)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(200).json(result);
                        }
                        else {
                            res.status(400).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_11 = _a.sent();
                        errorMessage = error_11 instanceof Error ? error_11.message : 'An unexpected error occurred';
                        res.status(500).json({
                            success: false,
                            message: errorMessage,
                            error: 'Internal server error',
                        });
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return EscrowController;
}());
exports.EscrowController = EscrowController;
exports.escrowController = new EscrowController();
