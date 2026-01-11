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
exports.authController = exports.AuthController = void 0;
var auth_service_1 = require("../services/auth.service");
var AuthController = /** @class */ (function () {
    function AuthController() {
    }
    /**
     * Register a new user
     * POST /api/auth/register
     */
    AuthController.prototype.register = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var registerData, result, error_1, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        registerData = req.body;
                        return [4 /*yield*/, auth_service_1.authService.register(registerData)];
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
     * Login a user
     * POST /api/auth/login
     */
    AuthController.prototype.login = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var controllerStartTime, loginData, result, controllerDurationMs, statusCode, error_2, errorMessage;
            var _a, _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        _f.trys.push([0, 2, , 3]);
                        controllerStartTime = Date.now();
                        loginData = req.body;
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionId: 'debug-session',
                                runId: 'pre-fix',
                                hypothesisId: 'H4',
                                location: 'src/controllers/auth.controller.ts:36',
                                message: 'login_controller_start',
                                data: { email: (_b = (_a = loginData.email) === null || _a === void 0 ? void 0 : _a.toLowerCase) === null || _b === void 0 ? void 0 : _b.call(_a) },
                                timestamp: Date.now(),
                            }),
                        }).catch(function () { });
                        return [4 /*yield*/, auth_service_1.authService.login(loginData)];
                    case 1:
                        result = _f.sent();
                        controllerDurationMs = Date.now() - controllerStartTime;
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionId: 'debug-session',
                                runId: 'pre-fix',
                                hypothesisId: 'H4',
                                location: 'src/controllers/auth.controller.ts:42',
                                message: 'login_controller_end',
                                data: {
                                    email: (_d = (_c = loginData.email) === null || _c === void 0 ? void 0 : _c.toLowerCase) === null || _d === void 0 ? void 0 : _d.call(_c),
                                    durationMs: controllerDurationMs,
                                    success: result.success,
                                    emailVerificationRequired: (_e = result.emailVerificationRequired) !== null && _e !== void 0 ? _e : false,
                                },
                                timestamp: Date.now(),
                            }),
                        }).catch(function () { });
                        // #endregion
                        if (result.success) {
                            res.status(200).json(result);
                        }
                        else {
                            statusCode = result.emailVerificationRequired ? 403 : 401;
                            res.status(statusCode).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_2 = _f.sent();
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
     * Verify user email
     * POST /api/auth/verify-email
     */
    AuthController.prototype.verifyEmail = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var verifyData, result, error_3, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        verifyData = req.body;
                        return [4 /*yield*/, auth_service_1.authService.verifyEmail(verifyData)];
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
     * Verify user email via GET (for direct link clicks)
     * GET /api/auth/verify-email?token=xxx
     * Returns a beautiful HTML page showing verification status
     */
    AuthController.prototype.verifyEmailGet = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var token, result, error_4, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        token = req.query.token;
                        if (!token) {
                            res.status(400).send(this.getErrorPage('Missing Verification Token', 'The verification link is invalid. Please check your email and try again.'));
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, auth_service_1.authService.verifyEmail({ token: token })];
                    case 1:
                        result = _a.sent();
                        if (result.success) {
                            res.status(200).send(this.getSuccessPage());
                        }
                        else {
                            res.status(400).send(this.getErrorPage('Verification Failed', result.message || 'Unable to verify your email.'));
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_4 = _a.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : 'An unexpected error occurred';
                        res.status(500).send(this.getErrorPage('Error', errorMessage));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate beautiful success page HTML
     */
    AuthController.prototype.getSuccessPage = function () {
        var frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return "\n<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Email Verified - TrustiChain</title>\n    <style>\n        * {\n            margin: 0;\n            padding: 0;\n            box-sizing: border-box;\n        }\n        \n        body {\n            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            min-height: 100vh;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            padding: 20px;\n        }\n        \n        .container {\n            background: white;\n            border-radius: 20px;\n            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);\n            max-width: 500px;\n            width: 100%;\n            padding: 50px 40px;\n            text-align: center;\n            animation: slideUp 0.5s ease-out;\n        }\n        \n        @keyframes slideUp {\n            from {\n                opacity: 0;\n                transform: translateY(30px);\n            }\n            to {\n                opacity: 1;\n                transform: translateY(0);\n            }\n        }\n        \n        .success-icon {\n            width: 100px;\n            height: 100px;\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            border-radius: 50%;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            margin: 0 auto 30px;\n            animation: scaleIn 0.5s ease-out 0.2s both;\n        }\n        \n        @keyframes scaleIn {\n            from {\n                transform: scale(0);\n            }\n            to {\n                transform: scale(1);\n            }\n        }\n        \n        .success-icon svg {\n            width: 60px;\n            height: 60px;\n            color: white;\n        }\n        \n        h1 {\n            color: #333;\n            font-size: 32px;\n            font-weight: 700;\n            margin-bottom: 15px;\n        }\n        \n        p {\n            color: #666;\n            font-size: 16px;\n            line-height: 1.6;\n            margin-bottom: 30px;\n        }\n        \n        .button {\n            display: inline-block;\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            color: white;\n            padding: 15px 40px;\n            border-radius: 50px;\n            text-decoration: none;\n            font-weight: 600;\n            font-size: 16px;\n            transition: transform 0.2s, box-shadow 0.2s;\n            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);\n        }\n        \n        .button:hover {\n            transform: translateY(-2px);\n            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);\n        }\n        \n        .button:active {\n            transform: translateY(0);\n        }\n        \n        .footer {\n            margin-top: 40px;\n            padding-top: 20px;\n            border-top: 1px solid #eee;\n            color: #999;\n            font-size: 14px;\n        }\n    </style>\n</head>\n<body>\n    <div class=\"container\">\n        <div class=\"success-icon\">\n            <svg fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\">\n                <path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"3\" d=\"M5 13l4 4L19 7\"></path>\n            </svg>\n        </div>\n        <h1>Email Verified!</h1>\n        <p>Your email has been successfully verified. You can now log in to your TrustiChain account and start using our platform.</p>\n        <a href=\"".concat(frontendUrl, "/auth/login\" class=\"button\">Go to Login</a>\n        <div class=\"footer\">\n            <p>&copy; ").concat(new Date().getFullYear(), " TrustiChain. All rights reserved.</p>\n        </div>\n    </div>\n</body>\n</html>\n    ");
    };
    /**
     * Generate beautiful error page HTML
     */
    AuthController.prototype.getErrorPage = function (title, message) {
        var frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return "\n<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Verification Error - TrustiChain</title>\n    <style>\n        * {\n            margin: 0;\n            padding: 0;\n            box-sizing: border-box;\n        }\n        \n        body {\n            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            min-height: 100vh;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            padding: 20px;\n        }\n        \n        .container {\n            background: white;\n            border-radius: 20px;\n            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);\n            max-width: 500px;\n            width: 100%;\n            padding: 50px 40px;\n            text-align: center;\n            animation: slideUp 0.5s ease-out;\n        }\n        \n        @keyframes slideUp {\n            from {\n                opacity: 0;\n                transform: translateY(30px);\n            }\n            to {\n                opacity: 1;\n                transform: translateY(0);\n            }\n        }\n        \n        .error-icon {\n            width: 100px;\n            height: 100px;\n            background: #fee;\n            border-radius: 50%;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            margin: 0 auto 30px;\n            animation: scaleIn 0.5s ease-out 0.2s both;\n        }\n        \n        @keyframes scaleIn {\n            from {\n                transform: scale(0);\n            }\n            to {\n                transform: scale(1);\n            }\n        }\n        \n        .error-icon svg {\n            width: 60px;\n            height: 60px;\n            color: #e74c3c;\n        }\n        \n        h1 {\n            color: #333;\n            font-size: 32px;\n            font-weight: 700;\n            margin-bottom: 15px;\n        }\n        \n        p {\n            color: #666;\n            font-size: 16px;\n            line-height: 1.6;\n            margin-bottom: 30px;\n        }\n        \n        .button {\n            display: inline-block;\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            color: white;\n            padding: 15px 40px;\n            border-radius: 50px;\n            text-decoration: none;\n            font-weight: 600;\n            font-size: 16px;\n            transition: transform 0.2s, box-shadow 0.2s;\n            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);\n            margin-right: 10px;\n        }\n        \n        .button:hover {\n            transform: translateY(-2px);\n            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);\n        }\n        \n        .button-secondary {\n            background: #f0f0f0;\n            color: #333;\n            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);\n        }\n        \n        .button-secondary:hover {\n            background: #e0e0e0;\n        }\n        \n        .footer {\n            margin-top: 40px;\n            padding-top: 20px;\n            border-top: 1px solid #eee;\n            color: #999;\n            font-size: 14px;\n        }\n    </style>\n</head>\n<body>\n    <div class=\"container\">\n        <div class=\"error-icon\">\n            <svg fill=\"none\" stroke=\"currentColor\" viewBox=\"0 0 24 24\" xmlns=\"http://www.w3.org/2000/svg\">\n                <path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M6 18L18 6M6 6l12 12\"></path>\n            </svg>\n        </div>\n        <h1>".concat(title, "</h1>\n        <p>").concat(message, "</p>\n        <div>\n            <a href=\"/api/auth/google\" class=\"button\">Try Google Sign-In Again</a>\n            <a href=\"").concat(frontendUrl, "/auth/signup\" class=\"button button-secondary\">Go to Sign Up</a>\n        </div>\n        <div class=\"footer\">\n            <p>&copy; ").concat(new Date().getFullYear(), " TrustiChain. All rights reserved.</p>\n        </div>\n    </div>\n</body>\n</html>\n      ");
    };
    /**
     * Get Google OAuth URL
     * GET /api/auth/google
     * Redirects directly to Google OAuth (for browser access)
     * Or returns JSON with URL (for API calls)
     */
    AuthController.prototype.getGoogleOAuthUrl = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var result, acceptsHtml, error_5, errorMessage;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, auth_service_1.authService.getGoogleOAuthUrl()];
                    case 1:
                        result = _c.sent();
                        if (result.success && ((_a = result.data) === null || _a === void 0 ? void 0 : _a.url)) {
                            acceptsHtml = (_b = req.headers.accept) === null || _b === void 0 ? void 0 : _b.includes('text/html');
                            if (acceptsHtml) {
                                res.redirect(result.data.url);
                                return [2 /*return*/];
                            }
                            // Otherwise return JSON for API calls
                            res.status(200).json(result);
                        }
                        else {
                            res.status(400).json(result);
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_5 = _c.sent();
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
     * Handle Google OAuth callback
     * GET /api/auth/google/callback?code=xxx
     */
    AuthController.prototype.handleGoogleOAuthCallback = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var code, error, errorDescription, state, errorMsg, fullUrl, baseUrl, callbackUrl, configMessage, debugInfo, result, frontendUrl, error_6, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        // Log all query parameters and request details for debugging
                        console.log('=== OAuth Callback Handler ===');
                        console.log('Full URL:', req.url);
                        console.log('Query params:', JSON.stringify(req.query));
                        console.log('Request method:', req.method);
                        console.log('Request headers:', JSON.stringify(req.headers));
                        console.log('Request host:', req.get('host'));
                        console.log('Request protocol:', req.protocol);
                        console.log('Request original URL:', req.originalUrl);
                        code = req.query.code;
                        error = req.query.error;
                        errorDescription = req.query.error_description;
                        state = req.query.state;
                        // Check if Google returned an error
                        if (error) {
                            console.error('OAuth Error:', error, errorDescription);
                            errorMsg = errorDescription || error || 'Google OAuth authentication was cancelled or failed.';
                            res.status(400).send(this.getErrorPage('Google Sign-In Cancelled', errorMsg));
                            return [2 /*return*/];
                        }
                        // Check if code is missing
                        if (!code) {
                            console.error('=== Missing Authorization Code ===');
                            console.error('Query params received:', JSON.stringify(req.query, null, 2));
                            console.error('All query keys:', Object.keys(req.query));
                            console.error('State parameter:', state);
                            console.error('Error parameter:', error);
                            console.error('Full request URL:', req.url);
                            console.error('Original URL:', req.originalUrl);
                            fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
                            console.error('Full absolute URL:', fullUrl);
                            baseUrl = process.env.RENDER_URL || process.env.BACKEND_URL || 'https://trustichain-backend.onrender.com';
                            callbackUrl = "".concat(baseUrl, "/api/auth/google/callback");
                            configMessage = "\n          <div style=\"background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;\">\n            <h3 style=\"margin-top: 0; color: #856404;\">Configuration Required</h3>\n            <p style=\"color: #856404; margin-bottom: 10px;\">\n              The authorization code is missing. This usually means the <strong>Site URL</strong> or <strong>Redirect URLs</strong> are not properly configured in Supabase Dashboard.\n            </p>\n            <p style=\"color: #856404; margin-bottom: 10px;\"><strong>Please verify BOTH settings:</strong></p>\n            <ol style=\"color: #856404; margin-left: 20px;\">\n              <li>Go to your <a href=\"https://app.supabase.com\" target=\"_blank\" style=\"color: #667eea;\">Supabase Dashboard</a></li>\n              <li>Navigate to <strong>Authentication \u2192 URL Configuration</strong></li>\n              <li><strong>Set Site URL</strong> to (base URL, no path):\n                <br><code style=\"background: #f8f9fa; padding: 5px; border-radius: 3px; display: inline-block; margin-top: 5px; font-weight: bold;\">".concat(baseUrl, "</code>\n                <br><small style=\"color: #666;\">This is critical - it must match your application's base URL</small>\n              </li>\n              <li><strong>Add to Redirect URLs</strong> (specific callback endpoint):\n                <br><code style=\"background: #f8f9fa; padding: 5px; border-radius: 3px; display: inline-block; margin-top: 5px;\">").concat(callbackUrl, "</code>\n              </li>\n              <li>Click <strong>Save</strong></li>\n              <li>Wait a few seconds for changes to propagate, then try again</li>\n            </ol>\n            <p style=\"color: #856404; margin-top: 15px; margin-bottom: 0;\">\n              <strong>Important:</strong> The Site URL is the base URL of your application. The Redirect URL is the specific callback endpoint. Both must be configured correctly.\n            </p>\n          </div>\n        ");
                            debugInfo = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production'
                                ? "<br><br><small style=\"color: #666;\">Debug Info:<br>URL: ".concat(req.originalUrl, "<br>Params: ").concat(JSON.stringify(req.query, null, 2), "<br>State: ").concat(state || 'none', "</small>")
                                : '';
                            res.status(400).send(this.getErrorPage('Missing Authorization Code', "The Google OAuth callback is missing the authorization code.".concat(configMessage).concat(debugInfo, "<br><br><a href=\"/api/auth/google\" style=\"color: #667eea; text-decoration: none; font-weight: bold;\">Try again</a>.")));
                            return [2 /*return*/];
                        }
                        console.log('Authorization code received:', code.substring(0, 20) + '...');
                        console.log('State parameter:', state || 'none');
                        return [4 /*yield*/, auth_service_1.authService.handleGoogleOAuthCallback(code)];
                    case 1:
                        result = _a.sent();
                        if (result.success && result.data) {
                            frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
                            res.redirect("".concat(frontendUrl, "/auth/callback?success=true&provider=google"));
                            return [2 /*return*/];
                        }
                        else {
                            res.status(400).send(this.getErrorPage('Google Sign-In Failed', result.message || 'Unable to sign in with Google.'));
                            return [2 /*return*/];
                        }
                        return [3 /*break*/, 3];
                    case 2:
                        error_6 = _a.sent();
                        errorMessage = error_6 instanceof Error ? error_6.message : 'An unexpected error occurred';
                        res.status(500).send(this.getErrorPage('Error', errorMessage));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Logout a user
     * POST /api/auth/logout
     */
    AuthController.prototype.logout = function (req, res) {
        return __awaiter(this, void 0, void 0, function () {
            var authHeader, accessToken, result, error_7, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        authHeader = req.headers.authorization;
                        if (!authHeader || !authHeader.startsWith('Bearer ')) {
                            res.status(401).json({
                                success: false,
                                message: 'Authorization token required',
                                error: 'Unauthorized',
                            });
                            return [2 /*return*/];
                        }
                        accessToken = authHeader.substring(7);
                        return [4 /*yield*/, auth_service_1.authService.logout(accessToken)];
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
    return AuthController;
}());
exports.AuthController = AuthController;
exports.authController = new AuthController();
