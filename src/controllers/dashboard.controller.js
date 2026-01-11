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
exports.dashboardController = exports.DashboardController = void 0;
var wallet_service_1 = require("../services/wallet/wallet.service");
var escrow_service_1 = require("../services/escrow/escrow.service");
var trustiscore_service_1 = require("../services/trustiscore/trustiscore.service");
var DashboardController = /** @class */ (function () {
    function DashboardController() {
    }
    /**
     * Get dashboard summary (aggregates all dashboard data)
     * GET /api/dashboard/summary
     */
    DashboardController.prototype.getDashboardSummary = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, _a, balanceResult, activeEscrowsResult, totalEscrowedResult, trustiscoreResult, error_1, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        userId = req.userId;
                        return [4 /*yield*/, Promise.all([
                                wallet_service_1.walletService.getBalance(userId),
                                escrow_service_1.escrowService.getActiveEscrows(userId),
                                escrow_service_1.escrowService.getTotalEscrowed(userId),
                                trustiscore_service_1.trustiscoreService.getTrustiscore(userId),
                            ])];
                    case 1:
                        _a = _b.sent(), balanceResult = _a[0], activeEscrowsResult = _a[1], totalEscrowedResult = _a[2], trustiscoreResult = _a[3];
                        // Check for errors
                        if (!balanceResult.success || !activeEscrowsResult.success || !totalEscrowedResult.success || !trustiscoreResult.success) {
                            res.status(500).json({
                                success: false,
                                message: 'Failed to fetch dashboard data',
                                error: 'Data fetch error',
                            });
                            return [2 /*return*/];
                        }
                        res.status(200).json({
                            success: true,
                            message: 'Dashboard summary retrieved successfully',
                            data: {
                                balance: balanceResult.data.balance,
                                activeEscrows: {
                                    count: activeEscrowsResult.data.count,
                                    lockedAmount: activeEscrowsResult.data.lockedAmount,
                                },
                                trustiscore: {
                                    score: trustiscoreResult.data.score,
                                    level: trustiscoreResult.data.level,
                                },
                                totalEscrowed: totalEscrowedResult.data.totalEscrowed,
                            },
                        });
                        return [3 /*break*/, 3];
                    case 2:
                        error_1 = _b.sent();
                        console.error('Error in getDashboardSummary:', error_1);
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
    return DashboardController;
}());
exports.DashboardController = DashboardController;
exports.dashboardController = new DashboardController();
