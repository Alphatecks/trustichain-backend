"use strict";
/**
 * XRPL Wallet Service
 * Handles XRPL blockchain operations for wallets
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
exports.xrplWalletService = exports.XRPLWalletService = void 0;
var xrpl_1 = require("xrpl");
var transactionValidation_1 = require("../../utils/transactionValidation");
var XRPLWalletService = /** @class */ (function () {
    function XRPLWalletService() {
        this.XRPL_NETWORK = process.env.XRPL_NETWORK || 'testnet'; // 'testnet' or 'mainnet'
        this.XRPL_SERVER = this.XRPL_NETWORK === 'mainnet'
            ? 'wss://xrplcluster.com'
            : 'wss://s.altnet.rippletest.net:51233';
        // USDT and USDC issuer addresses on XRPL
        // Note: On XRPL, both USDT and USDC use "USD" as the currency code, distinguished by issuer address
        // IMPORTANT: Update these issuer addresses based on actual token issuers on your network
        // For mainnet, verify issuer addresses from official sources (Tether, Circle, etc.)
        // For testnet, use testnet issuer addresses or create test tokens
        this.USDT_ISSUER = this.XRPL_NETWORK === 'mainnet'
            ? 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B' // Tether (USDT) on mainnet - UPDATE with actual issuer if different
            : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // Testnet issuer - UPDATE with actual testnet issuer
        this.USDC_ISSUER = this.XRPL_NETWORK === 'mainnet'
            ? 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY' // Circle (USDC) on mainnet - UPDATE with actual Circle issuer address
            : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // Testnet issuer - UPDATE with actual testnet issuer
    }
    /**
     * Get issuer address for a given network
     */
    XRPLWalletService.prototype.getIssuerForNetwork = function (network, token) {
        if (token === 'USDT') {
            return network === 'mainnet'
                ? 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B' // Tether (USDT) on mainnet
                : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // Testnet issuer
        }
        else {
            return network === 'mainnet'
                ? 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY' // Circle (USDC) on mainnet
                : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // Testnet issuer
        }
    };
    /**
     * Generate a new XRPL address
     */
    XRPLWalletService.prototype.generateAddress = function () {
        return __awaiter(this, void 0, void 0, function () {
            var wallet;
            return __generator(this, function (_a) {
                try {
                    wallet = xrpl_1.Wallet.generate();
                    return [2 /*return*/, wallet.address];
                }
                catch (error) {
                    console.error('Error generating XRPL address:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Generate a new XRPL wallet (address + secret)
     * Returns both address and secret for storage
     */
    XRPLWalletService.prototype.generateWallet = function () {
        return __awaiter(this, void 0, void 0, function () {
            var wallet, secret;
            return __generator(this, function (_a) {
                try {
                    wallet = xrpl_1.Wallet.generate();
                    secret = wallet.seed || wallet.classicAddress || '';
                    if (!secret) {
                        throw new Error('Failed to extract wallet secret');
                    }
                    return [2 /*return*/, {
                            address: wallet.address,
                            secret: secret,
                        }];
                }
                catch (error) {
                    console.error('Error generating XRPL wallet:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Get XRP balance for an XRPL address
     */
    XRPLWalletService.prototype.getBalance = function (xrplAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var client, accountInfo, balanceDrops, dropsStr, balance, error_1, errorData, errorObj, errorDetails, isAccountNotFound, otherNetwork, otherServer, otherClient, otherAccountInfo, otherBalanceDrops, otherBalance, otherError_1, checkError_1, error_2, errorData, errorObj, errorDetails, isAccountNotFound;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            return __generator(this, function (_p) {
                switch (_p.label) {
                    case 0:
                        _p.trys.push([0, 19, , 20]);
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:73', message: 'getBalance: Entry', data: { xrplAddress: xrplAddress }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(function () { });
                        // #endregion
                        // Log network and address for debugging funded account issues
                        console.log('[DEBUG] getBalance: Querying XRPL', {
                            network: this.XRPL_NETWORK,
                            server: this.XRPL_SERVER,
                            address: xrplAddress,
                            note: 'If user funded but account not found, check network mismatch (testnet vs mainnet)',
                        });
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        return [4 /*yield*/, client.connect()];
                    case 1:
                        _p.sent();
                        _p.label = 2;
                    case 2:
                        _p.trys.push([2, 5, , 18]);
                        return [4 /*yield*/, client.request({
                                command: 'account_info',
                                account: xrplAddress,
                                ledger_index: 'validated',
                            })];
                    case 3:
                        accountInfo = _p.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 4:
                        _p.sent();
                        balanceDrops = accountInfo.result.account_data.Balance;
                        dropsStr = String(balanceDrops);
                        balance = (0, xrpl_1.dropsToXrp)(dropsStr);
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:93', message: 'getBalance: Success', data: { xrplAddress: xrplAddress, balance: balance }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(function () { });
                        // #endregion
                        return [2 /*return*/, balance];
                    case 5:
                        error_1 = _p.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 6:
                        _p.sent();
                        errorData = error_1 instanceof Error ? { message: error_1.message, stack: error_1.stack } : { error: String(error_1) };
                        errorObj = error_1;
                        errorDetails = { errorData: errorData, hasData: !!(errorObj === null || errorObj === void 0 ? void 0 : errorObj.data), dataError: (_a = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _a === void 0 ? void 0 : _a.error, dataErrorCode: (_b = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _b === void 0 ? void 0 : _b.error_code, dataErrorMessage: (_c = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _c === void 0 ? void 0 : _c.error_message };
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:96', message: 'getBalance: Inner catch', data: { xrplAddress: xrplAddress, errorDetails: errorDetails }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(function () { });
                        isAccountNotFound = (error_1 instanceof Error && (error_1.message.includes('actNotFound') || error_1.message.includes('Account not found'))) ||
                            ((_d = error_1 === null || error_1 === void 0 ? void 0 : error_1.data) === null || _d === void 0 ? void 0 : _d.error) === 'actNotFound' ||
                            (((_e = error_1 === null || error_1 === void 0 ? void 0 : error_1.data) === null || _e === void 0 ? void 0 : _e.error_message) === 'accountNotFound' || ((_f = error_1 === null || error_1 === void 0 ? void 0 : error_1.data) === null || _f === void 0 ? void 0 : _f.error_message) === 'Account not found.') ||
                            ((_g = error_1 === null || error_1 === void 0 ? void 0 : error_1.data) === null || _g === void 0 ? void 0 : _g.error_code) === 19;
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:103', message: 'getBalance: Checking accountNotFound', data: { xrplAddress: xrplAddress, isAccountNotFound: isAccountNotFound }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(function () { });
                        if (!isAccountNotFound) return [3 /*break*/, 17];
                        otherNetwork = this.XRPL_NETWORK === 'mainnet' ? 'testnet' : 'mainnet';
                        otherServer = otherNetwork === 'mainnet'
                            ? 'wss://xrplcluster.com'
                            : 'wss://s.altnet.rippletest.net:51233';
                        console.log('[WARNING] Account not found on configured network, checking other network', {
                            configuredNetwork: this.XRPL_NETWORK,
                            checkingNetwork: otherNetwork,
                            address: xrplAddress,
                        });
                        _p.label = 7;
                    case 7:
                        _p.trys.push([7, 15, , 16]);
                        otherClient = new xrpl_1.Client(otherServer);
                        return [4 /*yield*/, otherClient.connect()];
                    case 8:
                        _p.sent();
                        _p.label = 9;
                    case 9:
                        _p.trys.push([9, 12, , 14]);
                        return [4 /*yield*/, otherClient.request({
                                command: 'account_info',
                                account: xrplAddress,
                                ledger_index: 'validated',
                            })];
                    case 10:
                        otherAccountInfo = _p.sent();
                        return [4 /*yield*/, otherClient.disconnect()];
                    case 11:
                        _p.sent();
                        otherBalanceDrops = otherAccountInfo.result.account_data.Balance;
                        otherBalance = (0, xrpl_1.dropsToXrp)(String(otherBalanceDrops));
                        console.log('[CRITICAL] Network mismatch detected!', {
                            address: xrplAddress,
                            configuredNetwork: this.XRPL_NETWORK,
                            actualNetwork: otherNetwork,
                            balance: otherBalance,
                            action: "Set XRPL_NETWORK=".concat(otherNetwork, " in environment variables to fix this permanently"),
                            note: 'Returning balance from correct network, but please update environment variable',
                        });
                        // Return the balance from the correct network so user sees their funds
                        // But log the mismatch so it can be fixed
                        return [2 /*return*/, otherBalance];
                    case 12:
                        otherError_1 = _p.sent();
                        return [4 /*yield*/, otherClient.disconnect()];
                    case 13:
                        _p.sent();
                        // Account not found on either network
                        console.log('[INFO] Account not found on either network', {
                            address: xrplAddress,
                            testnet: this.XRPL_NETWORK === 'testnet' ? 'not found' : 'not checked',
                            mainnet: this.XRPL_NETWORK === 'mainnet' ? 'not found' : 'not found',
                            note: 'This is expected for new wallets that haven\'t been funded yet',
                        });
                        return [3 /*break*/, 14];
                    case 14: return [3 /*break*/, 16];
                    case 15:
                        checkError_1 = _p.sent();
                        console.log('[DEBUG] Could not check other network', {
                            address: xrplAddress,
                            error: checkError_1 instanceof Error ? checkError_1.message : String(checkError_1),
                        });
                        return [3 /*break*/, 16];
                    case 16: 
                    // Account doesn't exist yet - this is expected for new wallets, return 0 silently
                    return [2 /*return*/, 0];
                    case 17:
                        // Log error details for Render debugging only for unexpected errors
                        console.log('[DEBUG] getBalance inner catch (unexpected error):', {
                            xrplAddress: xrplAddress,
                            errorMessage: error_1 instanceof Error ? error_1.message : String(error_1),
                            errorData: errorObj === null || errorObj === void 0 ? void 0 : errorObj.data,
                        });
                        throw error_1;
                    case 18: return [3 /*break*/, 20];
                    case 19:
                        error_2 = _p.sent();
                        errorData = error_2 instanceof Error ? { message: error_2.message, stack: error_2.stack } : { error: String(error_2) };
                        errorObj = error_2;
                        errorDetails = { errorData: errorData, hasData: !!(errorObj === null || errorObj === void 0 ? void 0 : errorObj.data), dataError: (_h = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _h === void 0 ? void 0 : _h.error, dataErrorCode: (_j = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _j === void 0 ? void 0 : _j.error_code, dataErrorMessage: (_k = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _k === void 0 ? void 0 : _k.error_message };
                        isAccountNotFound = (error_2 instanceof Error && error_2.message.includes('actNotFound')) ||
                            ((_l = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _l === void 0 ? void 0 : _l.error) === 'actNotFound' ||
                            ((_m = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _m === void 0 ? void 0 : _m.error_message) === 'accountNotFound' ||
                            ((_o = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _o === void 0 ? void 0 : _o.error_code) === 19;
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:110', message: 'getBalance: Outer catch', data: { xrplAddress: xrplAddress, errorDetails: errorDetails, isAccountNotFound: isAccountNotFound }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(function () { });
                        // #endregion
                        // Only log if it's not an expected account not found error
                        if (!isAccountNotFound) {
                            console.error('Error getting XRPL balance:', error_2);
                            console.log('[DEBUG] getBalance outer catch (unexpected error):', {
                                xrplAddress: xrplAddress,
                                errorMessage: error_2 instanceof Error ? error_2.message : String(error_2),
                                errorData: errorObj === null || errorObj === void 0 ? void 0 : errorObj.data,
                            });
                        }
                        // Account not found errors are expected for new wallets - suppress logging
                        // Fallback to 0 if there's an error
                        return [2 /*return*/, 0];
                    case 20: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Prepare a payment transaction for user signing via Xaman/XUMM
     * Returns unsigned transaction that frontend can send to XUMM for signing
     */
    XRPLWalletService.prototype.preparePaymentTransaction = function (destinationAddress, amount, currency) {
        return __awaiter(this, void 0, void 0, function () {
            var paymentTx, issuer, txBlob;
            return __generator(this, function (_a) {
                try {
                    paymentTx = void 0;
                    if (currency === 'XRP') {
                        // XRP Payment
                        paymentTx = {
                            TransactionType: 'Payment',
                            Destination: destinationAddress,
                            Amount: (0, xrpl_1.xrpToDrops)(amount.toString()),
                        };
                    }
                    else {
                        issuer = currency === 'USDT' ? this.USDT_ISSUER : this.USDC_ISSUER;
                        paymentTx = {
                            TransactionType: 'Payment',
                            Destination: destinationAddress,
                            Amount: {
                                currency: 'USD', // XRPL uses 'USD' for both USDT and USDC
                                value: amount.toString(),
                                issuer: issuer,
                            },
                        };
                    }
                    txBlob = JSON.stringify(paymentTx);
                    return [2 /*return*/, {
                            transaction: paymentTx,
                            transactionBlob: txBlob,
                            instructions: "Please sign this transaction in your XRPL wallet to send ".concat(amount, " ").concat(currency, " to ").concat(destinationAddress),
                        }];
                }
                catch (error) {
                    console.error('Error preparing payment transaction:', error);
                    throw error;
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Submit a signed transaction blob
     * Called after user signs the transaction via XUMM, MetaMask, or other wallets
     */
    XRPLWalletService.prototype.submitSignedTransaction = function (signedTxBlob) {
        return __awaiter(this, void 0, void 0, function () {
            var client, txToSubmit, result, error_3, error_4;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 8, , 9]);
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        return [4 /*yield*/, client.connect()];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 5, , 7]);
                        txToSubmit = void 0;
                        // Early validation: Check for common mistakes (UUID/transaction ID)
                        if (typeof signedTxBlob === 'string' && (0, transactionValidation_1.looksLikeTransactionId)(signedTxBlob)) {
                            throw new Error('Invalid transaction format: You appear to be sending a transaction ID (UUID) instead of the signed transaction blob. Please send the actual signed transaction returned by MetaMask/XRPL Snap.');
                        }
                        // Handle different input formats
                        if (typeof signedTxBlob === 'object') {
                            // Already an object (from MetaMask/XRPL Snap)
                            // Check if it's wrapped in a response object (e.g., { tx_blob: "...", signedTransaction: {...} })
                            if ('tx_blob' in signedTxBlob && typeof signedTxBlob.tx_blob === 'string') {
                                // MetaMask/XRPL Snap returns { tx_blob: "hex..." }
                                txToSubmit = signedTxBlob.tx_blob;
                            }
                            else if ('signedTransaction' in signedTxBlob) {
                                // Some wallets wrap it as { signedTransaction: {...} }
                                txToSubmit = signedTxBlob.signedTransaction;
                            }
                            else if ('transaction' in signedTxBlob) {
                                // Some wallets wrap it as { transaction: {...} }
                                txToSubmit = signedTxBlob.transaction;
                            }
                            else {
                                // Direct transaction object
                                txToSubmit = signedTxBlob;
                            }
                        }
                        else if (typeof signedTxBlob === 'string') {
                            // Try to parse as JSON first
                            try {
                                txToSubmit = JSON.parse(signedTxBlob);
                            }
                            catch (_c) {
                                // If parsing fails, check if it's a hex string
                                // Hex strings for XRPL are typically long (1000+ chars)
                                if (signedTxBlob.length > 100 && /^[0-9A-Fa-f]+$/.test(signedTxBlob)) {
                                    // It's a hex string - XRPL client can handle this directly
                                    txToSubmit = signedTxBlob;
                                }
                                else {
                                    // Check if it looks like a transaction ID (UUID)
                                    if ((0, transactionValidation_1.looksLikeTransactionId)(signedTxBlob)) {
                                        throw new Error('Invalid transaction format: You appear to be sending a transaction ID (UUID) instead of the signed transaction blob. Please send the actual signed transaction returned by MetaMask/XRPL Snap (e.g., { tx_blob: "..." } or the signed transaction object).');
                                    }
                                    // Invalid format
                                    throw new Error("Invalid transaction format. Expected a signed transaction from MetaMask/XRPL Snap (hex string 1000+ chars or transaction object). Got: ".concat(signedTxBlob.substring(0, 100), "..."));
                                }
                            }
                        }
                        else {
                            throw new Error("Invalid transaction type: ".concat(typeof signedTxBlob));
                        }
                        // Validate transaction structure
                        if (typeof txToSubmit === 'string') {
                            if (txToSubmit.length < 100) {
                                throw new Error("Transaction hex string appears too short (".concat(txToSubmit.length, " characters). Expected 1000+ characters for a valid XRPL transaction blob."));
                            }
                            // Additional check: if it's a UUID, reject it
                            if ((0, transactionValidation_1.looksLikeTransactionId)(txToSubmit)) {
                                throw new Error('Invalid transaction format: Detected transaction ID (UUID) in hex string. Please send the actual signed transaction blob from MetaMask/XRPL Snap.');
                            }
                        }
                        if (typeof txToSubmit === 'object' && !txToSubmit.TransactionType) {
                            throw new Error('Transaction object missing TransactionType field. Expected a valid XRPL transaction object with TransactionType, Account, and other required fields.');
                        }
                        return [4 /*yield*/, client.submitAndWait(txToSubmit)];
                    case 3:
                        result = _b.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 4:
                        _b.sent();
                        return [2 /*return*/, {
                                hash: result.result.hash,
                                status: ((_a = result.result.meta) === null || _a === void 0 ? void 0 : _a.TransactionResult) || 'unknown',
                                result: result.result,
                            }];
                    case 5:
                        error_3 = _b.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 6:
                        _b.sent();
                        console.error('Error in submitSignedTransaction:', {
                            error: error_3 instanceof Error ? error_3.message : String(error_3),
                            inputType: typeof signedTxBlob,
                            inputPreview: typeof signedTxBlob === 'string'
                                ? signedTxBlob.substring(0, 200)
                                : JSON.stringify(signedTxBlob).substring(0, 200),
                        });
                        throw error_3;
                    case 7: return [3 /*break*/, 9];
                    case 8:
                        error_4 = _b.sent();
                        console.error('Error submitting signed transaction:', error_4);
                        throw error_4;
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a withdrawal transaction
     * Note: Requires wallet secret key - in production, handle securely
     */
    XRPLWalletService.prototype.createWithdrawalTransaction = function (fromAddress, toAddress, amountXrp, walletSecret) {
        return __awaiter(this, void 0, void 0, function () {
            var client, wallet, payment, prepared, signed, result, submitError_1, errorDetails, errorObj, fullErrorDetails, txResult, errorMessage, error_5, disconnectError_1;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            return __generator(this, function (_m) {
                switch (_m.label) {
                    case 0:
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:376', message: 'createWithdrawalTransaction: Entry', data: { fromAddress: fromAddress, toAddress: toAddress, amountXrp: amountXrp, hasSecret: !!walletSecret, network: this.XRPL_NETWORK }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        // #endregion
                        if (!walletSecret) {
                            throw new Error('Wallet secret required for withdrawal');
                        }
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        _m.label = 1;
                    case 1:
                        _m.trys.push([1, 8, 9, 14]);
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:389', message: 'createWithdrawalTransaction: Connecting to XRPL', data: { server: this.XRPL_SERVER, network: this.XRPL_NETWORK }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        // #endregion
                        return [4 /*yield*/, client.connect()];
                    case 2:
                        // #endregion
                        _m.sent();
                        wallet = xrpl_1.Wallet.fromSeed(walletSecret);
                        payment = {
                            TransactionType: 'Payment',
                            Account: fromAddress,
                            Destination: toAddress,
                            Amount: (0, xrpl_1.xrpToDrops)(amountXrp.toString()),
                        };
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:399', message: 'createWithdrawalTransaction: Preparing transaction', data: { fromAddress: fromAddress, toAddress: toAddress, amountXrp: amountXrp }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        return [4 /*yield*/, client.autofill(payment)];
                    case 3:
                        prepared = _m.sent();
                        signed = wallet.sign(prepared);
                        // Validate that destination is different from source
                        if (fromAddress === toAddress) {
                            throw new Error('Cannot withdraw to the same address. Please provide a different destination address.');
                        }
                        // #region agent log
                        console.log('[DEBUG] createWithdrawalTransaction: Submitting to XRPL', { fromAddress: fromAddress, toAddress: toAddress, amountXrp: amountXrp });
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:402', message: 'createWithdrawalTransaction: Submitting to XRPL', data: { fromAddress: fromAddress, toAddress: toAddress, amountXrp: amountXrp }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(function () { });
                        result = void 0;
                        _m.label = 4;
                    case 4:
                        _m.trys.push([4, 6, , 7]);
                        return [4 /*yield*/, Promise.race([
                                client.submitAndWait(signed.tx_blob),
                                new Promise(function (_, reject) {
                                    return setTimeout(function () { return reject(new Error('Transaction submission timeout after 30 seconds')); }, 30000);
                                })
                            ])];
                    case 5:
                        result = (_m.sent());
                        return [3 /*break*/, 7];
                    case 6:
                        submitError_1 = _m.sent();
                        errorDetails = submitError_1 instanceof Error ? { message: submitError_1.message, stack: submitError_1.stack } : { error: String(submitError_1) };
                        errorObj = submitError_1;
                        fullErrorDetails = __assign(__assign({}, errorDetails), { hasData: !!(errorObj === null || errorObj === void 0 ? void 0 : errorObj.data), dataError: (_a = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _a === void 0 ? void 0 : _a.error, dataErrorCode: (_b = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _b === void 0 ? void 0 : _b.error_code, dataErrorMessage: (_c = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _c === void 0 ? void 0 : _c.error_message, dataResult: errorObj === null || errorObj === void 0 ? void 0 : errorObj.result, dataResultCode: (_d = errorObj === null || errorObj === void 0 ? void 0 : errorObj.result) === null || _d === void 0 ? void 0 : _d.engine_result_code, dataResultMessage: (_e = errorObj === null || errorObj === void 0 ? void 0 : errorObj.result) === null || _e === void 0 ? void 0 : _e.engine_result_message });
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:430', message: 'createWithdrawalTransaction: submitAndWait error', data: { fromAddress: fromAddress, toAddress: toAddress, amountXrp: amountXrp, fullErrorDetails: fullErrorDetails }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(function () { });
                        // #endregion
                        console.error('[ERROR] createWithdrawalTransaction: submitAndWait failed', {
                            fromAddress: fromAddress,
                            toAddress: toAddress,
                            amountXrp: amountXrp,
                            error: submitError_1 instanceof Error ? submitError_1.message : String(submitError_1),
                            errorDetails: fullErrorDetails,
                        });
                        throw submitError_1;
                    case 7:
                        // #region agent log
                        console.log('[DEBUG] createWithdrawalTransaction: Got result from XRPL', { hasResult: !!result, hasHash: !!((_f = result === null || result === void 0 ? void 0 : result.result) === null || _f === void 0 ? void 0 : _f.hash), txResult: (_h = (_g = result === null || result === void 0 ? void 0 : result.result) === null || _g === void 0 ? void 0 : _g.meta) === null || _h === void 0 ? void 0 : _h.TransactionResult });
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:410', message: 'createWithdrawalTransaction: Got result from XRPL', data: { hasResult: !!result, hasHash: !!((_j = result === null || result === void 0 ? void 0 : result.result) === null || _j === void 0 ? void 0 : _j.hash), txResult: (_l = (_k = result === null || result === void 0 ? void 0 : result.result) === null || _k === void 0 ? void 0 : _k.meta) === null || _l === void 0 ? void 0 : _l.TransactionResult }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A' }) }).catch(function () { });
                        txResult = typeof result.result.meta === 'object' && result.result.meta !== null
                            ? result.result.meta.TransactionResult
                            : null;
                        if (txResult !== 'tesSUCCESS') {
                            // #region agent log
                            fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:415', message: 'createWithdrawalTransaction: Transaction failed on XRPL', data: { txResult: txResult, fromAddress: fromAddress, toAddress: toAddress, amountXrp: amountXrp }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                            errorMessage = "Transaction failed on XRPL: ".concat(txResult);
                            if (txResult === 'tecUNFUNDED_PAYMENT') {
                                errorMessage = "Insufficient funds. Your account must maintain a 1 XRP reserve, plus transaction fees. The withdrawal amount exceeds your available balance.";
                            }
                            else if (txResult === 'tecNO_DST') {
                                errorMessage = "Destination account does not exist. Please check the destination address.";
                            }
                            else if (txResult === 'tecNO_DST_INSUF_XRP') {
                                errorMessage = "Transaction failed: Destination account would have insufficient XRP. The destination account must have at least 1 XRP after receiving the payment (XRPL base reserve requirement). To send ".concat(amountXrp, " XRP to a new account, you need to send at least 1.0 XRP. If sending to an existing account, ensure it has sufficient balance to meet the reserve after receiving this payment.");
                            }
                            else if (txResult === 'tecDST_TAG_NEEDED') {
                                errorMessage = "Destination tag required for this address. Please include a destination tag.";
                            }
                            else if (txResult === 'tecPATH_DRY') {
                                errorMessage = "No payment path found. Unable to process this payment.";
                            }
                            else if (txResult === 'tecPATH_PARTIAL') {
                                errorMessage = "Partial payment path found. Unable to complete the full payment amount.";
                            }
                            throw new Error(errorMessage);
                        }
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:419', message: 'createWithdrawalTransaction: Success, returning hash', data: { hash: result.result.hash }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        // #endregion
                        return [2 /*return*/, result.result.hash];
                    case 8:
                        error_5 = _m.sent();
                        // #region agent log
                        console.log('[DEBUG] createWithdrawalTransaction: Error caught', { error: error_5 instanceof Error ? error_5.message : String(error_5), fromAddress: fromAddress, toAddress: toAddress, amountXrp: amountXrp });
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:420', message: 'createWithdrawalTransaction: Error caught', data: { error: error_5 instanceof Error ? error_5.message : String(error_5), fromAddress: fromAddress, toAddress: toAddress, amountXrp: amountXrp }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        // #endregion
                        console.error('Error creating withdrawal transaction:', {
                            error: error_5 instanceof Error ? error_5.message : String(error_5),
                            fromAddress: fromAddress,
                            toAddress: toAddress,
                            amountXrp: amountXrp,
                        });
                        // Re-throw error instead of returning placeholder
                        throw error_5;
                    case 9:
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:430', message: 'createWithdrawalTransaction: Disconnecting client', data: {}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D' }) }).catch(function () { });
                        _m.label = 10;
                    case 10:
                        _m.trys.push([10, 12, , 13]);
                        return [4 /*yield*/, client.disconnect()];
                    case 11:
                        _m.sent();
                        return [3 /*break*/, 13];
                    case 12:
                        disconnectError_1 = _m.sent();
                        return [3 /*break*/, 13];
                    case 13: return [7 /*endfinally*/];
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Convert XRP drops to XRP (helper method)
     */
    XRPLWalletService.prototype.convertDropsToXrp = function (drops) {
        var dropsStr = typeof drops === 'number' ? String(drops) : String(drops);
        return (0, xrpl_1.dropsToXrp)(dropsStr);
    };
    /**
     * Convert XRP to drops (helper method)
     */
    XRPLWalletService.prototype.convertXrpToDrops = function (xrp) {
        return (0, xrpl_1.xrpToDrops)(String(xrp));
    };
    /**
     * Get token balance for an XRPL address
     * @param xrplAddress The XRPL address
     * @param currency The currency code (e.g., 'USD', 'USDT', 'USDC')
     * @param issuer The issuer address for the token
     * @returns The token balance as a number
     */
    XRPLWalletService.prototype.getTokenBalance = function (xrplAddress, currency, issuer) {
        return __awaiter(this, void 0, void 0, function () {
            var client, accountLines, lines, trustLine, otherNetwork, otherServer, isUSDT, otherIssuer_1, otherClient, otherAccountLines, otherLines, otherTrustLine, otherBalance, otherError_2, checkError_2, balance, finalBalance, error_6, errorData, errorObj, errorDetails, isAccountNotFound, otherNetwork, otherServer, otherIssuer_2, isUSDT, isUSDC, otherClient, otherAccountLines, lines, trustLine, otherBalance, otherError_3, isOtherAccountNotFound, checkError_3, error_7, errorData, errorObj, errorDetails, isAccountNotFound;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
            return __generator(this, function (_t) {
                switch (_t.label) {
                    case 0:
                        _t.trys.push([0, 32, , 33]);
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:345', message: 'getTokenBalance: Entry', data: { xrplAddress: xrplAddress, currency: currency, issuer: issuer }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        // #endregion
                        // Log network and address for debugging funded account issues
                        console.log('[DEBUG] getTokenBalance: Querying XRPL', {
                            network: this.XRPL_NETWORK,
                            server: this.XRPL_SERVER,
                            address: xrplAddress,
                            currency: currency,
                            issuer: issuer,
                            note: 'If user funded but account not found, check network mismatch (testnet vs mainnet)',
                        });
                        client = new xrpl_1.Client(this.XRPL_SERVER);
                        return [4 /*yield*/, client.connect()];
                    case 1:
                        _t.sent();
                        _t.label = 2;
                    case 2:
                        _t.trys.push([2, 17, , 31]);
                        return [4 /*yield*/, client.request({
                                command: 'account_lines',
                                account: xrplAddress,
                                ledger_index: 'validated',
                            })];
                    case 3:
                        accountLines = _t.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 4:
                        _t.sent();
                        lines = accountLines.result.lines || [];
                        trustLine = lines.find(function (line) {
                            return line.currency === currency && line.account === issuer;
                        });
                        if (!!trustLine) return [3 /*break*/, 16];
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:365', message: 'getTokenBalance: No trust line found on configured network', data: { xrplAddress: xrplAddress, currency: currency, issuer: issuer, linesCount: lines.length, network: this.XRPL_NETWORK }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        if (!(currency === 'USD' && (issuer === this.USDT_ISSUER || issuer === this.USDC_ISSUER))) return [3 /*break*/, 15];
                        otherNetwork = this.XRPL_NETWORK === 'mainnet' ? 'testnet' : 'mainnet';
                        otherServer = otherNetwork === 'mainnet'
                            ? 'wss://xrplcluster.com'
                            : 'wss://s.altnet.rippletest.net:51233';
                        isUSDT = issuer === this.USDT_ISSUER;
                        otherIssuer_1 = isUSDT
                            ? this.getIssuerForNetwork(otherNetwork, 'USDT')
                            : this.getIssuerForNetwork(otherNetwork, 'USDC');
                        console.log('[WARNING] No trust line found on configured network, checking other network for potential mismatch', {
                            configuredNetwork: this.XRPL_NETWORK,
                            checkingNetwork: otherNetwork,
                            address: xrplAddress,
                            currency: currency,
                            configuredIssuer: issuer,
                            otherNetworkIssuer: otherIssuer_1,
                        });
                        _t.label = 5;
                    case 5:
                        _t.trys.push([5, 14, , 15]);
                        otherClient = new xrpl_1.Client(otherServer);
                        return [4 /*yield*/, otherClient.connect()];
                    case 6:
                        _t.sent();
                        _t.label = 7;
                    case 7:
                        _t.trys.push([7, 11, , 13]);
                        // Check if account exists on other network
                        return [4 /*yield*/, otherClient.request({
                                command: 'account_info',
                                account: xrplAddress,
                                ledger_index: 'validated',
                            })];
                    case 8:
                        // Check if account exists on other network
                        _t.sent();
                        return [4 /*yield*/, otherClient.request({
                                command: 'account_lines',
                                account: xrplAddress,
                                ledger_index: 'validated',
                            })];
                    case 9:
                        otherAccountLines = _t.sent();
                        return [4 /*yield*/, otherClient.disconnect()];
                    case 10:
                        _t.sent();
                        otherLines = otherAccountLines.result.lines || [];
                        otherTrustLine = otherLines.find(function (line) {
                            return line.currency === currency && line.account === otherIssuer_1;
                        });
                        if (otherTrustLine) {
                            otherBalance = Math.max(0, parseFloat(otherTrustLine.balance || '0'));
                            console.log('[CRITICAL] Network mismatch detected (token balance)! Account exists on both networks, using other network balance', {
                                address: xrplAddress,
                                currency: currency,
                                configuredIssuer: issuer,
                                actualIssuer: otherIssuer_1,
                                configuredNetwork: this.XRPL_NETWORK,
                                actualNetwork: otherNetwork,
                                balance: otherBalance,
                                action: "Set XRPL_NETWORK=".concat(otherNetwork, " in environment variables to fix this permanently"),
                                note: 'Account exists on both networks, but token balance found on other network',
                            });
                            return [2 /*return*/, otherBalance];
                        }
                        return [3 /*break*/, 13];
                    case 11:
                        otherError_2 = _t.sent();
                        return [4 /*yield*/, otherClient.disconnect()];
                    case 12:
                        _t.sent();
                        return [3 /*break*/, 13];
                    case 13: return [3 /*break*/, 15];
                    case 14:
                        checkError_2 = _t.sent();
                        return [3 /*break*/, 15];
                    case 15: 
                    // No trust line found, return 0
                    return [2 /*return*/, 0];
                    case 16:
                        balance = parseFloat(trustLine.balance || '0');
                        finalBalance = Math.max(0, balance);
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:372', message: 'getTokenBalance: Success', data: { xrplAddress: xrplAddress, currency: currency, issuer: issuer, finalBalance: finalBalance }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        // #endregion
                        return [2 /*return*/, finalBalance];
                    case 17:
                        error_6 = _t.sent();
                        return [4 /*yield*/, client.disconnect()];
                    case 18:
                        _t.sent();
                        errorData = error_6 instanceof Error ? { message: error_6.message, stack: error_6.stack } : { error: String(error_6) };
                        errorObj = error_6;
                        errorDetails = { errorData: errorData, hasData: !!(errorObj === null || errorObj === void 0 ? void 0 : errorObj.data), dataError: (_a = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _a === void 0 ? void 0 : _a.error, dataErrorCode: (_b = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _b === void 0 ? void 0 : _b.error_code, dataErrorMessage: (_c = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _c === void 0 ? void 0 : _c.error_message };
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:376', message: 'getTokenBalance: Inner catch', data: { xrplAddress: xrplAddress, currency: currency, issuer: issuer, errorDetails: errorDetails }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        isAccountNotFound = (error_6 instanceof Error && (error_6.message.includes('actNotFound') || error_6.message.includes('Account not found') || error_6.message.includes('accountNotFound'))) ||
                            ((_d = error_6 === null || error_6 === void 0 ? void 0 : error_6.data) === null || _d === void 0 ? void 0 : _d.error) === 'actNotFound' ||
                            (((_e = error_6 === null || error_6 === void 0 ? void 0 : error_6.data) === null || _e === void 0 ? void 0 : _e.error_message) === 'accountNotFound' || ((_f = error_6 === null || error_6 === void 0 ? void 0 : error_6.data) === null || _f === void 0 ? void 0 : _f.error_message) === 'Account not found.') ||
                            ((_g = error_6 === null || error_6 === void 0 ? void 0 : error_6.data) === null || _g === void 0 ? void 0 : _g.error_code) === 19;
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:382', message: 'getTokenBalance: Checking accountNotFound', data: { xrplAddress: xrplAddress, currency: currency, issuer: issuer, isAccountNotFound: isAccountNotFound }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        if (!isAccountNotFound) return [3 /*break*/, 30];
                        otherNetwork = this.XRPL_NETWORK === 'mainnet' ? 'testnet' : 'mainnet';
                        otherServer = otherNetwork === 'mainnet'
                            ? 'wss://xrplcluster.com'
                            : 'wss://s.altnet.rippletest.net:51233';
                        otherIssuer_2 = issuer;
                        if (currency === 'USD') {
                            isUSDT = issuer === this.USDT_ISSUER;
                            isUSDC = issuer === this.USDC_ISSUER;
                            if (isUSDT || isUSDC) {
                                // Get the correct issuer for the other network
                                otherIssuer_2 = isUSDT
                                    ? this.getIssuerForNetwork(otherNetwork, 'USDT')
                                    : this.getIssuerForNetwork(otherNetwork, 'USDC');
                            }
                        }
                        console.log('[WARNING] Account not found on configured network (token balance), checking other network', {
                            configuredNetwork: this.XRPL_NETWORK,
                            checkingNetwork: otherNetwork,
                            address: xrplAddress,
                            currency: currency,
                            configuredIssuer: issuer,
                            otherNetworkIssuer: otherIssuer_2,
                        });
                        _t.label = 19;
                    case 19:
                        _t.trys.push([19, 28, , 29]);
                        otherClient = new xrpl_1.Client(otherServer);
                        return [4 /*yield*/, otherClient.connect()];
                    case 20:
                        _t.sent();
                        _t.label = 21;
                    case 21:
                        _t.trys.push([21, 25, , 27]);
                        // First check if account exists on other network
                        return [4 /*yield*/, otherClient.request({
                                command: 'account_info',
                                account: xrplAddress,
                                ledger_index: 'validated',
                            })];
                    case 22:
                        // First check if account exists on other network
                        _t.sent();
                        return [4 /*yield*/, otherClient.request({
                                command: 'account_lines',
                                account: xrplAddress,
                                ledger_index: 'validated',
                            })];
                    case 23:
                        otherAccountLines = _t.sent();
                        return [4 /*yield*/, otherClient.disconnect()];
                    case 24:
                        _t.sent();
                        lines = otherAccountLines.result.lines || [];
                        trustLine = lines.find(function (line) {
                            return line.currency === currency && line.account === otherIssuer_2;
                        });
                        otherBalance = trustLine ? Math.max(0, parseFloat(trustLine.balance || '0')) : 0;
                        console.log('[CRITICAL] Network mismatch detected (token balance)!', {
                            address: xrplAddress,
                            currency: currency,
                            configuredIssuer: issuer,
                            actualIssuer: otherIssuer_2,
                            configuredNetwork: this.XRPL_NETWORK,
                            actualNetwork: otherNetwork,
                            balance: otherBalance,
                            hasTrustLine: !!trustLine,
                            action: "Set XRPL_NETWORK=".concat(otherNetwork, " in environment variables to fix this permanently"),
                            note: 'Returning balance from correct network, but please update environment variable',
                        });
                        // Return the balance from the correct network
                        return [2 /*return*/, otherBalance];
                    case 25:
                        otherError_3 = _t.sent();
                        return [4 /*yield*/, otherClient.disconnect()];
                    case 26:
                        _t.sent();
                        isOtherAccountNotFound = (otherError_3 instanceof Error && (otherError_3.message.includes('actNotFound') || otherError_3.message.includes('Account not found'))) ||
                            ((_h = otherError_3 === null || otherError_3 === void 0 ? void 0 : otherError_3.data) === null || _h === void 0 ? void 0 : _h.error) === 'actNotFound' ||
                            (((_j = otherError_3 === null || otherError_3 === void 0 ? void 0 : otherError_3.data) === null || _j === void 0 ? void 0 : _j.error_message) === 'accountNotFound' || ((_k = otherError_3 === null || otherError_3 === void 0 ? void 0 : otherError_3.data) === null || _k === void 0 ? void 0 : _k.error_message) === 'Account not found.') ||
                            ((_l = otherError_3 === null || otherError_3 === void 0 ? void 0 : otherError_3.data) === null || _l === void 0 ? void 0 : _l.error_code) === 19;
                        console.log('[INFO] Account check on other network', {
                            address: xrplAddress,
                            currency: currency,
                            issuer: issuer,
                            otherNetwork: otherNetwork,
                            accountNotFound: isOtherAccountNotFound,
                            error: otherError_3 instanceof Error ? otherError_3.message : String(otherError_3),
                            note: isOtherAccountNotFound
                                ? 'Account not found on either network'
                                : 'Account found but no trust line or other error',
                        });
                        return [3 /*break*/, 27];
                    case 27: return [3 /*break*/, 29];
                    case 28:
                        checkError_3 = _t.sent();
                        console.log('[DEBUG] Could not check other network (token balance)', {
                            address: xrplAddress,
                            currency: currency,
                            issuer: issuer,
                            error: checkError_3 instanceof Error ? checkError_3.message : String(checkError_3),
                        });
                        return [3 /*break*/, 29];
                    case 29: 
                    // Account doesn't exist yet - this is expected for new wallets, return 0 silently
                    return [2 /*return*/, 0];
                    case 30:
                        // Log error details for Render debugging only for unexpected errors
                        console.log('[DEBUG] getTokenBalance inner catch (unexpected error):', {
                            xrplAddress: xrplAddress,
                            currency: currency,
                            issuer: issuer,
                            errorMessage: error_6 instanceof Error ? error_6.message : String(error_6),
                            errorData: errorObj === null || errorObj === void 0 ? void 0 : errorObj.data,
                        });
                        throw error_6;
                    case 31: return [3 /*break*/, 33];
                    case 32:
                        error_7 = _t.sent();
                        errorData = error_7 instanceof Error ? { message: error_7.message, stack: error_7.stack } : { error: String(error_7) };
                        errorObj = error_7;
                        errorDetails = { errorData: errorData, hasData: !!(errorObj === null || errorObj === void 0 ? void 0 : errorObj.data), dataError: (_m = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _m === void 0 ? void 0 : _m.error, dataErrorCode: (_o = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _o === void 0 ? void 0 : _o.error_code, dataErrorMessage: (_p = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _p === void 0 ? void 0 : _p.error_message };
                        isAccountNotFound = (error_7 instanceof Error && error_7.message.includes('actNotFound')) ||
                            ((_q = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _q === void 0 ? void 0 : _q.error) === 'actNotFound' ||
                            ((_r = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _r === void 0 ? void 0 : _r.error_message) === 'accountNotFound' ||
                            ((_s = errorObj === null || errorObj === void 0 ? void 0 : errorObj.data) === null || _s === void 0 ? void 0 : _s.error_code) === 19;
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ location: 'xrpl-wallet.service.ts:390', message: 'getTokenBalance: Outer catch', data: { xrplAddress: xrplAddress, currency: currency, issuer: issuer, errorDetails: errorDetails, isAccountNotFound: isAccountNotFound }, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B' }) }).catch(function () { });
                        // #endregion
                        // Only log if it's not an expected account not found error
                        if (!isAccountNotFound) {
                            console.error("Error getting ".concat(currency, " balance:"), error_7);
                            console.log('[DEBUG] getTokenBalance outer catch (unexpected error):', {
                                xrplAddress: xrplAddress,
                                currency: currency,
                                issuer: issuer,
                                errorMessage: error_7 instanceof Error ? error_7.message : String(error_7),
                                errorData: errorObj === null || errorObj === void 0 ? void 0 : errorObj.data,
                            });
                        }
                        // Account not found errors are expected for new wallets - suppress logging
                        // Fallback to 0 if there's an error
                        return [2 /*return*/, 0];
                    case 33: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get USDT balance for an XRPL address
     */
    XRPLWalletService.prototype.getUSDTBalance = function (xrplAddress) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.getTokenBalance(xrplAddress, 'USD', this.USDT_ISSUER)];
            });
        });
    };
    /**
     * Get USDC balance for an XRPL address
     */
    XRPLWalletService.prototype.getUSDCBalance = function (xrplAddress) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.getTokenBalance(xrplAddress, 'USD', this.USDC_ISSUER)];
            });
        });
    };
    /**
     * Get all balances (XRP, USDT, USDC) for an XRPL address
     */
    XRPLWalletService.prototype.getAllBalances = function (xrplAddress) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, xrp, usdt, usdc, error_8;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, Promise.all([
                                this.getBalance(xrplAddress).catch(function (err) {
                                    console.error('[XRPL] Error getting XRP balance:', err);
                                    return 0; // Return 0 for individual failures, but continue
                                }),
                                this.getUSDTBalance(xrplAddress).catch(function (err) {
                                    console.error('[XRPL] Error getting USDT balance:', err);
                                    return 0;
                                }),
                                this.getUSDCBalance(xrplAddress).catch(function (err) {
                                    console.error('[XRPL] Error getting USDC balance:', err);
                                    return 0;
                                }),
                            ])];
                    case 1:
                        _a = _b.sent(), xrp = _a[0], usdt = _a[1], usdc = _a[2];
                        console.log('[XRPL] getAllBalances result:', {
                            xrplAddress: xrplAddress,
                            xrp: xrp,
                            usdt: usdt,
                            usdc: usdc,
                            network: this.XRPL_NETWORK,
                        });
                        return [2 /*return*/, {
                                xrp: xrp,
                                usdt: usdt,
                                usdc: usdc,
                            }];
                    case 2:
                        error_8 = _b.sent();
                        console.error('[XRPL] Critical error getting all balances:', {
                            error: error_8 instanceof Error ? error_8.message : String(error_8),
                            xrplAddress: xrplAddress,
                            network: this.XRPL_NETWORK,
                        });
                        // Still return zeros but log the error for debugging
                        return [2 /*return*/, {
                                xrp: 0,
                                usdt: 0,
                                usdc: 0,
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return XRPLWalletService;
}());
exports.XRPLWalletService = XRPLWalletService;
exports.xrplWalletService = new XRPLWalletService();
