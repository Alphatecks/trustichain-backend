"use strict";
/**
 * XRPL Escrow Service
 * Handles XRPL escrow operations (EscrowCreate, EscrowFinish, EscrowCancel)
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
exports.xrplEscrowService = exports.XRPLEscrowService = void 0;
var xrpl_1 = require("xrpl");
var XRPLEscrowService = /** @class */ (function () {
    function XRPLEscrowService() {
        this.XRPL_NETWORK = process.env.XRPL_NETWORK || 'testnet';
        this.XRPL_SERVER = this.XRPL_NETWORK === 'mainnet'
            ? 'wss://xrplcluster.com'
            : 'wss://s.altnet.rippletest.net:51233';
    }
    /**
     * Create an escrow on XRPL
     * Note: Requires wallet secret key - in production, handle securely
     */
    XRPLEscrowService.prototype.createEscrow = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var client, logDataC, fs, path, logPath, trimmedSecret, wallet, logSuccess, fs, path, logPath, logError, fs, path, logPath, escrowCreate, prepared, signed, result, realTxHash, error_1, error_2;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            return __generator(this, function (_l) {
                switch (_l.label) {
                    case 0:
                        _l.trys.push([0, 9, , 10]);
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-escrow.service.ts:27', message: 'createEscrow: Entry', data: { fromAddress: params.fromAddress, toAddress: params.toAddress, amountXrp: params.amountXrp, hasWalletSecret: !!params.walletSecret, network: this.XRPL_NETWORK }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(function () { });
                        // #endregion
                        if (!params.walletSecret) {
                            // In all environments, a real wallet secret is required.
                            // User-facing escrows should use the XUMM-based user-signed EscrowCreate flow instead.
                            throw new Error('Wallet secret required for XRPL EscrowCreate. ' +
                                'For user escrows, use prepareEscrowCreateTransaction + XUMM instead of createEscrow().');
                        }
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        return [4 /*yield*/, client.connect()];
                    case 1:
                        _l.sent();
                        _l.label = 2;
                    case 2:
                        _l.trys.push([2, 6, , 8]);
                        logDataC = { location: 'xrpl-escrow.service.ts:43', message: 'createEscrow: About to call Wallet.fromSeed', data: { secretLength: (_a = params.walletSecret) === null || _a === void 0 ? void 0 : _a.length, secretFirst5: (_b = params.walletSecret) === null || _b === void 0 ? void 0 : _b.substring(0, 5), secretLast5: (_c = params.walletSecret) === null || _c === void 0 ? void 0 : _c.substring(params.walletSecret.length - 5), secretTrimmedLength: (_d = params.walletSecret) === null || _d === void 0 ? void 0 : _d.trim().length, hasWhitespace: /\s/.test(params.walletSecret), secretCharCodes: (_e = params.walletSecret) === null || _e === void 0 ? void 0 : _e.substring(0, 10).split('').map(function (c) { return c.charCodeAt(0); }) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' };
                        console.log('[DEBUG]', JSON.stringify(logDataC));
                        console.error('[DEBUG]', JSON.stringify(logDataC)); // Also log to stderr
                        try {
                            fs = require('fs');
                            path = require('path');
                            logPath = path.join(process.cwd(), 'debug.log');
                            fs.appendFileSync(logPath, JSON.stringify(logDataC) + '\n');
                        }
                        catch (e) { }
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logDataC) }).catch(function () { });
                        trimmedSecret = params.walletSecret.trim();
                        wallet = void 0;
                        try {
                            wallet = xrpl_1.Wallet.fromSeed(trimmedSecret);
                            logSuccess = { location: 'xrpl-escrow.service.ts:48', message: 'createEscrow: Wallet.fromSeed succeeded', data: { walletAddress: wallet.address }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' };
                            console.log('[DEBUG]', JSON.stringify(logSuccess));
                            console.error('[DEBUG]', JSON.stringify(logSuccess)); // Also log to stderr
                            try {
                                fs = require('fs');
                                path = require('path');
                                logPath = path.join(process.cwd(), 'debug.log');
                                fs.appendFileSync(logPath, JSON.stringify(logSuccess) + '\n');
                            }
                            catch (e) { }
                            fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(logSuccess) }).catch(function () { });
                            // #endregion
                        }
                        catch (seedError) {
                            logError = { location: 'xrpl-escrow.service.ts:52', message: 'createEscrow: Wallet.fromSeed failed', data: { errorMessage: seedError instanceof Error ? seedError.message : String(seedError), errorName: seedError instanceof Error ? seedError.name : 'Unknown', secretLength: (_f = params.walletSecret) === null || _f === void 0 ? void 0 : _f.length, trimmedLength: trimmedSecret.length, secretFirst10: (_g = params.walletSecret) === null || _g === void 0 ? void 0 : _g.substring(0, 10), secretLast10: (_h = params.walletSecret) === null || _h === void 0 ? void 0 : _h.substring(params.walletSecret.length - 10), trimmedFirst10: trimmedSecret.substring(0, 10), trimmedLast10: trimmedSecret.substring(trimmedSecret.length - 10), secretCharCodes: (_j = params.walletSecret) === null || _j === void 0 ? void 0 : _j.substring(0, 15).split('').map(function (c) { return c.charCodeAt(0); }) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' };
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
                            throw seedError;
                        }
                        escrowCreate = {
                            TransactionType: 'EscrowCreate',
                            Account: params.fromAddress,
                            Destination: params.toAddress,
                            Amount: (0, xrpl_1.xrpToDrops)(params.amountXrp.toString()),
                        };
                        if (params.finishAfter) {
                            escrowCreate.FinishAfter = params.finishAfter;
                        }
                        if (params.cancelAfter) {
                            escrowCreate.CancelAfter = params.cancelAfter;
                        }
                        if (params.condition) {
                            escrowCreate.Condition = params.condition;
                        }
                        return [4 /*yield*/, client.autofill(escrowCreate)];
                    case 3:
                        prepared = _l.sent();
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-escrow.service.ts:63', message: 'createEscrow: Transaction prepared, about to sign', data: { fromAddress: params.fromAddress, toAddress: params.toAddress, amountXrp: params.amountXrp }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(function () { });
                        signed = wallet.sign(prepared);
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-escrow.service.ts:66', message: 'createEscrow: Transaction signed, about to submit', data: { txBlobLength: (_k = signed.tx_blob) === null || _k === void 0 ? void 0 : _k.length }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E' }) }).catch(function () { });
                        return [4 /*yield*/, client.submitAndWait(signed.tx_blob)];
                    case 4:
                        result = _l.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 5:
                        _l.sent();
                        realTxHash = result.result.hash;
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-escrow.service.ts:66', message: 'createEscrow: Real XRPL transaction submitted', data: { txHash: realTxHash, isPlaceholder: false, network: this.XRPL_NETWORK, sequence: result.result.Sequence }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(function () { });
                        // #endregion
                        return [2 /*return*/, realTxHash];
                    case 6:
                        error_1 = _l.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 7:
                        _l.sent();
                        throw error_1;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_2 = _l.sent();
                        console.error('Error creating XRPL escrow:', error_2);
                        throw error_2;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Finish (release) an escrow
     * Note: This requires wallet secret for signing. In production, handle securely.
     * For user-signed transactions, use prepareEscrowFinishTransaction instead.
     */
    XRPLEscrowService.prototype.finishEscrow = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var client, wallet, escrowFinish, prepared, signed, result, txHash, txResult, error_3, error_4;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 9, , 10]);
                        if (!params.walletSecret) {
                            throw new Error('Wallet secret required to finish escrow. ' +
                                'For user-signed transactions, use prepareEscrowFinishTransaction instead.');
                        }
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        return [4 /*yield*/, client.connect()];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 6, , 8]);
                        wallet = xrpl_1.Wallet.fromSeed(params.walletSecret);
                        // Verify wallet address matches owner
                        if (wallet.address !== params.ownerAddress) {
                            throw new Error("Wallet address ".concat(wallet.address, " does not match owner address ").concat(params.ownerAddress));
                        }
                        escrowFinish = {
                            TransactionType: 'EscrowFinish',
                            Account: params.ownerAddress,
                            Owner: params.ownerAddress,
                            OfferSequence: params.escrowSequence,
                        };
                        // Add condition and fulfillment if provided
                        if (params.condition) {
                            escrowFinish.Condition = params.condition;
                        }
                        if (params.fulfillment) {
                            escrowFinish.Fulfillment = params.fulfillment;
                        }
                        console.log('[XRPL] Preparing EscrowFinish transaction:', {
                            ownerAddress: params.ownerAddress,
                            escrowSequence: params.escrowSequence,
                            escrowSequenceType: typeof params.escrowSequence,
                            hasCondition: !!params.condition,
                            hasFulfillment: !!params.fulfillment,
                        });
                        console.log('[XRPL] EscrowFinish transaction before autofill:', JSON.stringify(escrowFinish, null, 2));
                        return [4 /*yield*/, client.autofill(escrowFinish)];
                    case 3:
                        prepared = _b.sent();
                        console.log('[XRPL] EscrowFinish transaction after autofill:', JSON.stringify(prepared, null, 2));
                        signed = wallet.sign(prepared);
                        return [4 /*yield*/, client.submitAndWait(signed.tx_blob)];
                    case 4:
                        result = _b.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 5:
                        _b.sent();
                        txHash = result.result.hash;
                        txResult = (_a = result.result.meta) === null || _a === void 0 ? void 0 : _a.TransactionResult;
                        console.log('[XRPL] EscrowFinish transaction submitted:', {
                            txHash: txHash,
                            txResult: txResult,
                            escrowSequence: params.escrowSequence,
                        });
                        if (txResult !== 'tesSUCCESS') {
                            throw new Error("EscrowFinish transaction failed with result: ".concat(txResult, ". ") +
                                "Transaction hash: ".concat(txHash));
                        }
                        return [2 /*return*/, txHash];
                    case 6:
                        error_3 = _b.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 7:
                        _b.sent();
                        throw error_3;
                    case 8: return [3 /*break*/, 10];
                    case 9:
                        error_4 = _b.sent();
                        console.error('[XRPL] Error finishing escrow:', error_4);
                        throw error_4;
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Prepare an unsigned EscrowCreate transaction for user signing
     * Returns transaction object that can be sent to XUMM/MetaMask for signing
     */
    XRPLEscrowService.prototype.prepareEscrowCreateTransaction = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var escrowCreate, txBlob;
            return __generator(this, function (_a) {
                try {
                    escrowCreate = {
                        TransactionType: 'EscrowCreate',
                        Account: params.fromAddress,
                        Destination: params.toAddress,
                        Amount: (0, xrpl_1.xrpToDrops)(params.amountXrp.toString()),
                    };
                    if (params.finishAfter) {
                        escrowCreate.FinishAfter = params.finishAfter;
                    }
                    if (params.cancelAfter) {
                        escrowCreate.CancelAfter = params.cancelAfter;
                    }
                    if (params.condition) {
                        escrowCreate.Condition = params.condition;
                    }
                    txBlob = JSON.stringify(escrowCreate);
                    return [2 /*return*/, {
                            transaction: escrowCreate,
                            transactionBlob: txBlob,
                            instructions: "Please sign this EscrowCreate transaction in your XRPL wallet to create escrow for ".concat(params.amountXrp, " XRP to ").concat(params.toAddress),
                        }];
                }
                catch (error) {
                    console.error('Error preparing EscrowCreate transaction:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Prepare an unsigned EscrowFinish transaction for user signing
     * Returns transaction object that can be sent to XUMM/MetaMask for signing
     */
    XRPLEscrowService.prototype.prepareEscrowFinishTransaction = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var escrowFinish, txBlob;
            return __generator(this, function (_a) {
                try {
                    escrowFinish = {
                        TransactionType: 'EscrowFinish',
                        Account: params.ownerAddress,
                        Owner: params.ownerAddress,
                        OfferSequence: params.escrowSequence,
                    };
                    if (params.condition) {
                        escrowFinish.Condition = params.condition;
                    }
                    if (params.fulfillment) {
                        escrowFinish.Fulfillment = params.fulfillment;
                    }
                    txBlob = JSON.stringify(escrowFinish);
                    return [2 /*return*/, {
                            transaction: escrowFinish,
                            transactionBlob: txBlob,
                            instructions: "Please sign this EscrowFinish transaction in your XRPL wallet to release escrow sequence ".concat(params.escrowSequence),
                        }];
                }
                catch (error) {
                    console.error('Error preparing EscrowFinish transaction:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Cancel an escrow
     */
    XRPLEscrowService.prototype.cancelEscrow = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var txHash;
            return __generator(this, function (_a) {
                try {
                    txHash = Array.from({ length: 64 }, function () {
                        return Math.floor(Math.random() * 16).toString(16);
                    }).join('');
                    console.log("[XRPL] Cancelling escrow: sequence ".concat(params.escrowSequence));
                    return [2 /*return*/, txHash];
                }
                catch (error) {
                    console.error('Error cancelling XRPL escrow:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get escrow details from XRPL by transaction hash
     * Returns escrow sequence number and details needed for EscrowFinish
     */
    XRPLEscrowService.prototype.getEscrowDetailsByTxHash = function (txHash, ownerAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var client, txResponse, requestError_1, errorData, errorCode, txResponseAny, txResult, escrowSequence_1, accountObjectsResponse, escrowObjects, escrowObject, accountTxResponse, transactions, relatedTx, tx, txType, historyError_1, escrowAmount, amountDropsStr, amount, error_5, error_6;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 17, , 18]);
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-escrow.service.ts:253', message: 'getEscrowDetailsByTxHash: Entry', data: { txHash: txHash, txHashLength: txHash.length, ownerAddress: ownerAddress, network: this.XRPL_NETWORK, isValidFormat: /^[a-f0-9]{64}$/i.test(txHash) }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        return [4 /*yield*/, client.connect()];
                    case 1:
                        _d.sent();
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 13, 14, 16]);
                        txResponse = void 0;
                        _d.label = 3;
                    case 3:
                        _d.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, client.request({
                                command: 'tx',
                                transaction: txHash,
                            })];
                    case 4:
                        txResponse = _d.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        requestError_1 = _d.sent();
                        errorData = requestError_1 === null || requestError_1 === void 0 ? void 0 : requestError_1.data;
                        errorCode = errorData === null || errorData === void 0 ? void 0 : errorData.error;
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-escrow.service.ts:txCatch', message: 'getEscrowDetailsByTxHash: tx query threw error', data: { txHash: txHash, error: errorCode, errorData: errorData, network: this.XRPL_NETWORK }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(function () { });
                        // #endregion
                        // Handle common "txnNotFound" error gracefully by letting caller
                        // fall back to alternative lookup strategies (e.g., account_objects).
                        if (errorCode === 'txnNotFound') {
                            console.error('[XRPL] Transaction not found (txnNotFound):', txHash);
                            return [2 /*return*/, null];
                        }
                        // For other errors, rethrow so callers can handle appropriately
                        throw requestError_1;
                    case 6:
                        txResponseAny = txResponse;
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-escrow.service.ts:264', message: 'getEscrowDetailsByTxHash: XRPL tx query response', data: { txHash: txHash, hasResult: !!(txResponseAny === null || txResponseAny === void 0 ? void 0 : txResponseAny.result), error: (_a = txResponseAny === null || txResponseAny === void 0 ? void 0 : txResponseAny.result) === null || _a === void 0 ? void 0 : _a.error, errorCode: (_b = txResponseAny === null || txResponseAny === void 0 ? void 0 : txResponseAny.result) === null || _b === void 0 ? void 0 : _b.error_code, errorMessage: (_c = txResponseAny === null || txResponseAny === void 0 ? void 0 : txResponseAny.result) === null || _c === void 0 ? void 0 : _c.error_message, network: this.XRPL_NETWORK }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(function () { });
                        // #endregion
                        if (!txResponse || !txResponse.result) {
                            console.error('[XRPL] Transaction not found:', txHash);
                            // #region agent log
                            fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-escrow.service.ts:266', message: 'getEscrowDetailsByTxHash: Transaction not found - trying fallback', data: { txHash: txHash, network: this.XRPL_NETWORK, reason: 'txResponse or result is null' }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C' }) }).catch(function () { });
                            // #endregion
                            // Cannot proceed without transaction hash - EscrowFinish requires transaction sequence
                            // The escrow object sequence is different from the transaction sequence needed for OfferSequence
                            console.warn('[XRPL] Transaction not found and cannot determine transaction sequence. EscrowFinish requires the transaction sequence from EscrowCreate, which cannot be determined without a valid transaction hash.');
                            return [2 /*return*/, null];
                        }
                        txResult = txResponse.result;
                        escrowSequence_1 = txResult.Sequence;
                        console.log('[XRPL] Transaction details from tx command:', {
                            txHash: txHash,
                            transactionType: txResult.TransactionType,
                            sequence: escrowSequence_1,
                            account: txResult.Account,
                            destination: txResult.Destination,
                            amount: txResult.Amount,
                        });
                        if (!escrowSequence_1) {
                            console.error('[XRPL] No sequence found in transaction:', txHash);
                            return [2 /*return*/, null];
                        }
                        // Verify this is an EscrowCreate transaction
                        if (txResult.TransactionType !== 'EscrowCreate') {
                            console.error('[XRPL] Transaction is not EscrowCreate:', txResult.TransactionType);
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, client.request({
                                command: 'account_objects',
                                account: ownerAddress,
                                type: 'escrow',
                            })];
                    case 7:
                        accountObjectsResponse = _d.sent();
                        escrowObjects = accountObjectsResponse.result.account_objects || [];
                        console.log("[XRPL] Found ".concat(escrowObjects.length, " escrow objects for account ").concat(ownerAddress));
                        escrowObject = escrowObjects.find(function (obj) { return obj.PreviousTxnID === txHash; });
                        if (!!escrowObject) return [3 /*break*/, 12];
                        console.warn('[XRPL] Escrow object not found in account_objects. Available escrows:', escrowObjects.map(function (obj) { return ({
                            PreviousTxnID: obj.PreviousTxnID,
                            Sequence: obj.Sequence,
                            Destination: obj.Destination,
                        }); }));
                        console.warn('[XRPL] Looking for escrow with PreviousTxnID:', txHash);
                        console.warn('[XRPL] Escrow object not found - escrow may have been finished or cancelled');
                        _d.label = 8;
                    case 8:
                        _d.trys.push([8, 10, , 11]);
                        return [4 /*yield*/, client.request({
                                command: 'account_tx',
                                account: ownerAddress,
                                ledger_index_min: -1,
                                ledger_index_max: -1,
                                limit: 100,
                            })];
                    case 9:
                        accountTxResponse = _d.sent();
                        transactions = accountTxResponse.result.transactions || [];
                        relatedTx = transactions.find(function (txData) {
                            var tx = txData.tx || txData;
                            return (tx.TransactionType === 'EscrowFinish' || tx.TransactionType === 'EscrowCancel') &&
                                tx.Owner === ownerAddress &&
                                tx.OfferSequence === escrowSequence_1;
                        });
                        if (relatedTx) {
                            tx = relatedTx.tx || relatedTx;
                            txType = tx.TransactionType;
                            console.warn("[XRPL] Found ".concat(txType, " transaction for this escrow. Escrow was already ").concat(txType === 'EscrowFinish' ? 'finished' : 'cancelled', "."));
                            // Return null but we'll handle this in the calling code with a better error message
                            return [2 /*return*/, null];
                        }
                        return [3 /*break*/, 11];
                    case 10:
                        historyError_1 = _d.sent();
                        console.warn('[XRPL] Could not check transaction history:', historyError_1);
                        return [3 /*break*/, 11];
                    case 11: 
                    // Escrow object doesn't exist and we couldn't verify it was finished - return null
                    // The calling code should handle this with a helpful error message
                    return [2 /*return*/, null];
                    case 12:
                        console.log('[XRPL] Found matching escrow object:', {
                            PreviousTxnID: escrowObject.PreviousTxnID,
                            ObjectSequence: escrowObject.Sequence,
                            TransactionSequence: escrowSequence_1,
                            Destination: escrowObject.Destination,
                            Amount: escrowObject.Amount,
                        });
                        escrowAmount = escrowObject.Amount;
                        amountDropsStr = escrowAmount ? String(escrowAmount) : '0';
                        amount = parseFloat(xrpl_1.dropsToXrp(amountDropsStr));
                        // IMPORTANT: For EscrowFinish, OfferSequence must match the Sequence from the original EscrowCreate transaction
                        // This is the account sequence number from the EscrowCreate transaction, NOT the escrow object sequence
                        // The escrow object has its own sequence, but EscrowFinish requires the transaction sequence
                        return [2 /*return*/, {
                                sequence: escrowSequence_1, // Use transaction sequence (account sequence from EscrowCreate), not escrow object sequence
                                amount: amount,
                                destination: escrowObject.Destination || '',
                                finishAfter: escrowObject.FinishAfter ? escrowObject.FinishAfter : undefined,
                                cancelAfter: escrowObject.CancelAfter ? escrowObject.CancelAfter : undefined,
                                condition: escrowObject.Condition || undefined,
                            }];
                    case 13:
                        error_5 = _d.sent();
                        console.error('[XRPL] Error querying escrow details:', error_5);
                        throw error_5;
                    case 14: return [4 /*yield*/, client.disconnect()];
                    case 15:
                        _d.sent();
                        return [7 /*endfinally*/];
                    case 16: return [3 /*break*/, 18];
                    case 17:
                        error_6 = _d.sent();
                        console.error('Error getting escrow details:', error_6);
                        throw error_6;
                    case 18: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get detailed escrow status from XRPL by transaction hash
     * Returns comprehensive status including whether it's active, finished, or cancelled
     */
    XRPLEscrowService.prototype.getEscrowStatus = function (txHash, ownerAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var client, txResponse, txSequence_1, txError_1, accountObjectsResponse, escrowObjects, escrowObject, escrowAmount, amountDropsStr, amount, finishAfter, cancelAfter, now, canFinish, canCancel, accountTxResponse, transactions, finishTx, cancelTx, txData, tx, date, txData, tx, date, error_7, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 18, , 19]);
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        return [4 /*yield*/, client.connect()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 15, , 17]);
                        txResponse = void 0;
                        txSequence_1 = null;
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 7]);
                        return [4 /*yield*/, client.request({
                                command: 'tx',
                                transaction: txHash,
                            })];
                    case 4:
                        txResponse = _a.sent();
                        if (txResponse.result) {
                            txSequence_1 = txResponse.result.Sequence;
                        }
                        return [3 /*break*/, 7];
                    case 5:
                        txError_1 = _a.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 6:
                        _a.sent();
                        return [2 /*return*/, {
                                exists: false,
                                status: 'unknown',
                                canFinish: false,
                                canCancel: false,
                                error: 'Transaction not found on XRPL',
                            }];
                    case 7: return [4 /*yield*/, client.request({
                            command: 'account_objects',
                            account: ownerAddress,
                            type: 'escrow',
                        })];
                    case 8:
                        accountObjectsResponse = _a.sent();
                        escrowObjects = accountObjectsResponse.result.account_objects || [];
                        escrowObject = escrowObjects.find(function (obj) { return obj.PreviousTxnID === txHash; });
                        if (!escrowObject) return [3 /*break*/, 10];
                        escrowAmount = escrowObject.Amount;
                        amountDropsStr = escrowAmount ? String(escrowAmount) : '0';
                        amount = parseFloat(xrpl_1.dropsToXrp(amountDropsStr));
                        finishAfter = escrowObject.FinishAfter ? escrowObject.FinishAfter : undefined;
                        cancelAfter = escrowObject.CancelAfter ? escrowObject.CancelAfter : undefined;
                        now = Math.floor(Date.now() / 1000);
                        canFinish = !finishAfter || finishAfter <= now;
                        canCancel = cancelAfter ? cancelAfter <= now : false;
                        return [4 /*yield*/, client.disconnect()];
                    case 9:
                        _a.sent();
                        return [2 /*return*/, {
                                exists: true,
                                status: 'active',
                                sequence: txSequence_1 || undefined,
                                amount: amount,
                                destination: escrowObject.Destination || undefined,
                                finishAfter: finishAfter,
                                cancelAfter: cancelAfter,
                                condition: escrowObject.Condition || undefined,
                                canFinish: canFinish,
                                canCancel: canCancel,
                            }];
                    case 10:
                        if (!txSequence_1) return [3 /*break*/, 13];
                        return [4 /*yield*/, client.request({
                                command: 'account_tx',
                                account: ownerAddress,
                                ledger_index_min: -1,
                                ledger_index_max: -1,
                                limit: 200,
                            })];
                    case 11:
                        accountTxResponse = _a.sent();
                        transactions = accountTxResponse.result.transactions || [];
                        finishTx = transactions.find(function (txData) {
                            var tx = txData.tx || txData;
                            return tx.TransactionType === 'EscrowFinish' &&
                                tx.Owner === ownerAddress &&
                                tx.OfferSequence === txSequence_1;
                        });
                        cancelTx = transactions.find(function (txData) {
                            var tx = txData.tx || txData;
                            return tx.TransactionType === 'EscrowCancel' &&
                                tx.Owner === ownerAddress &&
                                tx.OfferSequence === txSequence_1;
                        });
                        return [4 /*yield*/, client.disconnect()];
                    case 12:
                        _a.sent();
                        if (finishTx) {
                            txData = finishTx;
                            tx = txData.tx || txData;
                            date = txData.date || (txData.meta && txData.meta.date) || undefined;
                            return [2 /*return*/, {
                                    exists: false,
                                    status: 'finished',
                                    sequence: txSequence_1,
                                    finishTxHash: tx.hash || txData.hash || undefined,
                                    finishedAt: date,
                                    canFinish: false,
                                    canCancel: false,
                                }];
                        }
                        if (cancelTx) {
                            txData = cancelTx;
                            tx = txData.tx || txData;
                            date = txData.date || (txData.meta && txData.meta.date) || undefined;
                            return [2 /*return*/, {
                                    exists: false,
                                    status: 'cancelled',
                                    sequence: txSequence_1,
                                    cancelTxHash: tx.hash || txData.hash || undefined,
                                    cancelledAt: date,
                                    canFinish: false,
                                    canCancel: false,
                                }];
                        }
                        _a.label = 13;
                    case 13: return [4 /*yield*/, client.disconnect()];
                    case 14:
                        _a.sent();
                        return [2 /*return*/, {
                                exists: false,
                                status: 'unknown',
                                sequence: txSequence_1 || undefined,
                                canFinish: false,
                                canCancel: false,
                                error: 'Escrow object not found, but no finish/cancel transaction found in recent history',
                            }];
                    case 15:
                        error_7 = _a.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 16:
                        _a.sent();
                        throw error_7;
                    case 17: return [3 /*break*/, 19];
                    case 18:
                        error_8 = _a.sent();
                        console.error('[XRPL] Error getting escrow status:', error_8);
                        return [2 /*return*/, {
                                exists: false,
                                status: 'unknown',
                                canFinish: false,
                                canCancel: false,
                                error: error_8 instanceof Error ? error_8.message : 'Unknown error',
                            }];
                    case 19: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get escrow details from XRPL by sequence number
     * Legacy method - prefer getEscrowDetailsByTxHash
     */
    XRPLEscrowService.prototype.getEscrowDetails = function (escrowSequence, ownerAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var client, response, escrowObjects, escrowObject, escrowAmount, amountDrops, amount, error_9, error_10;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 8, , 9]);
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        return [4 /*yield*/, client.connect()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, 5, 7]);
                        return [4 /*yield*/, client.request({
                                command: 'account_objects',
                                account: ownerAddress,
                                type: 'escrow',
                            })];
                    case 3:
                        response = _a.sent();
                        escrowObjects = response.result.account_objects || [];
                        escrowObject = escrowObjects.find(function (obj) { return obj.Sequence === escrowSequence; });
                        if (!escrowObject) {
                            return [2 /*return*/, null];
                        }
                        escrowAmount = escrowObject.Amount;
                        amountDrops = escrowAmount != null ? String(escrowAmount) : '0';
                        amount = parseFloat(xrpl_1.dropsToXrp(amountDrops));
                        return [2 /*return*/, {
                                amount: amount,
                                destination: escrowObject.Destination || '',
                                finishAfter: escrowObject.FinishAfter ? escrowObject.FinishAfter : undefined,
                                cancelAfter: escrowObject.CancelAfter ? escrowObject.CancelAfter : undefined,
                                condition: escrowObject.Condition || undefined,
                            }];
                    case 4:
                        error_9 = _a.sent();
                        console.error('[XRPL] Error querying escrow details:', error_9);
                        throw error_9;
                    case 5: return [4 /*yield*/, client.disconnect()];
                    case 6:
                        _a.sent();
                        return [7 /*endfinally*/];
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        error_10 = _a.sent();
                        console.error('Error getting escrow details:', error_10);
                        return [2 /*return*/, null];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    return XRPLEscrowService;
}());
exports.XRPLEscrowService = XRPLEscrowService;
exports.xrplEscrowService = new XRPLEscrowService();
