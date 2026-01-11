"use strict";
/**
 * Wallet Service
 * Handles wallet operations including balance, funding, and withdrawals
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.walletService = exports.WalletService = void 0;
var supabase_1 = require("../../config/supabase");
// import type { TransactionType } from '../../types/api/transaction.types';
var xrpl_wallet_service_1 = require("../../xrpl/wallet/xrpl-wallet.service");
var xrpl_dex_service_1 = require("../../xrpl/dex/xrpl-dex.service");
var exchange_service_1 = require("../exchange/exchange.service");
var encryption_service_1 = require("../encryption/encryption.service");
var xumm_service_1 = require("../xumm/xumm.service");
var notification_service_1 = require("../notification/notification.service");
var WalletService = /** @class */ (function () {
    function WalletService() {
    }
    /**
     * Get wallet balance for a user
     */
    WalletService.prototype.getBalance = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // TODO: Implement actual logic to fetch balances from DB or XRPL
                // Placeholder implementation to allow compilation
                return [2 /*return*/, {
                        balance_xrp: 0,
                        balance_usdt: 0,
                        balance_usdc: 0
                    }];
            });
        });
    };
    /**
     * Connect a wallet to a user
     */
    WalletService.prototype.connectWallet = function (userId, request) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, walletAddress, _a, existingWallet, checkError, _b, currentWallet, walletError, createError, previousAddress, updateError, error_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 6, , 7]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        walletAddress = request.walletAddress;
                        walletAddress = String(walletAddress || '').trim();
                        if (!walletAddress) {
                            return [2 /*return*/, { success: false, message: 'Wallet address is required', error: 'Missing wallet address' }];
                        }
                        if (walletAddress.startsWith('0x')) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Invalid address format: This appears to be an Ethereum address (starts with 0x).',
                                    error: 'Ethereum address detected',
                                    help: { detectedType: 'ethereum', correctFormat: 'XRPL addresses start with "r" and are 25-35 characters long.' },
                                }];
                        }
                        if (!walletAddress.startsWith('r')) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Invalid XRPL wallet address format. XRPL addresses must start with "r".',
                                    error: 'Invalid wallet address format',
                                    help: { detectedType: 'invalid', correctFormat: 'XRPL addresses start with "r" and are 25-35 characters long.' },
                                }];
                        }
                        if (walletAddress.length < 25 || walletAddress.length > 35) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Invalid XRPL wallet address length.',
                                    error: 'Invalid wallet address format',
                                    help: { detectedType: 'wrong_length', correctFormat: 'XRPL addresses are 25-35 characters long.' },
                                }];
                        }
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('user_id, xrpl_address')
                                .eq('xrpl_address', walletAddress)
                                .maybeSingle()];
                    case 1:
                        _a = _c.sent(), existingWallet = _a.data, checkError = _a.error;
                        if (checkError) {
                            return [2 /*return*/, { success: false, message: 'Failed to verify wallet address', error: 'Database error' }];
                        }
                        if (existingWallet && existingWallet.user_id !== userId) {
                            return [2 /*return*/, { success: false, message: 'This wallet address is already connected to another account', error: 'Wallet address already in use' }];
                        }
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', userId)
                                .single()];
                    case 2:
                        _b = _c.sent(), currentWallet = _b.data, walletError = _b.error;
                        if (!(walletError || !currentWallet)) return [3 /*break*/, 4];
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .insert({ user_id: userId, xrpl_address: walletAddress, balance_xrp: 0, balance_usdt: 0, balance_usdc: 0 })];
                    case 3:
                        createError = (_c.sent()).error;
                        if (createError) {
                            return [2 /*return*/, { success: false, message: 'Failed to connect wallet', error: 'Failed to create wallet record' }];
                        }
                        return [2 /*return*/, { success: true, message: 'MetaMask wallet connected successfully. You can now fund your wallet from this connected wallet.', data: { walletAddress: walletAddress } }];
                    case 4:
                        previousAddress = currentWallet.xrpl_address;
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({ xrpl_address: walletAddress, updated_at: new Date().toISOString() })
                                .eq('user_id', userId)];
                    case 5:
                        updateError = (_c.sent()).error;
                        if (updateError) {
                            return [2 /*return*/, { success: false, message: 'Failed to update wallet address', error: 'Database update failed' }];
                        }
                        return [2 /*return*/, { success: true, message: 'MetaMask wallet connected successfully. Your wallet address has been updated.', data: { walletAddress: walletAddress, previousAddress: previousAddress !== walletAddress ? previousAddress : undefined } }];
                    case 6:
                        error_1 = _c.sent();
                        return [2 /*return*/, { success: false, message: error_1 instanceof Error ? error_1.message : 'Failed to connect wallet', error: error_1 instanceof Error ? error_1.message : 'Unknown error' }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Disconnect user's connected XRPL wallet (e.g., Xaman/XUMM)
     */
    WalletService.prototype.disconnectWallet = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, currentWallet, walletError, previousAddress, updateError, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', userId)
                                .single()];
                    case 1:
                        _a = _b.sent(), currentWallet = _a.data, walletError = _a.error;
                        if (walletError || !currentWallet) {
                            return [2 /*return*/, { success: false, message: 'No wallet found to disconnect', error: 'Wallet not found' }];
                        }
                        previousAddress = currentWallet.xrpl_address;
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({ xrpl_address: null, updated_at: new Date().toISOString() })
                                .eq('user_id', userId)];
                    case 2:
                        updateError = (_b.sent()).error;
                        if (updateError) {
                            return [2 /*return*/, { success: false, message: 'Failed to disconnect wallet', error: 'Database update failed' }];
                        }
                        return [2 /*return*/, { success: true, message: 'Wallet disconnected successfully.', data: { previousAddress: previousAddress } }];
                    case 3:
                        error_2 = _b.sent();
                        return [2 /*return*/, { success: false, message: error_2 instanceof Error ? error_2.message : 'Failed to disconnect wallet', error: error_2 instanceof Error ? error_2.message : 'Unknown error' }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // ...existing code...
    /**
     * Connect wallet via XUMM
     * Creates a XUMM payload that requests the user's XRPL address
     */
    WalletService.prototype.connectWalletViaXUMM = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var signInTransaction, xummPayload, adminClient, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        signInTransaction = {
                            TransactionType: 'SignIn',
                        };
                        return [4 /*yield*/, xumm_service_1.xummService.createPayload(signInTransaction)];
                    case 1:
                        xummPayload = _a.sent();
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .insert({
                                user_id: userId,
                                type: 'wallet_connect',
                                status: 'pending',
                                description: "XUMM wallet connection | XUMM_UUID:".concat(xummPayload.uuid),
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: 'XUMM connection request created. Please scan the QR code with Xaman app to connect your wallet.',
                                data: {
                                    xummUrl: xummPayload.next.always,
                                    xummUuid: xummPayload.uuid,
                                    qrCode: xummPayload.refs.qr_png,
                                    qrUri: xummPayload.refs.qr_uri,
                                    instructions: 'Open Xaman app and scan the QR code to connect your XRPL wallet',
                                },
                            }];
                    case 3:
                        error_3 = _a.sent();
                        console.error('Error creating XUMM connection payload:', error_3);
                        return [2 /*return*/, {
                                success: false,
                                message: error_3 instanceof Error ? error_3.message : 'Failed to create XUMM connection request',
                                error: error_3 instanceof Error ? error_3.message : 'Unknown error',
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fund wallet via XUMM (Xaman app)
     * Creates a XUMM payload for the user to sign a payment transaction
     * This will debit XRP from the user's Xaman wallet to their connected wallet address
     */
    WalletService.prototype.fundWalletViaXUMM = function (userId, request) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, wallet, preparedTx, xummPayload, _a, transaction, txError, error_4;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 5, , 6]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('*')
                                .eq('user_id', userId)
                                .single()];
                    case 1:
                        wallet = (_b.sent()).data;
                        if (!wallet) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Wallet not found. Please connect your Xaman wallet first.',
                                    error: 'Wallet not found',
                                }];
                        }
                        // Validate amount
                        if (!request.amount || request.amount <= 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Amount must be greater than 0',
                                    error: 'Invalid amount',
                                }];
                        }
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.preparePaymentTransaction(wallet.xrpl_address, // Destination: user's connected wallet address
                            request.amount, 'XRP')];
                    case 2:
                        preparedTx = _b.sent();
                        return [4 /*yield*/, xumm_service_1.xummService.createPayload(preparedTx.transaction)];
                    case 3:
                        xummPayload = _b.sent();
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .insert({
                                user_id: userId,
                                type: 'deposit',
                                amount_xrp: request.amount,
                                amount_usd: 0, // Will be calculated later if needed
                                status: 'pending',
                                description: "XUMM deposit ".concat(request.amount, " XRP | XUMM_UUID:").concat(xummPayload.uuid),
                            })
                                .select()
                                .single()];
                    case 4:
                        _a = _b.sent(), transaction = _a.data, txError = _a.error;
                        if (txError || !transaction) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to create transaction record',
                                    error: 'Database error',
                                }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                message: 'XUMM payment request created. Please scan the QR code with Xaman app to approve the payment.',
                                data: {
                                    transactionId: transaction.id,
                                    xummUrl: xummPayload.next.always,
                                    xummUuid: xummPayload.uuid,
                                    qrCode: xummPayload.refs.qr_png,
                                    qrUri: xummPayload.refs.qr_uri,
                                    amount: request.amount,
                                    destinationAddress: wallet.xrpl_address,
                                    instructions: "Sign this transaction in Xaman app to deposit ".concat(request.amount, " XRP to your wallet"),
                                },
                            }];
                    case 5:
                        error_4 = _b.sent();
                        console.error('Error creating XUMM fund request:', error_4);
                        return [2 /*return*/, {
                                success: false,
                                message: error_4 instanceof Error ? error_4.message : 'Failed to create XUMM fund request',
                                error: error_4 instanceof Error ? error_4.message : 'Unknown error',
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check XUMM fund status and submit transaction when signed
     */
    WalletService.prototype.checkXUMMFundStatus = function (userId, transactionId, xummUuid) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, transaction, payloadStatus, submitResult, status_1, wallet, balances, wallet, balances, error_5;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 21, , 22]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('*')
                                .eq('id', transactionId)
                                .eq('user_id', userId)
                                .single()];
                    case 1:
                        transaction = (_c.sent()).data;
                        if (!transaction) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Transaction not found',
                                    error: 'Transaction not found',
                                }];
                        }
                        return [4 /*yield*/, xumm_service_1.xummService.getPayloadStatus(xummUuid)];
                    case 2:
                        payloadStatus = _c.sent();
                        if (!payloadStatus.meta.cancelled) return [3 /*break*/, 4];
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                status: 'cancelled',
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transactionId)];
                    case 3:
                        _c.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: 'XUMM payment request was cancelled',
                                data: {
                                    signed: false,
                                    xummUuid: xummUuid,
                                    transactionId: transactionId,
                                    status: 'cancelled',
                                },
                            }];
                    case 4:
                        if (!payloadStatus.meta.expired) return [3 /*break*/, 6];
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                status: 'cancelled',
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transactionId)];
                    case 5:
                        _c.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: 'XUMM payment request has expired',
                                data: {
                                    signed: false,
                                    xummUuid: xummUuid,
                                    transactionId: transactionId,
                                    status: 'expired',
                                },
                            }];
                    case 6:
                        // Check if signed
                        if (!payloadStatus.meta.signed) {
                            return [2 /*return*/, {
                                    success: true,
                                    message: 'Waiting for user to sign payment in Xaman app',
                                    data: {
                                        signed: false,
                                        xummUuid: xummUuid,
                                        transactionId: transactionId,
                                        status: 'pending',
                                    },
                                }];
                        }
                        if (!((_a = payloadStatus.response) === null || _a === void 0 ? void 0 : _a.hex)) return [3 /*break*/, 13];
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.submitSignedTransaction(payloadStatus.response.hex)];
                    case 7:
                        submitResult = _c.sent();
                        status_1 = submitResult.status === 'tesSUCCESS' ? 'completed' : 'failed';
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                xrpl_tx_hash: submitResult.hash,
                                status: status_1,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transactionId)];
                    case 8:
                        _c.sent();
                        if (!(status_1 === 'completed')) return [3 /*break*/, 12];
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', userId)
                                .single()];
                    case 9:
                        wallet = (_c.sent()).data;
                        if (!wallet) return [3 /*break*/, 12];
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(wallet.xrpl_address)];
                    case 10:
                        balances = _c.sent();
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: balances.xrp,
                                balance_usdt: balances.usdt,
                                balance_usdc: balances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('user_id', userId)];
                    case 11:
                        _c.sent();
                        _c.label = 12;
                    case 12: return [2 /*return*/, {
                            success: true,
                            message: status_1 === 'completed'
                                ? 'Payment completed successfully. XRP has been debited from your Xaman wallet.'
                                : 'Payment transaction failed',
                            data: {
                                signed: true,
                                xummUuid: xummUuid,
                                transactionId: transactionId,
                                status: status_1 === 'completed' ? 'completed' : 'failed',
                                xrplTxHash: submitResult.hash,
                                amount: transaction.amount_xrp,
                            },
                        }];
                    case 13:
                        if (!((_b = payloadStatus.response) === null || _b === void 0 ? void 0 : _b.txid)) return [3 /*break*/, 19];
                        // XUMM auto-submitted the transaction
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                xrpl_tx_hash: payloadStatus.response.txid,
                                status: 'completed',
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transactionId)];
                    case 14:
                        // XUMM auto-submitted the transaction
                        _c.sent();
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', userId)
                                .single()];
                    case 15:
                        wallet = (_c.sent()).data;
                        if (!wallet) return [3 /*break*/, 18];
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(wallet.xrpl_address)];
                    case 16:
                        balances = _c.sent();
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: balances.xrp,
                                balance_usdt: balances.usdt,
                                balance_usdc: balances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('user_id', userId)];
                    case 17:
                        _c.sent();
                        _c.label = 18;
                    case 18: return [2 /*return*/, {
                            success: true,
                            message: 'Payment completed successfully. XRP has been debited from your Xaman wallet.',
                            data: {
                                signed: true,
                                xummUuid: xummUuid,
                                transactionId: transactionId,
                                status: 'completed',
                                xrplTxHash: payloadStatus.response.txid,
                                amount: transaction.amount_xrp,
                            },
                        }];
                    case 19: return [2 /*return*/, {
                            success: false,
                            message: 'Transaction signed but no transaction data available',
                            error: 'Missing transaction data',
                        }];
                    case 20: return [3 /*break*/, 22];
                    case 21:
                        error_5 = _c.sent();
                        console.error('Error checking XUMM fund status:', error_5);
                        return [2 /*return*/, {
                                success: false,
                                message: error_5 instanceof Error ? error_5.message : 'Failed to check XUMM fund status',
                                error: error_5 instanceof Error ? error_5.message : 'Unknown error',
                            }];
                    case 22: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Check XUMM connection status and connect wallet when signed
     */
    WalletService.prototype.checkXUMMConnectionStatus = function (userId, xummUuid) {
        return __awaiter(this, void 0, void 0, function () {
            var payloadStatus, walletAddress, connectResult, adminClient, error_6;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 6, , 7]);
                        return [4 /*yield*/, xumm_service_1.xummService.getPayloadStatus(xummUuid)];
                    case 1:
                        payloadStatus = _b.sent();
                        // Check if cancelled or expired
                        if (payloadStatus.meta.cancelled) {
                            return [2 /*return*/, {
                                    success: true,
                                    message: 'XUMM connection request was cancelled',
                                    data: {
                                        signed: false,
                                        xummUuid: xummUuid,
                                        status: 'cancelled',
                                    },
                                }];
                        }
                        if (payloadStatus.meta.expired) {
                            return [2 /*return*/, {
                                    success: true,
                                    message: 'XUMM connection request has expired',
                                    data: {
                                        signed: false,
                                        xummUuid: xummUuid,
                                        status: 'expired',
                                    },
                                }];
                        }
                        // Check if signed
                        if (!payloadStatus.meta.signed) {
                            return [2 /*return*/, {
                                    success: true,
                                    message: 'Waiting for user to sign in Xaman app',
                                    data: {
                                        signed: false,
                                        xummUuid: xummUuid,
                                        status: 'pending',
                                    },
                                }];
                        }
                        walletAddress = (_a = payloadStatus.response) === null || _a === void 0 ? void 0 : _a.account;
                        if (!walletAddress) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'XUMM response does not contain account address',
                                    error: 'Missing account address in XUMM response',
                                }];
                        }
                        // Validate address format
                        if (!walletAddress.startsWith('r') || walletAddress.length < 25 || walletAddress.length > 35) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Invalid XRPL address received from XUMM: ".concat(walletAddress),
                                    error: 'Invalid address format',
                                }];
                        }
                        return [4 /*yield*/, this.connectWallet(userId, { walletAddress: walletAddress })];
                    case 2:
                        connectResult = _b.sent();
                        if (!connectResult.success) return [3 /*break*/, 4];
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                status: 'completed',
                                description: "XUMM wallet connected | Address: ".concat(walletAddress, " | XUMM_UUID:").concat(xummUuid),
                                updated_at: new Date().toISOString(),
                            })
                                .eq('user_id', userId)
                                .like('description', "%XUMM_UUID:".concat(xummUuid, "%"))
                                .eq('status', 'pending')];
                    case 3:
                        _b.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: 'Wallet connected successfully via XUMM',
                                data: {
                                    signed: true,
                                    walletAddress: walletAddress,
                                    xummUuid: xummUuid,
                                    status: 'connected',
                                },
                            }];
                    case 4: return [2 /*return*/, {
                            success: false,
                            message: connectResult.message || 'Failed to connect wallet',
                            error: connectResult.error || 'Connection failed',
                        }];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_6 = _b.sent();
                        console.error('Error checking XUMM connection status:', error_6);
                        return [2 /*return*/, {
                                success: false,
                                message: error_6 instanceof Error ? error_6.message : 'Failed to check XUMM connection status',
                                error: error_6 instanceof Error ? error_6.message : 'Unknown error',
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate wallet address format (helper endpoint)
     * Allows frontend to check address format before attempting to connect
     */
    WalletService.prototype.validateAddress = function (address) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedAddress;
            return __generator(this, function (_a) {
                try {
                    normalizedAddress = String(address || '').trim();
                    if (!normalizedAddress) {
                        return [2 /*return*/, {
                                success: true,
                                message: 'Address is empty',
                                data: {
                                    isValid: false,
                                    addressType: 'invalid',
                                    suggestions: ['Please provide a wallet address'],
                                },
                            }];
                    }
                    // Check if Ethereum address
                    if (normalizedAddress.startsWith('0x')) {
                        return [2 /*return*/, {
                                success: true,
                                message: 'This is an Ethereum address. XRPL addresses start with "r".',
                                data: {
                                    isValid: false,
                                    addressType: 'ethereum',
                                    formattedAddress: normalizedAddress,
                                    suggestions: [
                                        'Use MetaMask XRPL Snap to get XRPL address',
                                        'Call wallet_invokeSnap with method: "getAddress"',
                                        'XRPL addresses start with "r" and are 25-35 characters',
                                    ],
                                },
                            }];
                    }
                    // Check if XRPL address
                    if (normalizedAddress.startsWith('r')) {
                        if (normalizedAddress.length >= 25 && normalizedAddress.length <= 35) {
                            return [2 /*return*/, {
                                    success: true,
                                    message: 'Valid XRPL address format',
                                    data: {
                                        isValid: true,
                                        addressType: 'xrpl',
                                        formattedAddress: normalizedAddress,
                                    },
                                }];
                        }
                        else {
                            return [2 /*return*/, {
                                    success: true,
                                    message: 'XRPL address has invalid length',
                                    data: {
                                        isValid: false,
                                        addressType: 'xrpl',
                                        formattedAddress: normalizedAddress,
                                        suggestions: [
                                            "Expected length: 25-35 characters, got: ".concat(normalizedAddress.length),
                                            'Please verify the address is complete',
                                        ],
                                    },
                                }];
                        }
                    }
                    // Unknown format
                    return [2 /*return*/, {
                            success: true,
                            message: 'Unknown address format',
                            data: {
                                isValid: false,
                                addressType: 'invalid',
                                formattedAddress: normalizedAddress,
                                suggestions: [
                                    'XRPL addresses start with "r" and are 25-35 characters',
                                    'Ethereum addresses start with "0x" and are 42 characters',
                                    'Make sure you are getting the XRPL address from MetaMask XRPL Snap',
                                ],
                            },
                        }];
                }
                catch (error) {
                    return [2 /*return*/, {
                            success: false,
                            message: error instanceof Error ? error.message : 'Failed to validate address',
                            error: error instanceof Error ? error.message : 'Unknown error',
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get swap quote between XRP, USDT, and USDC for the user's wallet.
     * This powers the "Preview Swap" UI and does not execute any on-chain swap.
     */
    WalletService.prototype.getSwapQuote = function (userId, request) {
        return __awaiter(this, void 0, void 0, function () {
            var amount, fromCurrency, toCurrency, balance, availableFromBalance, BASE_RESERVE, ESTIMATED_FEE, minimumRequired, availableXrp, dexQuote, _a, dexToAmount, dexRate, estimatedFee, ratesResult_1, xrpUsdRate_1, usdValue_1, feeUsd_1, ratesResult, xrpUsdRate, usdValue, SWAP_FEE_PERCENT, feeUsd, netUsd, toAmount, rate, error_7;
            var _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _f.trys.push([0, 6, , 7]);
                        amount = request.amount, fromCurrency = request.fromCurrency, toCurrency = request.toCurrency;
                        if (!amount || amount <= 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Amount must be greater than 0',
                                    error: 'Invalid amount',
                                }];
                        }
                        if (fromCurrency === toCurrency) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'From and to currencies must be different',
                                    error: 'Invalid currency pair',
                                }];
                        }
                        return [4 /*yield*/, this.getBalance(userId)];
                    case 1:
                        balance = _f.sent();
                        availableFromBalance = void 0;
                        if (fromCurrency === 'XRP') {
                            BASE_RESERVE = 1.0;
                            ESTIMATED_FEE = 0.000015;
                            minimumRequired = BASE_RESERVE + ESTIMATED_FEE;
                            availableXrp = Math.max(0, balance.balance_xrp - minimumRequired);
                            availableFromBalance = availableXrp;
                        }
                        else if (fromCurrency === 'USDT') {
                            availableFromBalance = balance.balance_usdt;
                        }
                        else {
                            availableFromBalance = balance.balance_usdc;
                        }
                        if (amount > availableFromBalance) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Insufficient ".concat(fromCurrency, " balance for swap"),
                                    error: 'Insufficient balance',
                                }];
                        }
                        if (!request.useDEX) return [3 /*break*/, 4];
                        return [4 /*yield*/, xrpl_dex_service_1.xrplDexService.getDEXPrice(fromCurrency, toCurrency, amount)];
                    case 2:
                        dexQuote = _f.sent();
                        if (!dexQuote.success || !dexQuote.data) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: dexQuote.error || 'Failed to get DEX quote',
                                    error: dexQuote.error || 'DEX quote failed',
                                }];
                        }
                        _a = dexQuote.data, dexToAmount = _a.toAmount, dexRate = _a.rate, estimatedFee = _a.estimatedFee;
                        return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 3:
                        ratesResult_1 = _f.sent();
                        xrpUsdRate_1 = ((_c = (_b = ratesResult_1.data) === null || _b === void 0 ? void 0 : _b.rates.find(function (r) { return r.currency === 'USD'; })) === null || _c === void 0 ? void 0 : _c.rate) || 0.5;
                        usdValue_1 = 0;
                        if (fromCurrency === 'XRP') {
                            usdValue_1 = amount * xrpUsdRate_1;
                        }
                        else {
                            usdValue_1 = amount; // USDT/USDC 1:1 with USD
                        }
                        feeUsd_1 = estimatedFee * xrpUsdRate_1;
                        return [2 /*return*/, {
                                success: true,
                                message: 'DEX swap quote calculated successfully',
                                data: {
                                    fromCurrency: fromCurrency,
                                    toCurrency: toCurrency,
                                    fromAmount: amount,
                                    toAmount: parseFloat(dexToAmount.toFixed(6)),
                                    rate: parseFloat(dexRate.toFixed(8)),
                                    usdValue: parseFloat(usdValue_1.toFixed(2)),
                                    feeUsd: parseFloat(feeUsd_1.toFixed(6)),
                                },
                            }];
                    case 4: return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 5:
                        ratesResult = _f.sent();
                        xrpUsdRate = (_e = (_d = ratesResult.data) === null || _d === void 0 ? void 0 : _d.rates.find(function (r) { return r.currency === 'USD'; })) === null || _e === void 0 ? void 0 : _e.rate;
                        if (!ratesResult.success || !ratesResult.data || !xrpUsdRate || xrpUsdRate <= 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'XRP/USD exchange rate not available',
                                    error: 'Exchange rate not available',
                                }];
                        }
                        usdValue = 0;
                        if (fromCurrency === 'XRP') {
                            usdValue = amount * xrpUsdRate;
                        }
                        else {
                            // USDT and USDC are treated as USD-pegged
                            usdValue = amount;
                        }
                        SWAP_FEE_PERCENT = 0.0;
                        feeUsd = usdValue * SWAP_FEE_PERCENT;
                        netUsd = usdValue - feeUsd;
                        toAmount = 0;
                        if (toCurrency === 'XRP') {
                            toAmount = netUsd / xrpUsdRate;
                        }
                        else {
                            toAmount = netUsd; // USDT/USDC 1:1 with USD
                        }
                        rate = toAmount / amount;
                        return [2 /*return*/, {
                                success: true,
                                message: 'Swap quote calculated successfully',
                                data: {
                                    fromCurrency: fromCurrency,
                                    toCurrency: toCurrency,
                                    fromAmount: amount,
                                    toAmount: parseFloat(toAmount.toFixed(6)),
                                    rate: parseFloat(rate.toFixed(8)),
                                    usdValue: parseFloat(netUsd.toFixed(2)),
                                    feeUsd: parseFloat(feeUsd.toFixed(2)),
                                },
                            }];
                    case 6:
                        error_7 = _f.sent();
                        console.error('Error getting swap quote:', error_7);
                        return [2 /*return*/, {
                                success: false,
                                message: error_7 instanceof Error ? error_7.message : 'Failed to get swap quote',
                                error: error_7 instanceof Error ? error_7.message : 'Failed to get swap quote',
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute a swap between XRP, USDT, and USDC.
     * Supports both internal (database) and on-chain (XRPL DEX) swaps.
     */
    WalletService.prototype.executeSwap = function (userId, request) {
        return __awaiter(this, void 0, void 0, function () {
            var amount, fromCurrency, toCurrency, _a, swapType, _b, slippageTolerance, adminClient, _c, wallet, walletError, error_8;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 5, , 6]);
                        amount = request.amount, fromCurrency = request.fromCurrency, toCurrency = request.toCurrency, _a = request.swapType, swapType = _a === void 0 ? 'internal' : _a, _b = request.slippageTolerance, slippageTolerance = _b === void 0 ? 5 : _b;
                        if (!amount || amount <= 0) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Amount must be greater than 0',
                                    error: 'Invalid amount',
                                }];
                        }
                        if (fromCurrency === toCurrency) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'From and to currencies must be different',
                                    error: 'Invalid currency pair',
                                }];
                        }
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('*')
                                .eq('user_id', userId)
                                .single()];
                    case 1:
                        _c = _d.sent(), wallet = _c.data, walletError = _c.error;
                        if (walletError || !wallet) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Wallet not found',
                                    error: 'Wallet not found',
                                }];
                        }
                        if (!(swapType === 'onchain')) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.executeOnChainSwap(userId, wallet, amount, fromCurrency, toCurrency, slippageTolerance)];
                    case 2: return [2 /*return*/, _d.sent()];
                    case 3: return [4 /*yield*/, this.executeInternalSwap(userId, wallet, amount, fromCurrency, toCurrency)];
                    case 4: 
                    // Handle internal swap (existing logic)
                    return [2 /*return*/, _d.sent()];
                    case 5:
                        error_8 = _d.sent();
                        console.error('Error executing swap:', error_8);
                        return [2 /*return*/, {
                                success: false,
                                message: error_8 instanceof Error ? error_8.message : 'Failed to execute swap',
                                error: error_8 instanceof Error ? error_8.message : 'Failed to execute swap',
                            }];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Execute internal swap (database only)
     */
    WalletService.prototype.executeInternalSwap = function (userId, wallet, amount, fromCurrency, toCurrency) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, quoteResult, _a, fromAmount, toAmount, rate, usdValue, feeUsd, newBalanceXrp, newBalanceUsdt, newBalanceUsdc, amountXrp, amountUsd, ratesResult, xrpUsdRate, _b, transaction, txError, updateError, notifyError_1;
            var _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, this.getSwapQuote(userId, {
                                amount: amount,
                                fromCurrency: fromCurrency,
                                toCurrency: toCurrency,
                                useDEX: false,
                            })];
                    case 1:
                        quoteResult = _e.sent();
                        if (!quoteResult.success || !quoteResult.data) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: quoteResult.message || 'Failed to get swap quote',
                                    error: quoteResult.error || 'Quote failed',
                                }];
                        }
                        _a = quoteResult.data, fromAmount = _a.fromAmount, toAmount = _a.toAmount, rate = _a.rate, usdValue = _a.usdValue, feeUsd = _a.feeUsd;
                        newBalanceXrp = parseFloat((wallet.balance_xrp || 0).toFixed(6));
                        newBalanceUsdt = parseFloat((wallet.balance_usdt || 0).toFixed(6));
                        newBalanceUsdc = parseFloat((wallet.balance_usdc || 0).toFixed(6));
                        // Debit fromCurrency
                        if (fromCurrency === 'XRP') {
                            newBalanceXrp = Math.max(0, newBalanceXrp - fromAmount);
                        }
                        else if (fromCurrency === 'USDT') {
                            newBalanceUsdt = Math.max(0, newBalanceUsdt - fromAmount);
                        }
                        else {
                            newBalanceUsdc = Math.max(0, newBalanceUsdc - fromAmount);
                        }
                        // Credit toCurrency
                        if (toCurrency === 'XRP') {
                            newBalanceXrp += toAmount;
                        }
                        else if (toCurrency === 'USDT') {
                            newBalanceUsdt += toAmount;
                        }
                        else {
                            newBalanceUsdc += toAmount;
                        }
                        // Round to 6 decimal places
                        newBalanceXrp = parseFloat(newBalanceXrp.toFixed(6));
                        newBalanceUsdt = parseFloat(newBalanceUsdt.toFixed(6));
                        newBalanceUsdc = parseFloat(newBalanceUsdc.toFixed(6));
                        amountXrp = 0;
                        amountUsd = usdValue;
                        if (!(fromCurrency === 'XRP')) return [3 /*break*/, 2];
                        amountXrp = fromAmount;
                        return [3 /*break*/, 5];
                    case 2:
                        if (!(toCurrency === 'XRP')) return [3 /*break*/, 3];
                        amountXrp = toAmount;
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 4:
                        ratesResult = _e.sent();
                        xrpUsdRate = (_d = (_c = ratesResult.data) === null || _c === void 0 ? void 0 : _c.rates.find(function (r) { return r.currency === 'USD'; })) === null || _d === void 0 ? void 0 : _d.rate;
                        if (xrpUsdRate && xrpUsdRate > 0) {
                            amountXrp = usdValue / xrpUsdRate;
                        }
                        _e.label = 5;
                    case 5: return [4 /*yield*/, adminClient
                            .from('transactions')
                            .insert({
                            user_id: userId,
                            type: 'swap',
                            amount_xrp: amountXrp,
                            amount_usd: amountUsd,
                            status: 'completed',
                            description: "Internal swap ".concat(fromAmount, " ").concat(fromCurrency, " \u2192 ").concat(toAmount.toFixed(6), " ").concat(toCurrency),
                        })
                            .select()
                            .single()];
                    case 6:
                        _b = _e.sent(), transaction = _b.data, txError = _b.error;
                        if (txError || !transaction) {
                            console.error('Failed to create swap transaction:', txError);
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to create transaction record',
                                    error: 'Transaction creation failed',
                                }];
                        }
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: newBalanceXrp,
                                balance_usdt: newBalanceUsdt,
                                balance_usdc: newBalanceUsdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', wallet.id)];
                    case 7:
                        updateError = (_e.sent()).error;
                        if (!updateError) return [3 /*break*/, 9];
                        console.error('Failed to update wallet balances:', updateError);
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                status: 'failed',
                                description: "Swap failed: ".concat(updateError.message),
                            })
                                .eq('id', transaction.id)];
                    case 8:
                        _e.sent();
                        return [2 /*return*/, {
                                success: false,
                                message: 'Failed to update wallet balances',
                                error: 'Balance update failed',
                            }];
                    case 9:
                        _e.trys.push([9, 11, , 12]);
                        return [4 /*yield*/, notification_service_1.notificationService.createNotification({
                                userId: userId,
                                type: 'wallet_swap',
                                title: 'Swap completed',
                                message: "You swapped ".concat(fromAmount.toFixed(6), " ").concat(fromCurrency, " for ").concat(toAmount.toFixed(6), " ").concat(toCurrency, "."),
                                metadata: {
                                    transactionId: transaction.id,
                                    fromCurrency: fromCurrency,
                                    toCurrency: toCurrency,
                                    fromAmount: fromAmount,
                                    toAmount: toAmount,
                                    rate: rate,
                                    usdValue: usdValue,
                                },
                            })];
                    case 10:
                        _e.sent();
                        return [3 /*break*/, 12];
                    case 11:
                        notifyError_1 = _e.sent();
                        console.warn('Failed to create swap notification:', notifyError_1);
                        return [3 /*break*/, 12];
                    case 12: return [2 /*return*/, {
                            success: true,
                            message: 'Swap executed successfully',
                            data: {
                                transactionId: transaction.id,
                                fromCurrency: fromCurrency,
                                toCurrency: toCurrency,
                                fromAmount: fromAmount,
                                toAmount: toAmount,
                                rate: rate,
                                usdValue: usdValue,
                                feeUsd: feeUsd,
                                status: 'completed',
                                swapType: 'internal',
                            },
                        }];
                }
            });
        });
    };
    /**
     * Execute on-chain swap via XRPL DEX
     */
    WalletService.prototype.executeOnChainSwap = function (userId, wallet, amount, fromCurrency, toCurrency, slippageTolerance) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, dexQuote, _a, toAmount, rate, minAmount, estimatedFee, slippageMultiplier, adjustedMinAmount, ratesResult, xrpUsdRate, usdValue, feeUsd, hasTrust, walletSecret, trustResult, error_9, amountXrp, _b, transaction, txError, prepareResult, walletSecret, swapResult, internalSwaps, hasInternalSwaps, balances, notifyError_2, error_10, xummPayload, xummError_1, description, error_11;
            var _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, xrpl_dex_service_1.xrplDexService.getDEXPrice(fromCurrency, toCurrency, amount)];
                    case 1:
                        dexQuote = _g.sent();
                        if (!dexQuote.success || !dexQuote.data) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: dexQuote.error || 'Failed to get DEX quote',
                                    error: dexQuote.error || 'DEX quote failed',
                                }];
                        }
                        _a = dexQuote.data, toAmount = _a.toAmount, rate = _a.rate, minAmount = _a.minAmount, estimatedFee = _a.estimatedFee;
                        slippageMultiplier = (100 - slippageTolerance) / 100;
                        adjustedMinAmount = minAmount * slippageMultiplier;
                        return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 2:
                        ratesResult = _g.sent();
                        xrpUsdRate = ((_d = (_c = ratesResult.data) === null || _c === void 0 ? void 0 : _c.rates.find(function (r) { return r.currency === 'USD'; })) === null || _d === void 0 ? void 0 : _d.rate) || 0.5;
                        usdValue = 0;
                        if (fromCurrency === 'XRP') {
                            usdValue = amount * xrpUsdRate;
                        }
                        else {
                            usdValue = amount;
                        }
                        feeUsd = estimatedFee * xrpUsdRate;
                        if (!(toCurrency !== 'XRP')) return [3 /*break*/, 7];
                        return [4 /*yield*/, xrpl_dex_service_1.xrplDexService.hasTrustLine(wallet.xrpl_address, toCurrency)];
                    case 3:
                        hasTrust = _g.sent();
                        if (!!hasTrust) return [3 /*break*/, 7];
                        // Check if wallet has secret for creating trust line
                        if (!wallet.encrypted_wallet_secret) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Trust line required for ".concat(toCurrency, ". Please connect your wallet to create it."),
                                    error: 'Trust line required',
                                }];
                        }
                        _g.label = 4;
                    case 4:
                        _g.trys.push([4, 6, , 7]);
                        walletSecret = encryption_service_1.encryptionService.decrypt(wallet.encrypted_wallet_secret);
                        return [4 /*yield*/, xrpl_dex_service_1.xrplDexService.ensureTrustLine(wallet.xrpl_address, walletSecret, toCurrency)];
                    case 5:
                        trustResult = _g.sent();
                        if (!trustResult.success) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Failed to create trust line for ".concat(toCurrency, ": ").concat(trustResult.error),
                                    error: 'Trust line creation failed',
                                }];
                        }
                        return [3 /*break*/, 7];
                    case 6:
                        error_9 = _g.sent();
                        return [2 /*return*/, {
                                success: false,
                                message: 'Failed to decrypt wallet secret for trust line creation',
                                error: 'Wallet secret decryption failed',
                            }];
                    case 7:
                        amountXrp = 0;
                        if (fromCurrency === 'XRP') {
                            amountXrp = amount;
                        }
                        else if (toCurrency === 'XRP') {
                            amountXrp = toAmount;
                        }
                        else {
                            amountXrp = usdValue / xrpUsdRate;
                        }
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .insert({
                                user_id: userId,
                                type: 'swap',
                                amount_xrp: amountXrp,
                                amount_usd: usdValue,
                                status: 'pending',
                                description: "On-chain swap ".concat(amount, " ").concat(fromCurrency, " \u2192 ").concat(toAmount.toFixed(6), " ").concat(toCurrency),
                            })
                                .select()
                                .single()];
                    case 8:
                        _b = _g.sent(), transaction = _b.data, txError = _b.error;
                        if (txError || !transaction) {
                            console.error('Failed to create swap transaction:', txError);
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to create transaction record',
                                    error: 'Transaction creation failed',
                                }];
                        }
                        return [4 /*yield*/, xrpl_dex_service_1.xrplDexService.prepareSwapTransaction(wallet.xrpl_address, amount, fromCurrency, toCurrency, adjustedMinAmount)];
                    case 9:
                        prepareResult = _g.sent();
                        if (!(!prepareResult.success || !prepareResult.transaction)) return [3 /*break*/, 11];
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                status: 'failed',
                                description: "Swap preparation failed: ".concat(prepareResult.error),
                            })
                                .eq('id', transaction.id)];
                    case 10:
                        _g.sent();
                        return [2 /*return*/, {
                                success: false,
                                message: prepareResult.error || 'Failed to prepare swap transaction',
                                error: 'Transaction preparation failed',
                            }];
                    case 11:
                        if (!wallet.encrypted_wallet_secret) return [3 /*break*/, 29];
                        _g.label = 12;
                    case 12:
                        _g.trys.push([12, 26, , 28]);
                        walletSecret = encryption_service_1.encryptionService.decrypt(wallet.encrypted_wallet_secret);
                        return [4 /*yield*/, xrpl_dex_service_1.xrplDexService.executeSwap(wallet.xrpl_address, walletSecret, amount, fromCurrency, toCurrency, adjustedMinAmount)];
                    case 13:
                        swapResult = _g.sent();
                        if (!(!swapResult.success || !swapResult.txHash)) return [3 /*break*/, 15];
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                status: 'failed',
                                description: "Swap execution failed: ".concat(swapResult.error),
                            })
                                .eq('id', transaction.id)];
                    case 14:
                        _g.sent();
                        return [2 /*return*/, {
                                success: false,
                                message: swapResult.error || 'Failed to execute swap',
                                error: 'Swap execution failed',
                            }];
                    case 15: 
                    // Update transaction with hash
                    return [4 /*yield*/, adminClient
                            .from('transactions')
                            .update({
                            xrpl_tx_hash: swapResult.txHash,
                            status: 'completed',
                            description: "On-chain swap completed: ".concat(swapResult.txHash),
                        })
                            .eq('id', transaction.id)];
                    case 16:
                        // Update transaction with hash
                        _g.sent();
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('id')
                                .eq('user_id', userId)
                                .eq('type', 'swap')
                                .eq('status', 'completed')
                                .is('xrpl_tx_hash', null) // Internal swaps have no xrpl_tx_hash
                                .limit(1)];
                    case 17:
                        internalSwaps = (_g.sent()).data;
                        hasInternalSwaps = internalSwaps && internalSwaps.length > 0;
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(wallet.xrpl_address)];
                    case 18:
                        balances = _g.sent();
                        if (!hasInternalSwaps) return [3 /*break*/, 20];
                        // Preserve internal swap balances for tokens, but sync XRP
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: balances.xrp, // Always sync XRP from XRPL
                                // Preserve USDT/USDC from database (internal swaps)
                                balance_usdt: wallet.balance_usdt || balances.usdt,
                                balance_usdc: wallet.balance_usdc || balances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', wallet.id)];
                    case 19:
                        // Preserve internal swap balances for tokens, but sync XRP
                        _g.sent();
                        return [3 /*break*/, 22];
                    case 20: 
                    // No internal swaps, safe to sync all from XRPL
                    return [4 /*yield*/, adminClient
                            .from('wallets')
                            .update({
                            balance_xrp: balances.xrp,
                            balance_usdt: balances.usdt,
                            balance_usdc: balances.usdc,
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', wallet.id)];
                    case 21:
                        // No internal swaps, safe to sync all from XRPL
                        _g.sent();
                        _g.label = 22;
                    case 22:
                        _g.trys.push([22, 24, , 25]);
                        return [4 /*yield*/, notification_service_1.notificationService.createNotification({
                                userId: userId,
                                type: 'wallet_swap',
                                title: 'On-chain swap completed',
                                message: "You swapped ".concat(amount, " ").concat(fromCurrency, " for ").concat(((_e = swapResult.actualToAmount) === null || _e === void 0 ? void 0 : _e.toFixed(6)) || toAmount.toFixed(6), " ").concat(toCurrency, " on XRPL."),
                                metadata: {
                                    transactionId: transaction.id,
                                    xrplTxHash: swapResult.txHash,
                                    fromCurrency: fromCurrency,
                                    toCurrency: toCurrency,
                                    fromAmount: swapResult.actualFromAmount || amount,
                                    toAmount: swapResult.actualToAmount || toAmount,
                                    rate: rate,
                                    usdValue: usdValue,
                                },
                            })];
                    case 23:
                        _g.sent();
                        return [3 /*break*/, 25];
                    case 24:
                        notifyError_2 = _g.sent();
                        console.warn('Failed to create swap notification:', notifyError_2);
                        return [3 /*break*/, 25];
                    case 25: return [2 /*return*/, {
                            success: true,
                            message: 'On-chain swap executed successfully',
                            data: {
                                transactionId: transaction.id,
                                fromCurrency: fromCurrency,
                                toCurrency: toCurrency,
                                fromAmount: swapResult.actualFromAmount || amount,
                                toAmount: swapResult.actualToAmount || toAmount,
                                rate: rate,
                                usdValue: usdValue,
                                feeUsd: feeUsd,
                                status: 'completed',
                                swapType: 'onchain',
                                xrplTxHash: swapResult.txHash,
                            },
                        }];
                    case 26:
                        error_10 = _g.sent();
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                status: 'failed',
                                description: "Swap execution error: ".concat(error_10 instanceof Error ? error_10.message : 'Unknown error'),
                            })
                                .eq('id', transaction.id)];
                    case 27:
                        _g.sent();
                        return [2 /*return*/, {
                                success: false,
                                message: error_10 instanceof Error ? error_10.message : 'Failed to execute swap',
                                error: 'Swap execution failed',
                            }];
                    case 28: return [3 /*break*/, 37];
                    case 29:
                        _g.trys.push([29, 35, , 37]);
                        xummPayload = null;
                        _g.label = 30;
                    case 30:
                        _g.trys.push([30, 32, , 33]);
                        return [4 /*yield*/, xumm_service_1.xummService.createPayload(prepareResult.transaction)];
                    case 31:
                        xummPayload = _g.sent();
                        return [3 /*break*/, 33];
                    case 32:
                        xummError_1 = _g.sent();
                        console.log('XUMM not available, returning transaction blob for direct signing');
                        return [3 /*break*/, 33];
                    case 33:
                        description = xummPayload
                            ? "On-chain swap pending signature | XUMM_UUID:".concat(xummPayload.uuid)
                            : "On-chain swap pending signature | Transaction prepared";
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                description: description,
                            })
                                .eq('id', transaction.id)];
                    case 34:
                        _g.sent();
                        return [2 /*return*/, {
                                success: true,
                                message: xummPayload
                                    ? 'Transaction prepared. Please sign in Xaman app.'
                                    : 'Transaction prepared. Please sign with your XRPL wallet.',
                                data: {
                                    transactionId: transaction.id,
                                    fromCurrency: fromCurrency,
                                    toCurrency: toCurrency,
                                    fromAmount: amount,
                                    toAmount: toAmount,
                                    rate: rate,
                                    usdValue: usdValue,
                                    feeUsd: feeUsd,
                                    status: 'pending',
                                    swapType: 'onchain',
                                    transactionBlob: prepareResult.transactionBlob,
                                    xummUrl: ((_f = xummPayload === null || xummPayload === void 0 ? void 0 : xummPayload.next) === null || _f === void 0 ? void 0 : _f.always) || undefined,
                                    xummUuid: (xummPayload === null || xummPayload === void 0 ? void 0 : xummPayload.uuid) || undefined,
                                },
                            }];
                    case 35:
                        error_11 = _g.sent();
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                status: 'failed',
                                description: "Swap preparation error: ".concat(error_11 instanceof Error ? error_11.message : 'Unknown error'),
                            })
                                .eq('id', transaction.id)];
                    case 36:
                        _g.sent();
                        return [2 /*return*/, {
                                success: false,
                                message: error_11 instanceof Error ? error_11.message : 'Failed to prepare swap',
                                error: 'Swap preparation failed',
                            }];
                    case 37: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Fund wallet (deposit)
     */
    WalletService.prototype.fundWallet = function (userId, request) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, wallet, amountXrp, amountUsd, amountToken, exchangeRates, usdRate, exchangeRates, usdRate, exchangeRates, usdRate, _a, transaction, txError, currency, amount, preparedTx, xummPayload, xummError, error_12, description, walletType, message, error_13;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 17, , 18]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('*')
                                .eq('user_id', userId)
                                .single()];
                    case 1:
                        wallet = (_e.sent()).data;
                        if (!wallet) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Wallet not found',
                                    error: 'Wallet not found',
                                }];
                        }
                        amountXrp = request.amount;
                        amountUsd = request.amount;
                        amountToken = request.amount;
                        if (!(request.currency === 'USD')) return [3 /*break*/, 3];
                        return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 2:
                        exchangeRates = _e.sent();
                        if (!exchangeRates.success || !exchangeRates.data) {
                            throw new Error('Failed to fetch exchange rates for currency conversion');
                        }
                        usdRate = (_b = exchangeRates.data.rates.find(function (r) { return r.currency === 'USD'; })) === null || _b === void 0 ? void 0 : _b.rate;
                        if (!usdRate || usdRate <= 0) {
                            throw new Error('XRP/USD exchange rate not available');
                        }
                        amountXrp = request.amount / usdRate;
                        return [3 /*break*/, 7];
                    case 3:
                        if (!(request.currency === 'XRP')) return [3 /*break*/, 5];
                        return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 4:
                        exchangeRates = _e.sent();
                        if (!exchangeRates.success || !exchangeRates.data) {
                            throw new Error('Failed to fetch exchange rates for currency conversion');
                        }
                        usdRate = (_c = exchangeRates.data.rates.find(function (r) { return r.currency === 'USD'; })) === null || _c === void 0 ? void 0 : _c.rate;
                        if (!usdRate || usdRate <= 0) {
                            throw new Error('XRP/USD exchange rate not available');
                        }
                        amountUsd = request.amount * usdRate;
                        return [3 /*break*/, 7];
                    case 5:
                        if (!(request.currency === 'USDT' || request.currency === 'USDC')) return [3 /*break*/, 7];
                        // For USDT/USDC, amount is already in USD value
                        amountUsd = request.amount;
                        amountToken = request.amount;
                        return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 6:
                        exchangeRates = _e.sent();
                        if (!exchangeRates.success || !exchangeRates.data) {
                            throw new Error('Failed to fetch exchange rates for currency conversion');
                        }
                        usdRate = (_d = exchangeRates.data.rates.find(function (r) { return r.currency === 'USD'; })) === null || _d === void 0 ? void 0 : _d.rate;
                        if (!usdRate || usdRate <= 0) {
                            throw new Error('XRP/USD exchange rate not available');
                        }
                        amountXrp = request.amount / usdRate; // For display purposes
                        _e.label = 7;
                    case 7: return [4 /*yield*/, adminClient
                            .from('transactions')
                            .insert({
                            user_id: userId,
                            type: 'deposit',
                            amount_xrp: amountXrp,
                            amount_usd: amountUsd,
                            status: 'pending',
                            description: "Deposit ".concat(request.amount, " ").concat(request.currency),
                        })
                            .select()
                            .single()];
                    case 8:
                        _a = _e.sent(), transaction = _a.data, txError = _a.error;
                        if (txError || !transaction) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to create transaction',
                                    error: 'Failed to create transaction',
                                }];
                        }
                        currency = request.currency === 'USD' ? 'XRP' : request.currency;
                        amount = currency === 'XRP' ? amountXrp : amountToken;
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.preparePaymentTransaction(wallet.xrpl_address, amount, currency)];
                    case 9:
                        preparedTx = _e.sent();
                        xummPayload = null;
                        xummError = null;
                        if (!(currency === 'XRP')) return [3 /*break*/, 14];
                        _e.label = 10;
                    case 10:
                        _e.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, xumm_service_1.xummService.createPayload(preparedTx.transaction)];
                    case 11:
                        xummPayload = _e.sent();
                        return [3 /*break*/, 13];
                    case 12:
                        error_12 = _e.sent();
                        xummError = error_12 instanceof Error ? error_12.message : 'XUMM not configured';
                        console.log('XUMM not configured or error:', xummError);
                        return [3 /*break*/, 13];
                    case 13: return [3 /*break*/, 15];
                    case 14:
                        // For USDT/USDC, use MetaMask (no XUMM)
                        console.log("Using MetaMask flow for ".concat(currency, " deposit"));
                        _e.label = 15;
                    case 15:
                        description = xummPayload
                            ? "Deposit ".concat(request.amount, " ").concat(request.currency, " | XUMM_UUID:").concat(xummPayload.uuid)
                            : "Deposit ".concat(request.amount, " ").concat(request.currency, " | Direct signing");
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                description: description,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transaction.id)];
                    case 16:
                        _e.sent();
                        walletType = currency === 'XRP' ? 'Xaman' : 'MetaMask';
                        message = xummPayload
                            ? "Transaction prepared. Please sign in ".concat(walletType, " app.")
                            : currency === 'XRP'
                                ? 'Transaction prepared. Please sign with your XRPL wallet (Xaman, Crossmark, etc.).'
                                : "Transaction prepared. Please sign with MetaMask (XRPL Snap) for ".concat(currency, " deposit.");
                        return [2 /*return*/, {
                                success: true,
                                message: message,
                                data: __assign(__assign(__assign(__assign({ transactionId: transaction.id, amount: {
                                        usd: parseFloat(amountUsd.toFixed(2)),
                                        xrp: parseFloat(amountXrp.toFixed(6)),
                                    }, currency: currency }, (xummPayload && {
                                    xummUrl: xummPayload.next.always,
                                    xummUuid: xummPayload.uuid,
                                    walletType: 'xaman',
                                })), { 
                                    // Transaction for wallet signing (always present)
                                    transaction: preparedTx.transaction, transactionBlob: preparedTx.transactionBlob, destinationAddress: wallet.xrpl_address, amountXrp: parseFloat(amountXrp.toFixed(6)), amountToken: currency !== 'XRP' ? parseFloat(amountToken.toFixed(6)) : undefined, status: 'pending' }), (!xummPayload && {
                                    walletType: currency === 'XRP' ? 'browser' : 'metamask',
                                    note: currency === 'XRP'
                                        ? 'XUMM not available, use browser wallet instead'
                                        : "Use MetaMask with XRPL Snap to sign ".concat(currency, " transaction"),
                                })), (xummError && {
                                    xummError: xummError,
                                })),
                            }];
                    case 17:
                        error_13 = _e.sent();
                        console.error('Error funding wallet:', error_13);
                        return [2 /*return*/, {
                                success: false,
                                message: error_13 instanceof Error ? error_13.message : 'Failed to fund wallet',
                                error: error_13 instanceof Error ? error_13.message : 'Failed to fund wallet',
                            }];
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get XUMM payload status for deposit
     */
    WalletService.prototype.getXUMMPayloadStatus = function (userId, transactionId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, transaction, uuidMatch, xummUuid, payloadStatus, submitResult, status_2, wallet, balances, wallet, balances, error_14;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
            return __generator(this, function (_x) {
                switch (_x.label) {
                    case 0:
                        _x.trys.push([0, 16, , 17]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('*')
                                .eq('id', transactionId)
                                .eq('user_id', userId)
                                .single()];
                    case 1:
                        transaction = (_x.sent()).data;
                        if (!transaction) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Transaction not found',
                                    error: 'Transaction not found',
                                }];
                        }
                        uuidMatch = (_a = transaction.description) === null || _a === void 0 ? void 0 : _a.match(/XUMM_UUID:([a-f0-9-]+)/i);
                        if (!uuidMatch) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'XUMM UUID not found for this transaction',
                                    error: 'XUMM UUID not found',
                                }];
                        }
                        xummUuid = uuidMatch[1];
                        return [4 /*yield*/, xumm_service_1.xummService.getPayloadStatus(xummUuid)];
                    case 2:
                        payloadStatus = _x.sent();
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:346', message: 'getXUMMPayloadStatus: Received XUMM payload status', data: { signed: payloadStatus.meta.signed, submit: payloadStatus.meta.submit, hasHex: !!((_b = payloadStatus.response) === null || _b === void 0 ? void 0 : _b.hex), hasTxid: !!((_c = payloadStatus.response) === null || _c === void 0 ? void 0 : _c.txid), txid: (_d = payloadStatus.response) === null || _d === void 0 ? void 0 : _d.txid, hexLength: (_f = (_e = payloadStatus.response) === null || _e === void 0 ? void 0 : _e.hex) === null || _f === void 0 ? void 0 : _f.length, responseKeys: payloadStatus.response ? Object.keys(payloadStatus.response) : null, metaKeys: Object.keys(payloadStatus.meta) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        // #endregion
                        // If signed, submit to XRPL and update transaction
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:350', message: 'getXUMMPayloadStatus: Checking if transaction needs processing', data: { signed: payloadStatus.meta.signed, hasHex: !!((_g = payloadStatus.response) === null || _g === void 0 ? void 0 : _g.hex), willProcess: payloadStatus.meta.signed && !!((_h = payloadStatus.response) === null || _h === void 0 ? void 0 : _h.hex), hasTxid: !!((_j = payloadStatus.response) === null || _j === void 0 ? void 0 : _j.txid), autoSubmitted: payloadStatus.meta.submit && !!((_k = payloadStatus.response) === null || _k === void 0 ? void 0 : _k.txid) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        if (!(payloadStatus.meta.signed && ((_l = payloadStatus.response) === null || _l === void 0 ? void 0 : _l.hex))) return [3 /*break*/, 9];
                        // Case 1: Submit signed transaction to XRPL
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:352', message: 'getXUMMPayloadStatus: Submitting signed transaction to XRPL', data: { hasHex: !!((_m = payloadStatus.response) === null || _m === void 0 ? void 0 : _m.hex), hexLength: (_p = (_o = payloadStatus.response) === null || _o === void 0 ? void 0 : _o.hex) === null || _p === void 0 ? void 0 : _p.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(function () { });
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.submitSignedTransaction(payloadStatus.response.hex)];
                    case 3:
                        submitResult = _x.sent();
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:355', message: 'getXUMMPayloadStatus: XRPL submit result', data: { hash: submitResult.hash, status: submitResult.status, isSuccess: submitResult.status === 'tesSUCCESS' }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(function () { });
                        status_2 = submitResult.status === 'tesSUCCESS' ? 'completed' : 'failed';
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                xrpl_tx_hash: submitResult.hash,
                                status: status_2,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transactionId)];
                    case 4:
                        _x.sent();
                        if (!(status_2 === 'completed')) return [3 /*break*/, 8];
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:366', message: 'getXUMMPayloadStatus: About to update wallet balance', data: { userId: userId, status: status_2 }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', userId)
                                .single()];
                    case 5:
                        wallet = (_x.sent()).data;
                        if (!wallet) return [3 /*break*/, 8];
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:372', message: 'getXUMMPayloadStatus: Fetching balances from XRPL', data: { xrplAddress: wallet.xrpl_address }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(wallet.xrpl_address)];
                    case 6:
                        balances = _x.sent();
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:373', message: 'getXUMMPayloadStatus: Got balances from XRPL', data: { xrp: balances.xrp, usdt: balances.usdt, usdc: balances.usdc }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        // #endregion
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: balances.xrp,
                                balance_usdt: balances.usdt,
                                balance_usdc: balances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('user_id', userId)];
                    case 7:
                        // #endregion
                        _x.sent();
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:381', message: 'getXUMMPayloadStatus: Updated wallet balance in DB', data: { xrp: balances.xrp, usdt: balances.usdt, usdc: balances.usdc }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        _x.label = 8;
                    case 8: return [2 /*return*/, {
                            success: true,
                            message: 'Transaction signed and submitted',
                            data: {
                                signed: true,
                                signedTxBlob: payloadStatus.response.hex,
                                cancelled: payloadStatus.meta.cancelled,
                                expired: payloadStatus.meta.expired,
                                xrplTxHash: submitResult.hash,
                            },
                        }];
                    case 9:
                        if (!(payloadStatus.meta.signed && payloadStatus.meta.submit && ((_q = payloadStatus.response) === null || _q === void 0 ? void 0 : _q.txid))) return [3 /*break*/, 15];
                        // Case 2: XUMM auto-submitted the transaction (already on XRPL)
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:433', message: 'getXUMMPayloadStatus: XUMM auto-submitted transaction, updating DB', data: { txid: payloadStatus.response.txid, submit: payloadStatus.meta.submit }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        // #endregion
                        console.log('[XUMM Fix] Auto-submitted transaction detected:', {
                            transactionId: transactionId,
                            userId: userId,
                            txid: payloadStatus.response.txid,
                            signed: payloadStatus.meta.signed,
                            submit: payloadStatus.meta.submit,
                        });
                        // Transaction is already on XRPL, just update database
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                xrpl_tx_hash: payloadStatus.response.txid,
                                status: 'completed',
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transactionId)];
                    case 10:
                        // Transaction is already on XRPL, just update database
                        _x.sent();
                        // Update wallet balance
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:444', message: 'getXUMMPayloadStatus: About to update wallet balance (auto-submitted)', data: { userId: userId }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', userId)
                                .single()];
                    case 11:
                        wallet = (_x.sent()).data;
                        if (!wallet) return [3 /*break*/, 14];
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:450', message: 'getXUMMPayloadStatus: Fetching balances from XRPL (auto-submitted)', data: { xrplAddress: wallet.xrpl_address }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(wallet.xrpl_address)];
                    case 12:
                        balances = _x.sent();
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:451', message: 'getXUMMPayloadStatus: Got balances from XRPL (auto-submitted)', data: { xrp: balances.xrp, usdt: balances.usdt, usdc: balances.usdc }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        // #endregion
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: balances.xrp,
                                balance_usdt: balances.usdt,
                                balance_usdc: balances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('user_id', userId)];
                    case 13:
                        // #endregion
                        _x.sent();
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:459', message: 'getXUMMPayloadStatus: Updated wallet balance in DB (auto-submitted)', data: { xrp: balances.xrp, usdt: balances.usdt, usdc: balances.usdc }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        // #endregion
                        console.log('[XUMM Fix] Balance updated successfully for auto-submitted transaction:', {
                            transactionId: transactionId,
                            userId: userId,
                            xrp: balances.xrp,
                            usdt: balances.usdt,
                            usdc: balances.usdc,
                            txid: payloadStatus.response.txid,
                        });
                        _x.label = 14;
                    case 14: return [2 /*return*/, {
                            success: true,
                            message: 'Transaction signed and auto-submitted by XUMM',
                            data: {
                                signed: true,
                                signedTxBlob: ((_r = payloadStatus.response) === null || _r === void 0 ? void 0 : _r.hex) || null,
                                cancelled: payloadStatus.meta.cancelled,
                                expired: payloadStatus.meta.expired,
                                xrplTxHash: payloadStatus.response.txid,
                            },
                        }];
                    case 15:
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'wallet.service.ts:400', message: 'getXUMMPayloadStatus: Returning status without processing', data: { signed: payloadStatus.meta.signed, hasHex: !!((_s = payloadStatus.response) === null || _s === void 0 ? void 0 : _s.hex), hasTxid: !!((_t = payloadStatus.response) === null || _t === void 0 ? void 0 : _t.txid), txid: (_u = payloadStatus.response) === null || _u === void 0 ? void 0 : _u.txid, submit: payloadStatus.meta.submit, reason: 'No hex or not signed' }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        // #endregion
                        return [2 /*return*/, {
                                success: true,
                                message: 'Payload status retrieved',
                                data: {
                                    signed: payloadStatus.meta.signed,
                                    signedTxBlob: ((_v = payloadStatus.response) === null || _v === void 0 ? void 0 : _v.hex) || null,
                                    cancelled: payloadStatus.meta.cancelled,
                                    expired: payloadStatus.meta.expired,
                                    xrplTxHash: ((_w = payloadStatus.response) === null || _w === void 0 ? void 0 : _w.txid) || null,
                                },
                            }];
                    case 16:
                        error_14 = _x.sent();
                        console.error('Error getting XUMM payload status:', error_14);
                        return [2 /*return*/, {
                                success: false,
                                message: error_14 instanceof Error ? error_14.message : 'Failed to get payload status',
                                error: error_14 instanceof Error ? error_14.message : 'Failed to get payload status',
                            }];
                    case 17: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Submit signed deposit transaction (for browser wallets like Crossmark, MetaMask+XRPL Snap)
     */
    WalletService.prototype.submitSignedDeposit = function (userId, transactionId, signedTxBlob) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, transaction, submitResult, status_3, walletForBalance, balances, notifyError_3, error_15, errorMessage, userMessage, helpfulHint;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 11, , 12]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('*')
                                .eq('id', transactionId)
                                .eq('user_id', userId)
                                .single()];
                    case 1:
                        transaction = (_a.sent()).data;
                        if (!transaction) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Transaction not found',
                                    error: 'Transaction not found',
                                }];
                        }
                        if (transaction.status !== 'pending') {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Transaction is not pending',
                                    error: 'Transaction already processed',
                                }];
                        }
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.submitSignedTransaction(signedTxBlob)];
                    case 2:
                        submitResult = _a.sent();
                        status_3 = submitResult.status === 'tesSUCCESS' ? 'completed' : 'failed';
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                xrpl_tx_hash: submitResult.hash,
                                status: status_3,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transactionId)];
                    case 3:
                        _a.sent();
                        if (!(status_3 === 'completed')) return [3 /*break*/, 10];
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', userId)
                                .single()];
                    case 4:
                        walletForBalance = (_a.sent()).data;
                        if (!walletForBalance) return [3 /*break*/, 10];
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(walletForBalance.xrpl_address)];
                    case 5:
                        balances = _a.sent();
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: balances.xrp,
                                balance_usdt: balances.usdt,
                                balance_usdc: balances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('user_id', userId)];
                    case 6:
                        _a.sent();
                        _a.label = 7;
                    case 7:
                        _a.trys.push([7, 9, , 10]);
                        return [4 /*yield*/, notification_service_1.notificationService.createNotification({
                                userId: userId,
                                type: 'wallet_deposit',
                                title: 'Deposit received',
                                message: "You deposited ".concat(parseFloat(transaction.amount_xrp).toFixed(6), " XRP (~$").concat(parseFloat(transaction.amount_usd).toFixed(2), ")."),
                                metadata: {
                                    transactionId: transactionId,
                                    xrplTxHash: submitResult.hash,
                                    amountXrp: parseFloat(transaction.amount_xrp),
                                    amountUsd: parseFloat(transaction.amount_usd),
                                },
                            })];
                    case 8:
                        _a.sent();
                        return [3 /*break*/, 10];
                    case 9:
                        notifyError_3 = _a.sent();
                        console.warn('Failed to create deposit notification:', notifyError_3);
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/, {
                            success: true,
                            message: 'Deposit transaction submitted successfully',
                            data: {
                                xrplTxHash: submitResult.hash,
                                status: status_3,
                            },
                        }];
                    case 11:
                        error_15 = _a.sent();
                        console.error('Error submitting signed deposit:', {
                            error: error_15 instanceof Error ? error_15.message : String(error_15),
                            transactionId: transactionId,
                            signedTxType: typeof signedTxBlob,
                            signedTxPreview: typeof signedTxBlob === 'string'
                                ? signedTxBlob.substring(0, 200)
                                : JSON.stringify(signedTxBlob).substring(0, 200),
                        });
                        errorMessage = error_15 instanceof Error ? error_15.message : 'Failed to submit transaction';
                        userMessage = errorMessage;
                        helpfulHint = '';
                        if (errorMessage.includes('transaction ID') || errorMessage.includes('UUID')) {
                            userMessage = 'Invalid signed transaction format: You appear to be sending a transaction ID instead of the signed transaction blob.';
                            helpfulHint = 'Please ensure you are sending the actual signed transaction returned by MetaMask/XRPL Snap. The signed transaction should be either: (1) A hex string (1000+ characters), (2) A transaction object with TransactionType field, or (3) A wrapped format like { tx_blob: "..." }.';
                        }
                        else if (errorMessage.includes('Invalid hex string') || errorMessage.includes('Invalid transaction format')) {
                            userMessage = 'Invalid transaction format. The signed transaction from MetaMask/XRPL Snap is not in the expected format.';
                            helpfulHint = 'Expected formats: (1) Hex string (1000+ characters) like "1200002280000000...", (2) Transaction object with TransactionType, Account, etc., or (3) Wrapped format like { tx_blob: "..." } or { signedTransaction: {...} }.';
                        }
                        else if (errorMessage.includes('too short')) {
                            userMessage = 'Transaction blob appears too short to be a valid signed transaction.';
                            helpfulHint = 'XRPL transaction blobs are typically 1000+ characters long. Please ensure you are sending the complete signed transaction from MetaMask/XRPL Snap.';
                        }
                        else if (errorMessage.includes('TransactionType')) {
                            userMessage = 'Transaction object is missing required fields.';
                            helpfulHint = 'A valid XRPL transaction object must include TransactionType, Account, and other required fields. Please ensure MetaMask/XRPL Snap returned a complete signed transaction.';
                        }
                        return [2 /*return*/, __assign({ success: false, message: userMessage, error: errorMessage }, (helpfulHint && { hint: helpfulHint }))];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Withdraw from wallet
     */
    WalletService.prototype.withdrawWallet = function (userId, request) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, wallet, amountXrp, amountUsd, exchangeRates, usdRate, exchangeRates, usdRate, DESTINATION_RESERVE, destinationBalance, destinationBalanceAfterPayment, destError_1, isAccountNotFound, balance, BASE_RESERVE, ESTIMATED_FEE, minimumRequired, availableBalance, _a, transaction, txError, oldBalance, error_16, _b, newXrplAddress, newWalletSecret, encryptedSecret, _c, updatedWallet, updateError, walletSecret, xrplTxHash, xrplError_1, updateResult, balances, receiverWallet, receiverTx, receiverBalances, notifyError_4, receiverError_1, error_17;
            var _d, _e, _f, _g, _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        _k.trys.push([0, 40, , 41]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('*')
                                .eq('user_id', userId)
                                .single()];
                    case 1:
                        wallet = (_k.sent()).data;
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        if (!wallet) {
                            // #region agent log
                            // ...existing code...
                            // #endregion
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Wallet not found',
                                    error: 'Wallet not found',
                                }];
                        }
                        amountXrp = request.amount;
                        amountUsd = request.amount;
                        if (!(request.currency === 'USD')) return [3 /*break*/, 3];
                        return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 2:
                        exchangeRates = _k.sent();
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
                        // The withdrawWallet method and all other methods are now properly closed and inside the WalletService class.
                        // Round to 6 decimal places (XRPL maximum precision)
                        amountXrp = Math.round(amountXrp * 1000000) / 1000000;
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 4:
                        exchangeRates = _k.sent();
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
                        // Round XRP amount to 6 decimal places (XRPL maximum precision)
                        amountXrp = Math.round(amountXrp * 1000000) / 1000000;
                        _k.label = 5;
                    case 5:
                        // Validate destination address is different from source
                        if (wallet.xrpl_address === request.destinationAddress) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Cannot withdraw to the same address. Please provide a different destination address.',
                                    error: 'Invalid destination address',
                                }];
                        }
                        DESTINATION_RESERVE = 1.0;
                        _k.label = 6;
                    case 6:
                        _k.trys.push([6, 8, , 9]);
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getBalance(request.destinationAddress)];
                    case 7:
                        destinationBalance = _k.sent();
                        destinationBalanceAfterPayment = destinationBalance + amountXrp;
                        // If destination account exists but would have less than reserve after payment, reject early
                        if (destinationBalance > 0 && destinationBalanceAfterPayment < DESTINATION_RESERVE) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Transaction would leave destination account with insufficient XRP. Destination currently has ".concat(destinationBalance.toFixed(6), " XRP. After receiving ").concat(amountXrp.toFixed(6), " XRP, it would have ").concat(destinationBalanceAfterPayment.toFixed(6), " XRP, which is less than the required ").concat(DESTINATION_RESERVE, " XRP reserve. Please send a larger amount so the destination has at least ").concat(DESTINATION_RESERVE, " XRP after the transaction."),
                                    error: 'Destination account reserve requirement not met',
                                }];
                        }
                        // If destination account doesn't exist (balance is 0 or account not found), amount must be at least reserve
                        if (destinationBalance === 0 && amountXrp < DESTINATION_RESERVE) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Cannot send ".concat(amountXrp.toFixed(6), " XRP to a new account. The destination account doesn't exist yet, and creating it requires at least ").concat(DESTINATION_RESERVE, " XRP (XRPL base reserve requirement). Please send at least ").concat(DESTINATION_RESERVE, " XRP to create a new account."),
                                    error: 'Insufficient amount for new account creation',
                                }];
                        }
                        return [3 /*break*/, 9];
                    case 8:
                        destError_1 = _k.sent();
                        isAccountNotFound = (destError_1 instanceof Error && (destError_1.message.includes('actNotFound') || destError_1.message.includes('Account not found'))) ||
                            ((_f = destError_1 === null || destError_1 === void 0 ? void 0 : destError_1.data) === null || _f === void 0 ? void 0 : _f.error) === 'actNotFound' ||
                            (((_g = destError_1 === null || destError_1 === void 0 ? void 0 : destError_1.data) === null || _g === void 0 ? void 0 : _g.error_message) === 'accountNotFound' || ((_h = destError_1 === null || destError_1 === void 0 ? void 0 : destError_1.data) === null || _h === void 0 ? void 0 : _h.error_message) === 'Account not found.') ||
                            ((_j = destError_1 === null || destError_1 === void 0 ? void 0 : destError_1.data) === null || _j === void 0 ? void 0 : _j.error_code) === 19;
                        if (isAccountNotFound && amountXrp < DESTINATION_RESERVE) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Cannot send ".concat(amountXrp.toFixed(6), " XRP to a new account. The destination account doesn't exist yet, and creating it requires at least ").concat(DESTINATION_RESERVE, " XRP (XRPL base reserve requirement). Please send at least ").concat(DESTINATION_RESERVE, " XRP to create a new account."),
                                    error: 'Insufficient amount for new account creation',
                                }];
                        }
                        // If it's a different error (network issue, etc.), log but continue
                        // The transaction will fail on XRPL with tecNO_DST_INSUF_XRP if this validation was needed
                        console.warn('[WARNING] Failed to pre-validate destination account, proceeding with transaction:', {
                            destinationAddress: request.destinationAddress,
                            error: destError_1 instanceof Error ? destError_1.message : String(destError_1),
                        });
                        return [3 /*break*/, 9];
                    case 9: return [4 /*yield*/, this.getBalance(userId)];
                    case 10:
                        balance = _k.sent();
                        BASE_RESERVE = 1.0;
                        ESTIMATED_FEE = 0.000015;
                        minimumRequired = BASE_RESERVE + ESTIMATED_FEE;
                        availableBalance = Math.max(0, balance.balance_xrp - minimumRequired);
                        if (availableBalance < amountXrp) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Insufficient available balance. You have ".concat(balance.balance_xrp.toFixed(6), " XRP total, but must maintain ").concat(BASE_RESERVE, " XRP reserve. Available: ").concat(availableBalance.toFixed(6), " XRP. Requested: ").concat(amountXrp.toFixed(6), " XRP."),
                                    error: 'Insufficient available balance (reserve requirement)',
                                }];
                        }
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .insert({
                                user_id: userId,
                                type: 'withdrawal',
                                amount_xrp: amountXrp,
                                amount_usd: amountUsd,
                                status: 'pending',
                                description: "Withdrawal to ".concat(request.destinationAddress),
                            })
                                .select()
                                .single()];
                    case 11:
                        _a = _k.sent(), transaction = _a.data, txError = _a.error;
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        if (txError || !transaction) {
                            // #region agent log
                            // ...existing code...
                            // #endregion
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to create transaction',
                                    error: 'Failed to create transaction',
                                }];
                        }
                        if (!!wallet.encrypted_wallet_secret) return [3 /*break*/, 18];
                        oldBalance = 0;
                        _k.label = 12;
                    case 12:
                        _k.trys.push([12, 14, , 15]);
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getBalance(wallet.xrpl_address)];
                    case 13:
                        oldBalance = _k.sent();
                        return [3 /*break*/, 15];
                    case 14:
                        error_16 = _k.sent();
                        // If account not found, balance is 0
                        oldBalance = 0;
                        return [3 /*break*/, 15];
                    case 15:
                        // If old address has funds, we cannot migrate (funds would become inaccessible)
                        // Return error explaining the situation
                        if (oldBalance > 0) {
                            // #region agent log
                            // ...existing code...
                            // #endregion
                            return [2 /*return*/, {
                                    success: false,
                                    message: "Cannot process withdrawal: Your wallet address (".concat(wallet.xrpl_address, ") has ").concat(oldBalance, " XRP, but the wallet secret is not available. This wallet was created before automated withdrawals were enabled. Please contact support to recover your funds or manually transfer them to a new wallet."),
                                    error: 'Wallet secret not available and old address has funds',
                                }];
                        }
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.generateWallet()];
                    case 16:
                        _b = _k.sent(), newXrplAddress = _b.address, newWalletSecret = _b.secret;
                        encryptedSecret = encryption_service_1.encryptionService.encrypt(newWalletSecret);
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                xrpl_address: newXrplAddress,
                                encrypted_wallet_secret: encryptedSecret,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', wallet.id)
                                .select()
                                .single()];
                    case 17:
                        _c = _k.sent(), updatedWallet = _c.data, updateError = _c.error;
                        if (updateError || !updatedWallet) {
                            // #region agent log
                            // ...existing code...
                            // #endregion
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to migrate wallet. Please contact support.',
                                    error: 'Wallet migration failed',
                                }];
                        }
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        // Update wallet reference to use the new wallet
                        wallet = updatedWallet;
                        _k.label = 18;
                    case 18:
                        walletSecret = void 0;
                        try {
                            walletSecret = encryption_service_1.encryptionService.decrypt(wallet.encrypted_wallet_secret);
                        }
                        catch (error) {
                            console.error('Error decrypting wallet secret:', error);
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to decrypt wallet secret',
                                    error: 'Decryption failed',
                                }];
                        }
                        xrplTxHash = void 0;
                        _k.label = 19;
                    case 19:
                        _k.trys.push([19, 21, , 23]);
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.createWithdrawalTransaction(wallet.xrpl_address, request.destinationAddress, amountXrp, walletSecret)];
                    case 20:
                        xrplTxHash = _k.sent();
                        return [3 /*break*/, 23];
                    case 21:
                        xrplError_1 = _k.sent();
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                status: 'failed',
                                updated_at: new Date().toISOString(),
                                description: "Withdrawal failed: ".concat(xrplError_1 instanceof Error ? xrplError_1.message : 'Unknown error'),
                            })
                                .eq('id', transaction.id)];
                    case 22:
                        updateResult = _k.sent();
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        return [2 /*return*/, {
                                success: false,
                                message: xrplError_1 instanceof Error ? xrplError_1.message : 'Failed to submit withdrawal to XRPL',
                                error: 'XRPL submission failed',
                            }];
                    case 23: 
                    // Update transaction to completed only after successful XRPL submission
                    // #region agent log
                    // ...existing code...
                    // #endregion
                    // Verify transaction exists before update
                    return [4 /*yield*/, adminClient
                            .from('transactions')
                            .select('id, status, xrpl_tx_hash')
                            .eq('id', transaction.id)
                            .single()];
                    case 24:
                        // Update transaction to completed only after successful XRPL submission
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        // Verify transaction exists before update
                        _k.sent();
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                xrpl_tx_hash: xrplTxHash,
                                status: 'completed',
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', transaction.id)
                                .select()];
                    case 25:
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        _k.sent();
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        // Verify update actually persisted
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('id, status, xrpl_tx_hash')
                                .eq('id', transaction.id)
                                .single()];
                    case 26:
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        // Verify update actually persisted
                        _k.sent();
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(wallet.xrpl_address)];
                    case 27:
                        balances = _k.sent();
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: balances.xrp,
                                balance_usdt: balances.usdt,
                                balance_usdc: balances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', wallet.id)];
                    case 28:
                        _k.sent();
                        _k.label = 29;
                    case 29:
                        _k.trys.push([29, 38, , 39]);
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('user_id')
                                .eq('xrpl_address', request.destinationAddress)
                                .maybeSingle()];
                    case 30:
                        receiverWallet = (_k.sent()).data;
                        if (!(receiverWallet && receiverWallet.user_id !== userId)) return [3 /*break*/, 37];
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .insert({
                                user_id: receiverWallet.user_id,
                                type: 'deposit',
                                amount_xrp: amountXrp,
                                amount_usd: amountUsd,
                                xrpl_tx_hash: xrplTxHash,
                                status: 'completed',
                                description: "Deposit from ".concat(wallet.xrpl_address),
                            })
                                .select()
                                .single()];
                    case 31:
                        receiverTx = (_k.sent()).data;
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(request.destinationAddress)];
                    case 32:
                        receiverBalances = _k.sent();
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: receiverBalances.xrp,
                                balance_usdt: receiverBalances.usdt,
                                balance_usdc: receiverBalances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('user_id', receiverWallet.user_id)];
                    case 33:
                        _k.sent();
                        _k.label = 34;
                    case 34:
                        _k.trys.push([34, 36, , 37]);
                        return [4 /*yield*/, notification_service_1.notificationService.createNotification({
                                userId: receiverWallet.user_id,
                                type: 'wallet_deposit',
                                title: 'Payment received',
                                message: "You received ".concat(amountXrp.toFixed(6), " XRP from ").concat(wallet.xrpl_address, "."),
                                metadata: {
                                    amountXrp: amountXrp,
                                    amountUsd: amountUsd,
                                    xrplTxHash: xrplTxHash,
                                    transactionId: receiverTx === null || receiverTx === void 0 ? void 0 : receiverTx.id,
                                    fromAddress: wallet.xrpl_address,
                                },
                            })];
                    case 35:
                        _k.sent();
                        return [3 /*break*/, 37];
                    case 36:
                        notifyError_4 = _k.sent();
                        console.warn('Failed to create receiver deposit notification:', notifyError_4);
                        return [3 /*break*/, 37];
                    case 37: return [3 /*break*/, 39];
                    case 38:
                        receiverError_1 = _k.sent();
                        // Log but don't fail the withdrawal if receiver transaction creation fails
                        console.warn('[Withdrawal] Failed to create transaction for receiver:', receiverError_1);
                        return [3 /*break*/, 39];
                    case 39: 
                    // #region agent log
                    // ...existing code...
                    // #endregion
                    return [2 /*return*/, {
                            success: true,
                            message: 'Withdrawal completed successfully',
                            data: {
                                transactionId: transaction.id,
                                amount: {
                                    usd: parseFloat(amountUsd.toFixed(2)),
                                    xrp: parseFloat(amountXrp.toFixed(6)),
                                },
                                xrplTxHash: xrplTxHash,
                                status: 'completed',
                            },
                        }];
                    case 40:
                        error_17 = _k.sent();
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        console.error('Error withdrawing from wallet:', error_17);
                        return [2 /*return*/, {
                                success: false,
                                message: error_17 instanceof Error ? error_17.message : 'Failed to withdraw from wallet',
                                error: error_17 instanceof Error ? error_17.message : 'Failed to withdraw from wallet',
                            }];
                    case 41: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Sync pending withdrawal transactions that have xrpl_tx_hash but are still marked as pending
     * This fixes old transactions that were created before the status update fix
     */
    WalletService.prototype.syncPendingWithdrawals = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, pendingWithdrawals, _i, pendingWithdrawals_1, withdrawal, error_18;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 6, , 7]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('*')
                                .eq('user_id', userId)
                                .eq('type', 'withdrawal')
                                .eq('status', 'pending')
                                .not('xrpl_tx_hash', 'is', null)];
                    case 1:
                        pendingWithdrawals = (_a.sent()).data;
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        if (!pendingWithdrawals || pendingWithdrawals.length === 0) {
                            // #region agent log
                            // ...existing code...
                            // #endregion
                            return [2 /*return*/];
                        }
                        _i = 0, pendingWithdrawals_1 = pendingWithdrawals;
                        _a.label = 2;
                    case 2:
                        if (!(_i < pendingWithdrawals_1.length)) return [3 /*break*/, 5];
                        withdrawal = pendingWithdrawals_1[_i];
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .update({
                                status: 'completed',
                                updated_at: new Date().toISOString(),
                            })
                                .eq('id', withdrawal.id)
                                .select()];
                    case 3:
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        error_18 = _a.sent();
                        // Don't throw - this is a background sync
                        console.warn('[Sync] Error syncing pending withdrawals:', error_18);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Sync pending deposit transactions by checking for completed withdrawals
     * This fixes the issue where receivers don't have transaction records for incoming payments
     */
    WalletService.prototype.syncPendingDeposits = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, wallet, withdrawals, _i, withdrawals_1, withdrawal, existingDeposit, Client, xrplNetwork, xrplServer, client, txResponse, txResult, destination, dropsToXrp, amountDrops, amountXrp, amountUsd, exchangeRates, usdRate, balances, txError_1, error_19;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 23, , 24]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .select('xrpl_address')
                                .eq('user_id', userId)
                                .single()];
                    case 1:
                        wallet = (_b.sent()).data;
                        if (!wallet)
                            return [2 /*return*/];
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('*')
                                .eq('type', 'withdrawal')
                                .eq('status', 'completed')
                                .not('xrpl_tx_hash', 'is', null)];
                    case 2:
                        withdrawals = (_b.sent()).data;
                        if (!withdrawals || withdrawals.length === 0)
                            return [2 /*return*/];
                        _i = 0, withdrawals_1 = withdrawals;
                        _b.label = 3;
                    case 3:
                        if (!(_i < withdrawals_1.length)) return [3 /*break*/, 22];
                        withdrawal = withdrawals_1[_i];
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('id')
                                .eq('user_id', userId)
                                .eq('xrpl_tx_hash', withdrawal.xrpl_tx_hash)
                                .eq('type', 'deposit')
                                .maybeSingle()];
                    case 4:
                        existingDeposit = (_b.sent()).data;
                        if (existingDeposit)
                            return [3 /*break*/, 21];
                        _b.label = 5;
                    case 5:
                        _b.trys.push([5, 20, , 21]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('xrpl'); })];
                    case 6:
                        Client = (_b.sent()).Client;
                        xrplNetwork = process.env.XRPL_NETWORK || 'testnet';
                        xrplServer = xrplNetwork === 'mainnet'
                            ? 'wss://xrplcluster.com'
                            : 'wss://s.altnet.rippletest.net:51233';
                        client = new Client(xrplServer);
                        return [4 /*yield*/, client.connect()];
                    case 7:
                        _b.sent();
                        _b.label = 8;
                    case 8:
                        _b.trys.push([8, , 17, 19]);
                        return [4 /*yield*/, client.request({
                                command: 'tx',
                                transaction: withdrawal.xrpl_tx_hash,
                            })];
                    case 9:
                        txResponse = _b.sent();
                        txResult = txResponse.result;
                        destination = txResult.Destination;
                        if (!(destination === wallet.xrpl_address && txResult.TransactionType === 'Payment')) return [3 /*break*/, 16];
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('xrpl'); })];
                    case 10:
                        dropsToXrp = (_b.sent()).dropsToXrp;
                        amountDrops = txResult.Amount;
                        amountXrp = parseFloat(dropsToXrp(String(amountDrops)));
                        amountUsd = withdrawal.amount_usd;
                        if (!(amountXrp !== withdrawal.amount_xrp)) return [3 /*break*/, 12];
                        return [4 /*yield*/, exchange_service_1.exchangeService.getLiveExchangeRates()];
                    case 11:
                        exchangeRates = _b.sent();
                        if (exchangeRates.success && exchangeRates.data) {
                            usdRate = (_a = exchangeRates.data.rates.find(function (r) { return r.currency === 'USD'; })) === null || _a === void 0 ? void 0 : _a.rate;
                            if (usdRate && usdRate > 0) {
                                amountUsd = amountXrp * usdRate;
                            }
                        }
                        _b.label = 12;
                    case 12: 
                    // Create deposit transaction for this user
                    return [4 /*yield*/, adminClient
                            .from('transactions')
                            .insert({
                            user_id: userId,
                            type: 'deposit',
                            amount_xrp: amountXrp,
                            amount_usd: amountUsd,
                            xrpl_tx_hash: withdrawal.xrpl_tx_hash,
                            status: 'completed',
                            description: "Deposit from ".concat(txResult.Account),
                        })];
                    case 13:
                        // Create deposit transaction for this user
                        _b.sent();
                        return [4 /*yield*/, xrpl_wallet_service_1.xrplWalletService.getAllBalances(wallet.xrpl_address)];
                    case 14:
                        balances = _b.sent();
                        return [4 /*yield*/, adminClient
                                .from('wallets')
                                .update({
                                balance_xrp: balances.xrp,
                                balance_usdt: balances.usdt,
                                balance_usdc: balances.usdc,
                                updated_at: new Date().toISOString(),
                            })
                                .eq('user_id', userId)];
                    case 15:
                        _b.sent();
                        _b.label = 16;
                    case 16: return [3 /*break*/, 19];
                    case 17: return [4 /*yield*/, client.disconnect()];
                    case 18:
                        _b.sent();
                        return [7 /*endfinally*/];
                    case 19: return [3 /*break*/, 21];
                    case 20:
                        txError_1 = _b.sent();
                        // Skip if transaction not found or other error
                        console.warn("[Sync] Could not fetch XRPL transaction ".concat(withdrawal.xrpl_tx_hash, ":"), txError_1);
                        return [3 /*break*/, 21];
                    case 21:
                        _i++;
                        return [3 /*break*/, 3];
                    case 22: return [3 /*break*/, 24];
                    case 23:
                        error_19 = _b.sent();
                        // Don't throw - this is a background sync, shouldn't break the main flow
                        console.warn('[Sync] Error syncing pending deposits:', error_19);
                        return [3 /*break*/, 24];
                    case 24: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get wallet transactions
     */
    WalletService.prototype.getTransactions = function (userId_1) {
        return __awaiter(this, arguments, void 0, function (userId, limit, offset) {
            var adminClient, _a, transactions, txError, count, formattedTransactions, error_20;
            if (limit === void 0) { limit = 50; }
            if (offset === void 0) { offset = 0; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        // #region agent log
                        // ...existing code...
                        // #endregion
                        // Sync pending transactions in the background (don't wait for it)
                        this.syncPendingWithdrawals(userId).catch(function () { });
                        this.syncPendingDeposits(userId).catch(function () { });
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('*')
                                .eq('user_id', userId)
                                .order('created_at', { ascending: false })
                                .range(offset, offset + limit - 1)];
                    case 1:
                        _a = _b.sent(), transactions = _a.data, txError = _a.error;
                        return [4 /*yield*/, adminClient
                                .from('transactions')
                                .select('*', { count: 'exact', head: true })
                                .eq('user_id', userId)];
                    case 2:
                        count = (_b.sent()).count;
                        if (txError) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch transactions',
                                    error: 'Failed to fetch transactions',
                                }];
                        }
                        formattedTransactions = (transactions || []).map(function (tx) { return ({
                            id: tx.id,
                            type: tx.type,
                            amount: {
                                usd: parseFloat(tx.amount_usd),
                                xrp: parseFloat(tx.amount_xrp),
                            },
                            status: tx.status,
                            xrplTxHash: tx.xrpl_tx_hash || undefined,
                            description: tx.description || undefined,
                            createdAt: tx.created_at,
                        }); });
                        return [2 /*return*/, {
                                success: true,
                                message: 'Transactions retrieved successfully',
                                data: {
                                    transactions: formattedTransactions,
                                    total: count || 0,
                                },
                            }];
                    case 3:
                        error_20 = _b.sent();
                        console.error('Error getting transactions:', error_20);
                        return [2 /*return*/, {
                                success: false,
                                message: error_20 instanceof Error ? error_20.message : 'Failed to get transactions',
                                error: error_20 instanceof Error ? error_20.message : 'Failed to get transactions',
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return WalletService;
}());
exports.WalletService = WalletService;
exports.walletService = new WalletService();
