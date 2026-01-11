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
exports.disputeController = exports.DisputeController = void 0;
var dispute_service_1 = require("../services/dispute/dispute.service");
var storage_service_1 = require("../services/storage/storage.service");
var DisputeController = /** @class */ (function () {
    function DisputeController() {
    }
    /**
     * Get dispute summary metrics for dashboard
     * GET /api/disputes/summary
     */
    DisputeController.prototype.getSummary = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, month, result, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        month = req.query.month || undefined;
                        return [4 /*yield*/, dispute_service_1.disputeService.getSummary(userId, month)];
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
     * Get list of disputes for table
     * GET /api/disputes
     */
    DisputeController.prototype.getDisputes = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, statusParam, month, page, pageSize, status_1, result, error_2, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        statusParam = req.query.status || 'all';
                        month = req.query.month || undefined;
                        page = req.query.page ? parseInt(req.query.page, 10) : 1;
                        pageSize = req.query.pageSize ? parseInt(req.query.pageSize, 10) : 10;
                        status_1 = statusParam === 'all'
                            ? 'all'
                            : statusParam;
                        return [4 /*yield*/, dispute_service_1.disputeService.getDisputes({
                                userId: userId,
                                status: status_1,
                                month: month,
                                page: page,
                                pageSize: pageSize,
                            })];
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
     * Get dispute detail by ID
     * GET /api/disputes/:id
     */
    DisputeController.prototype.getDisputeById = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, disputeId, result, statusCode, error_3, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        disputeId = req.params.id;
                        return [4 /*yield*/, dispute_service_1.disputeService.getDisputeById(userId, disputeId)];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(200).json(result);
                        }
                        else {
                            statusCode = result.error === 'Dispute not found or access denied' ? 404 : 400;
                            res.status(statusCode).json(result);
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
     * Create a new dispute
     * POST /api/disputes
     */
    DisputeController.prototype.createDispute = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, request, result, error_4, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        request = req.body;
                        return [4 /*yield*/, dispute_service_1.disputeService.createDispute(userId, request)];
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
     * Upload evidence file for dispute
     * POST /api/disputes/evidence/upload
     */
    DisputeController.prototype.uploadEvidence = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, file, result, error_5, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        file = req.file;
                        if (!file) {
                            res.status(400).json({
                                success: false,
                                message: 'No file provided',
                                error: 'No file provided',
                            });
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, storage_service_1.storageService.uploadFile(userId, file)];
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
    return DisputeController;
}());
exports.DisputeController = DisputeController;
exports.disputeController = new DisputeController();
