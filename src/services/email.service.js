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
exports.emailService = exports.EmailService = void 0;
var resend_1 = require("resend");
var dotenv = require("dotenv");
dotenv.config();
// Initialize Resend client
var resend = process.env.RESEND_API_KEY
    ? new resend_1.Resend(process.env.RESEND_API_KEY)
    : null;
var EmailService = /** @class */ (function () {
    function EmailService() {
    }
    /**
     * Send email verification link
     * @param email - User email address
     * @param verificationToken - Verification token
     * @param fullName - User's full name
     */
    EmailService.prototype.sendVerificationEmail = function (email, verificationToken, fullName) {
        return __awaiter(this, void 0, void 0, function () {
            var errorMsg, errorMsg, backendUrl, verificationLink, _a, data, error, error_1, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        if (!resend) {
                            errorMsg = 'Resend API key not configured. Please set RESEND_API_KEY environment variable.';
                            console.error(errorMsg);
                            throw new Error(errorMsg);
                        }
                        if (!process.env.RESEND_FROM_EMAIL) {
                            errorMsg = 'Resend from email not configured. Please set RESEND_FROM_EMAIL environment variable.';
                            console.error(errorMsg);
                            throw new Error(errorMsg);
                        }
                        backendUrl = process.env.BACKEND_URL || process.env.RENDER_URL || 'http://localhost:3000';
                        verificationLink = "".concat(backendUrl, "/api/auth/verify-email?token=").concat(verificationToken);
                        console.log("Attempting to send verification email to: ".concat(email));
                        console.log("Using Resend from: ".concat(process.env.RESEND_FROM_EMAIL));
                        console.log("Backend URL: ".concat(backendUrl));
                        return [4 /*yield*/, resend.emails.send({
                                from: process.env.RESEND_FROM_EMAIL,
                                to: email,
                                subject: 'Verify Your TrustiChain Account',
                                html: "\n          <!DOCTYPE html>\n          <html>\n          <head>\n            <meta charset=\"utf-8\">\n            <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n            <title>Verify Your Email</title>\n          </head>\n          <body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;\">\n            <div style=\"background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;\">\n              <h1 style=\"color: white; margin: 0;\">Welcome to TrustiChain!</h1>\n            </div>\n            <div style=\"background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;\">\n              <p>Hi ".concat(fullName, ",</p>\n              <p>Thank you for signing up for TrustiChain! Please verify your email address to complete your registration and start using our platform.</p>\n              <div style=\"text-align: center; margin: 30px 0;\">\n                <a href=\"").concat(verificationLink, "\" \n                   style=\"background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); \n                          color: white; \n                          padding: 15px 30px; \n                          text-decoration: none; \n                          border-radius: 5px; \n                          display: inline-block; \n                          font-weight: bold;\">\n                  Verify Email Address\n                </a>\n              </div>\n              <p style=\"font-size: 12px; color: #666; margin-top: 30px;\">\n                Or copy and paste this link into your browser:<br>\n                <a href=\"").concat(verificationLink, "\" style=\"color: #667eea; word-break: break-all;\">").concat(verificationLink, "</a>\n              </p>\n              <p style=\"font-size: 12px; color: #666;\">\n                This link will expire in 24 hours. If you didn't create an account, please ignore this email.\n              </p>\n            </div>\n            <div style=\"text-align: center; margin-top: 20px; color: #999; font-size: 12px;\">\n              <p>&copy; ").concat(new Date().getFullYear(), " TrustiChain. All rights reserved.</p>\n            </div>\n          </body>\n          </html>\n        "),
                                text: "\n          Hi ".concat(fullName, ",\n          \n          Thank you for signing up for TrustiChain! Please verify your email address to complete your registration.\n          \n          Click this link to verify: ").concat(verificationLink, "\n          \n          This link will expire in 24 hours. If you didn't create an account, please ignore this email.\n          \n          \u00A9 ").concat(new Date().getFullYear(), " TrustiChain. All rights reserved.\n        "),
                            })];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            console.error('Resend email error:', error);
                            return [2 /*return*/, { success: false, error: error.message || 'Failed to send email via Resend' }];
                        }
                        console.log('Verification email sent successfully via Resend:', {
                            id: data === null || data === void 0 ? void 0 : data.id,
                            to: email,
                        });
                        return [2 /*return*/, { success: true }];
                    case 2:
                        error_1 = _b.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : 'Failed to send verification email';
                        console.error('Email sending error:', error_1);
                        return [2 /*return*/, { success: false, error: errorMessage }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return EmailService;
}());
exports.EmailService = EmailService;
exports.emailService = new EmailService();
