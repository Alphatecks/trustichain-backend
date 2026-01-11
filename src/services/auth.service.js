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
exports.authService = exports.AuthService = void 0;
var supabase_1 = require("../config/supabase");
var email_service_1 = require("./email.service");
var crypto = require("crypto");
var AuthService = /** @class */ (function () {
    function AuthService() {
    }
    /**
     * Register a new user
     * @param registerData - User registration data
     * @returns Registration response with user data or error
     */
    AuthService.prototype.register = function (registerData) {
        return __awaiter(this, void 0, void 0, function () {
            var email, password, fullName, country, agreeToTerms, existingUser, authData, authError, result, result, adminClient, _a, profileData, profileError, verificationToken, expiresAt, tokenError, emailResult, error_1, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 9, , 10]);
                        email = registerData.email, password = registerData.password, fullName = registerData.fullName, country = registerData.country, agreeToTerms = registerData.agreeToTerms;
                        // Terms and conditions are validated in middleware, but double-check here
                        if (!agreeToTerms) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'You must agree to the terms and conditions',
                                    error: 'Terms not accepted',
                                }];
                        }
                        return [4 /*yield*/, supabase_1.supabase
                                .from('users')
                                .select('id, email')
                                .eq('email', email.toLowerCase())
                                .single()];
                    case 1:
                        existingUser = (_b.sent()).data;
                        if (existingUser) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'User with this email already exists',
                                    error: 'Email already registered',
                                }];
                        }
                        authData = void 0;
                        authError = void 0;
                        if (!supabase_1.supabaseAdmin) return [3 /*break*/, 3];
                        return [4 /*yield*/, supabase_1.supabaseAdmin.auth.admin.createUser({
                                email: email.toLowerCase(),
                                password: password,
                                email_confirm: false, // Don't auto-confirm, require verification
                                user_metadata: {
                                    full_name: fullName,
                                    country: country,
                                },
                            })];
                    case 2:
                        result = _b.sent();
                        authData = { user: result.data.user, session: null };
                        authError = result.error;
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, supabase_1.supabase.auth.signUp({
                            email: email.toLowerCase(),
                            password: password,
                            options: {
                                data: {
                                    full_name: fullName,
                                    country: country,
                                },
                            },
                        })];
                    case 4:
                        result = _b.sent();
                        authData = result.data;
                        authError = result.error;
                        _b.label = 5;
                    case 5:
                        if (authError) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: authError.message || 'Failed to create user account',
                                    error: 'Authentication error',
                                }];
                        }
                        if (!authData.user) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to create user account',
                                    error: 'No user data returned',
                                }];
                        }
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('users')
                                .insert({
                                id: authData.user.id,
                                email: email.toLowerCase(),
                                full_name: fullName,
                                country: country || null, // Handle optional country
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            })
                                .select()
                                .single()];
                    case 6:
                        _a = _b.sent(), profileData = _a.data, profileError = _a.error;
                        if (profileError) {
                            // If profile creation fails, we should handle cleanup
                            // For now, return error (in production, you might want to clean up the auth user)
                            return [2 /*return*/, {
                                    success: false,
                                    message: profileError.message || 'Failed to create user profile',
                                    error: 'Database error',
                                }];
                        }
                        verificationToken = crypto.randomBytes(32).toString('hex');
                        expiresAt = new Date();
                        expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours
                        return [4 /*yield*/, adminClient
                                .from('email_verification_tokens')
                                .insert({
                                user_id: authData.user.id,
                                token: verificationToken,
                                expires_at: expiresAt.toISOString(),
                                used: false,
                            })];
                    case 7:
                        tokenError = (_b.sent()).error;
                        if (tokenError) {
                            console.error('Failed to create verification token:', tokenError);
                            // Continue anyway, user can request resend
                        }
                        return [4 /*yield*/, email_service_1.emailService.sendVerificationEmail(email.toLowerCase(), verificationToken, fullName)];
                    case 8:
                        emailResult = _b.sent();
                        if (!emailResult.success) {
                            console.error('Failed to send verification email:', emailResult.error);
                            // Return error so user knows email failed
                            return [2 /*return*/, {
                                    success: false,
                                    message: "User account created, but failed to send verification email: ".concat(emailResult.error, ". Please contact support."),
                                    error: 'Email sending failed',
                                    data: {
                                        user: {
                                            id: profileData.id,
                                            email: profileData.email,
                                            fullName: profileData.full_name,
                                            country: profileData.country,
                                        },
                                    },
                                }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                message: 'User registered successfully. Please check your email to verify your account before logging in.',
                                data: {
                                    user: {
                                        id: profileData.id,
                                        email: profileData.email,
                                        fullName: profileData.full_name,
                                        country: profileData.country,
                                    },
                                    emailVerificationRequired: true,
                                },
                            }];
                    case 9:
                        error_1 = _b.sent();
                        errorMessage = error_1 instanceof Error ? error_1.message : 'An unexpected error occurred';
                        return [2 /*return*/, {
                                success: false,
                                message: errorMessage,
                                error: 'Internal server error',
                            }];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Login a user
     * @param loginData - User login credentials
     * @returns Login response with user data and tokens or error
     */
    AuthService.prototype.login = function (loginData) {
        return __awaiter(this, void 0, void 0, function () {
            var email, password, normalizedEmail, LOGIN_TIMEOUT_MS_1, loginStartTime, loginPromise, timeoutPromise, _a, authData, authError, loginDurationMs, user, userMetadata, fullName, country, userEmail, error_2, errorMessage;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 2, , 3]);
                        email = loginData.email, password = loginData.password;
                        normalizedEmail = email.toLowerCase();
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionId: 'debug-session',
                                runId: 'pre-fix',
                                hypothesisId: 'H1',
                                location: 'src/services/auth.service.ts:195',
                                message: 'login_start',
                                data: { email: normalizedEmail },
                                timestamp: Date.now(),
                            }),
                        }).catch(function () { });
                        LOGIN_TIMEOUT_MS_1 = 8000;
                        loginStartTime = Date.now();
                        loginPromise = supabase_1.supabase.auth.signInWithPassword({
                            email: normalizedEmail,
                            password: password,
                        });
                        timeoutPromise = new Promise(function (_, reject) {
                            setTimeout(function () { return reject(new Error('Login request timed out. Please try again.')); }, LOGIN_TIMEOUT_MS_1);
                        });
                        return [4 /*yield*/, Promise.race([
                                loginPromise,
                                timeoutPromise,
                            ])];
                    case 1:
                        _a = _e.sent(), authData = _a.data, authError = _a.error;
                        loginDurationMs = Date.now() - loginStartTime;
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionId: 'debug-session',
                                runId: 'pre-fix',
                                hypothesisId: 'H1',
                                location: 'src/services/auth.service.ts:207',
                                message: 'login_supabase_completed',
                                data: {
                                    email: normalizedEmail,
                                    durationMs: loginDurationMs,
                                    hasUser: !!(authData === null || authData === void 0 ? void 0 : authData.user),
                                    hasError: !!authError,
                                },
                                timestamp: Date.now(),
                            }),
                        }).catch(function () { });
                        // #endregion
                        if (authError) {
                            // #region agent log
                            fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    sessionId: 'debug-session',
                                    runId: 'pre-fix',
                                    hypothesisId: 'H2',
                                    location: 'src/services/auth.service.ts:210',
                                    message: 'login_auth_error',
                                    data: {
                                        email: normalizedEmail,
                                        errorMessage: authError.message,
                                    },
                                    timestamp: Date.now(),
                                }),
                            }).catch(function () { });
                            // #endregion
                            return [2 /*return*/, {
                                    success: false,
                                    message: authError.message || 'Invalid email or password',
                                    error: 'Authentication failed',
                                }];
                        }
                        if (!(authData === null || authData === void 0 ? void 0 : authData.user)) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to authenticate user',
                                    error: 'No user data returned',
                                }];
                        }
                        // Check if email is verified
                        if (!authData.user.email_confirmed_at) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Please verify your email before logging in. Check your inbox for the verification link.',
                                    error: 'Email not verified',
                                    emailVerificationRequired: true,
                                }];
                        }
                        user = authData.user;
                        userMetadata = user.user_metadata;
                        fullName = (userMetadata === null || userMetadata === void 0 ? void 0 : userMetadata.full_name) || (userMetadata === null || userMetadata === void 0 ? void 0 : userMetadata.name) || ((_b = user.email) === null || _b === void 0 ? void 0 : _b.split('@')[0]) || 'User';
                        country = (userMetadata === null || userMetadata === void 0 ? void 0 : userMetadata.country) || null;
                        userEmail = user.email || normalizedEmail;
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                sessionId: 'debug-session',
                                runId: 'pre-fix',
                                hypothesisId: 'H3',
                                location: 'src/services/auth.service.ts:244',
                                message: 'login_success',
                                data: {
                                    email: userEmail,
                                    fullName: fullName,
                                },
                                timestamp: Date.now(),
                            }),
                        }).catch(function () { });
                        // #endregion
                        return [2 /*return*/, {
                                success: true,
                                message: 'Login successful',
                                data: {
                                    user: {
                                        id: user.id,
                                        email: userEmail,
                                        fullName: fullName,
                                        country: country,
                                    },
                                    accessToken: (_c = authData.session) === null || _c === void 0 ? void 0 : _c.access_token,
                                    refreshToken: (_d = authData.session) === null || _d === void 0 ? void 0 : _d.refresh_token,
                                },
                            }];
                    case 2:
                        error_2 = _e.sent();
                        errorMessage = error_2 instanceof Error ? error_2.message : 'An unexpected error occurred';
                        return [2 /*return*/, {
                                success: false,
                                message: errorMessage,
                                error: 'Internal server error',
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Verify user email using verification token
     * @param verifyData - Verification token
     * @returns Verification response
     */
    AuthService.prototype.verifyEmail = function (verifyData) {
        return __awaiter(this, void 0, void 0, function () {
            var token, adminClient, _a, tokenData, tokenError, now, expiresAt, verifyError, error_3, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 6, , 7]);
                        token = verifyData.token;
                        if (!token) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Verification token is required',
                                    error: 'Invalid token',
                                }];
                        }
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('email_verification_tokens')
                                .select('*')
                                .eq('token', token)
                                .eq('used', false)
                                .single()];
                    case 1:
                        _a = _b.sent(), tokenData = _a.data, tokenError = _a.error;
                        if (tokenError || !tokenData) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Invalid or expired verification token',
                                    error: 'Token not found',
                                }];
                        }
                        now = new Date();
                        expiresAt = new Date(tokenData.expires_at);
                        if (now > expiresAt) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Verification token has expired. Please request a new one.',
                                    error: 'Token expired',
                                }];
                        }
                        // Mark token as used
                        return [4 /*yield*/, adminClient
                                .from('email_verification_tokens')
                                .update({ used: true })
                                .eq('id', tokenData.id)];
                    case 2:
                        // Mark token as used
                        _b.sent();
                        if (!supabase_1.supabaseAdmin) return [3 /*break*/, 4];
                        return [4 /*yield*/, supabase_1.supabaseAdmin.auth.admin.updateUserById(tokenData.user_id, { email_confirm: true })];
                    case 3:
                        verifyError = (_b.sent()).error;
                        if (verifyError) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: verifyError.message || 'Failed to verify email',
                                    error: 'Verification failed',
                                }];
                        }
                        return [3 /*break*/, 5];
                    case 4: 
                    // Fallback: user needs to verify via Supabase's own system
                    // This shouldn't happen if admin client is configured
                    return [2 /*return*/, {
                            success: false,
                            message: 'Email verification service not properly configured',
                            error: 'Configuration error',
                        }];
                    case 5: return [2 /*return*/, {
                            success: true,
                            message: 'Email verified successfully! You can now log in.',
                        }];
                    case 6:
                        error_3 = _b.sent();
                        errorMessage = error_3 instanceof Error ? error_3.message : 'An unexpected error occurred';
                        return [2 /*return*/, {
                                success: false,
                                message: errorMessage,
                                error: 'Internal server error',
                            }];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get Google OAuth URL for sign-in
     * @returns OAuth URL to redirect user to
     */
    AuthService.prototype.getGoogleOAuthUrl = function () {
        return __awaiter(this, void 0, void 0, function () {
            var baseUrl, redirectUrl, _a, data, error, error_4, errorMessage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        baseUrl = process.env.RENDER_URL || process.env.BACKEND_URL || 'http://localhost:3000';
                        redirectUrl = "".concat(baseUrl, "/api/auth/google/callback");
                        console.log('=== Generating Google OAuth URL ===');
                        console.log('Base URL (Site URL in Supabase Dashboard):', baseUrl);
                        console.log('Redirect URL (must be in Redirect URLs list):', redirectUrl);
                        console.log('Base URL from env:', { RENDER_URL: process.env.RENDER_URL, BACKEND_URL: process.env.BACKEND_URL });
                        console.log('=== Supabase Dashboard Configuration Required ===');
                        console.log('1. Site URL must be set to:', baseUrl);
                        console.log('2. Redirect URLs must include:', redirectUrl);
                        console.log('   Location: Supabase Dashboard → Authentication → URL Configuration');
                        return [4 /*yield*/, supabase_1.supabase.auth.signInWithOAuth({
                                provider: 'google',
                                options: {
                                    redirectTo: redirectUrl,
                                    queryParams: {
                                        access_type: 'offline',
                                        prompt: 'consent',
                                    },
                                },
                            })];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: error.message || 'Failed to generate Google OAuth URL',
                                    error: 'OAuth error',
                                }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                message: 'Google OAuth URL generated successfully',
                                data: {
                                    url: data.url,
                                },
                            }];
                    case 2:
                        error_4 = _b.sent();
                        errorMessage = error_4 instanceof Error ? error_4.message : 'An unexpected error occurred';
                        return [2 /*return*/, {
                                success: false,
                                message: errorMessage,
                                error: 'Internal server error',
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Handle Google OAuth callback
     * @param code - OAuth authorization code from Google
     * @returns User data and tokens
     */
    AuthService.prototype.handleGoogleOAuthCallback = function (code) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, sessionData, sessionError, user, email, fullName, country, adminClient, existingProfile, profileError, profileData, error_5, errorMessage;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 8, , 9]);
                        return [4 /*yield*/, supabase_1.supabase.auth.exchangeCodeForSession(code)];
                    case 1:
                        _a = _e.sent(), sessionData = _a.data, sessionError = _a.error;
                        if (sessionError || !sessionData.session || !sessionData.user) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: (sessionError === null || sessionError === void 0 ? void 0 : sessionError.message) || 'Failed to authenticate with Google',
                                    error: 'OAuth callback error',
                                }];
                        }
                        user = sessionData.user;
                        email = user.email;
                        fullName = ((_b = user.user_metadata) === null || _b === void 0 ? void 0 : _b.full_name) || ((_c = user.user_metadata) === null || _c === void 0 ? void 0 : _c.name) || (email === null || email === void 0 ? void 0 : email.split('@')[0]) || 'User';
                        country = ((_d = user.user_metadata) === null || _d === void 0 ? void 0 : _d.country) || null;
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('users')
                                .select('*')
                                .eq('id', user.id)
                                .single()];
                    case 2:
                        existingProfile = (_e.sent()).data;
                        if (!!existingProfile) return [3 /*break*/, 4];
                        return [4 /*yield*/, adminClient
                                .from('users')
                                .insert({
                                id: user.id,
                                email: (email === null || email === void 0 ? void 0 : email.toLowerCase()) || '',
                                full_name: fullName,
                                country: country,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            })];
                    case 3:
                        profileError = (_e.sent()).error;
                        if (profileError) {
                            console.error('Failed to create user profile:', profileError);
                            // Continue anyway - user is authenticated
                        }
                        return [3 /*break*/, 6];
                    case 4: 
                    // Update user profile if it exists
                    return [4 /*yield*/, adminClient
                            .from('users')
                            .update({
                            email: (email === null || email === void 0 ? void 0 : email.toLowerCase()) || existingProfile.email,
                            full_name: fullName,
                            updated_at: new Date().toISOString(),
                        })
                            .eq('id', user.id)];
                    case 5:
                        // Update user profile if it exists
                        _e.sent();
                        _e.label = 6;
                    case 6: return [4 /*yield*/, adminClient
                            .from('users')
                            .select('id, email, full_name, country')
                            .eq('id', user.id)
                            .single()];
                    case 7:
                        profileData = (_e.sent()).data;
                        return [2 /*return*/, {
                                success: true,
                                message: 'Successfully signed in with Google',
                                data: {
                                    user: {
                                        id: (profileData === null || profileData === void 0 ? void 0 : profileData.id) || user.id,
                                        email: (profileData === null || profileData === void 0 ? void 0 : profileData.email) || email || '',
                                        fullName: (profileData === null || profileData === void 0 ? void 0 : profileData.full_name) || fullName,
                                        country: (profileData === null || profileData === void 0 ? void 0 : profileData.country) || country,
                                    },
                                    accessToken: sessionData.session.access_token,
                                    refreshToken: sessionData.session.refresh_token,
                                },
                            }];
                    case 8:
                        error_5 = _e.sent();
                        errorMessage = error_5 instanceof Error ? error_5.message : 'An unexpected error occurred';
                        return [2 /*return*/, {
                                success: false,
                                message: errorMessage,
                                error: 'Internal server error',
                            }];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Logout a user
     * @param accessToken - User's access token from Authorization header
     * @returns Logout response
     */
    AuthService.prototype.logout = function (accessToken) {
        return __awaiter(this, void 0, void 0, function () {
            var supabaseUrl, supabaseAnonKey, createClient, userClient, error, error_6, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        supabaseUrl = process.env.SUPABASE_URL;
                        supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
                        if (!supabaseUrl || !supabaseAnonKey) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Server configuration error',
                                    error: 'Missing Supabase configuration',
                                }];
                        }
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('@supabase/supabase-js'); })];
                    case 1:
                        createClient = (_a.sent()).createClient;
                        userClient = createClient(supabaseUrl, supabaseAnonKey, {
                            global: {
                                headers: {
                                    Authorization: "Bearer ".concat(accessToken),
                                },
                            },
                        });
                        return [4 /*yield*/, userClient.auth.signOut()];
                    case 2:
                        error = (_a.sent()).error;
                        if (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to logout',
                                    error: error.message,
                                }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                message: 'Logged out successfully',
                            }];
                    case 3:
                        error_6 = _a.sent();
                        errorMessage = error_6 instanceof Error ? error_6.message : 'An unexpected error occurred';
                        return [2 /*return*/, {
                                success: false,
                                message: errorMessage,
                                error: 'Internal server error',
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    return AuthService;
}());
exports.AuthService = AuthService;
exports.authService = new AuthService();
