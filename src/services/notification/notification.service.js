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
exports.notificationService = exports.NotificationService = void 0;
var supabase_1 = require("../../config/supabase");
var NotificationService = /** @class */ (function () {
    function NotificationService() {
    }
    /**
     * Create a notification for a user
     */
    NotificationService.prototype.createNotification = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient.from('notifications').insert({
                                user_id: params.userId,
                                type: params.type,
                                title: params.title,
                                message: params.message,
                                metadata: params.metadata || null,
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get notifications for the current user
     */
    NotificationService.prototype.getNotifications = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var userId, _a, filter, _b, page, _c, pageSize, adminClient, from, to, query, _d, rows, error, total, unreadCount, notifications, error_1;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 4, , 5]);
                        userId = params.userId, _a = params.filter, filter = _a === void 0 ? 'all' : _a, _b = params.page, page = _b === void 0 ? 1 : _b, _c = params.pageSize, pageSize = _c === void 0 ? 10 : _c;
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        from = (page - 1) * pageSize;
                        to = from + pageSize - 1;
                        query = adminClient
                            .from('notifications')
                            .select('*')
                            .eq('user_id', userId)
                            .order('created_at', { ascending: false })
                            .range(from, to);
                        if (filter === 'unread') {
                            query = query.eq('is_read', false);
                        }
                        return [4 /*yield*/, query];
                    case 1:
                        _d = _e.sent(), rows = _d.data, error = _d.error;
                        return [4 /*yield*/, adminClient
                                .from('notifications')
                                .select('*', { count: 'exact', head: true })
                                .eq('user_id', userId)];
                    case 2:
                        total = (_e.sent()).count;
                        return [4 /*yield*/, adminClient
                                .from('notifications')
                                .select('*', { count: 'exact', head: true })
                                .eq('user_id', userId)
                                .eq('is_read', false)];
                    case 3:
                        unreadCount = (_e.sent()).count;
                        if (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to fetch notifications',
                                    error: 'Failed to fetch notifications',
                                }];
                        }
                        notifications = (rows === null || rows === void 0 ? void 0 : rows.map(function (n) { return ({
                            id: n.id,
                            type: n.type,
                            title: n.title,
                            message: n.message,
                            isRead: n.is_read,
                            createdAt: n.created_at,
                            metadata: n.metadata || undefined,
                        }); })) || [];
                        return [2 /*return*/, {
                                success: true,
                                message: 'Notifications retrieved successfully',
                                data: {
                                    notifications: notifications,
                                    total: total || 0,
                                    unreadCount: unreadCount || 0,
                                },
                            }];
                    case 4:
                        error_1 = _e.sent();
                        console.error('Error getting notifications:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                message: error_1 instanceof Error ? error_1.message : 'Failed to get notifications',
                                error: error_1 instanceof Error ? error_1.message : 'Failed to get notifications',
                            }];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Mark a single notification as read
     */
    NotificationService.prototype.markAsRead = function (userId, notificationId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, error, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('notifications')
                                .update({ is_read: true })
                                .eq('id', notificationId)
                                .eq('user_id', userId)];
                    case 1:
                        error = (_a.sent()).error;
                        if (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to mark notification as read',
                                    error: 'Failed to mark notification as read',
                                }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                message: 'Notification marked as read',
                            }];
                    case 2:
                        error_2 = _a.sent();
                        console.error('Error marking notification as read:', error_2);
                        return [2 /*return*/, {
                                success: false,
                                message: error_2 instanceof Error ? error_2.message : 'Failed to mark notification as read',
                                error: error_2 instanceof Error ? error_2.message : 'Failed to mark notification as read',
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Mark all notifications as read for a user
     */
    NotificationService.prototype.markAllAsRead = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, error, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        return [4 /*yield*/, adminClient
                                .from('notifications')
                                .update({ is_read: true })
                                .eq('user_id', userId)
                                .eq('is_read', false)];
                    case 1:
                        error = (_a.sent()).error;
                        if (error) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to mark all notifications as read',
                                    error: 'Failed to mark all notifications as read',
                                }];
                        }
                        return [2 /*return*/, {
                                success: true,
                                message: 'All notifications marked as read',
                            }];
                    case 2:
                        error_3 = _a.sent();
                        console.error('Error marking all notifications as read:', error_3);
                        return [2 /*return*/, {
                                success: false,
                                message: error_3 instanceof Error ? error_3.message : 'Failed to mark all notifications as read',
                                error: error_3 instanceof Error ? error_3.message : 'Failed to mark all notifications as read',
                            }];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return NotificationService;
}());
exports.NotificationService = NotificationService;
exports.notificationService = new NotificationService();
