"use strict";
/**
 * Storage Service
 * Handles file uploads to Supabase Storage
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
exports.storageService = exports.StorageService = void 0;
var supabase_1 = require("../../config/supabase");
var uuid_1 = require("uuid");
// Allowed file types for dispute evidence
var ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
    'video/mp4',
    'video/quicktime',
    'audio/mpeg',
    'audio/wav',
];
var MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
var StorageService = /** @class */ (function () {
    function StorageService() {
        this.BUCKET_NAME = 'dispute-evidence';
    }
    /**
     * Validate file before upload
     */
    StorageService.prototype.validateFile = function (file) {
        if (!file) {
            return { valid: false, error: 'No file provided' };
        }
        if (file.size > MAX_FILE_SIZE) {
            return {
                valid: false,
                error: "File size exceeds maximum allowed size of ".concat(MAX_FILE_SIZE / (1024 * 1024), "MB"),
            };
        }
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            return {
                valid: false,
                error: "File type not allowed. Allowed types: ".concat(ALLOWED_MIME_TYPES.join(', ')),
            };
        }
        return { valid: true };
    };
    /**
     * Generate unique file path for storage
     */
    StorageService.prototype.generateFilePath = function (userId, originalFileName) {
        var timestamp = Date.now();
        var uniqueId = (0, uuid_1.v4)().substring(0, 8);
        var sanitizedFileName = originalFileName
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .substring(0, 50); // Limit filename length
        return "".concat(userId, "/").concat(timestamp, "-").concat(uniqueId, "-").concat(sanitizedFileName);
    };
    /**
     * Ensure storage bucket exists
     */
    StorageService.prototype.ensureBucketExists = function () {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, _a, buckets, listError, bucketExists, createError;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        if (!adminClient) {
                            throw new Error('Supabase admin client not available');
                        }
                        return [4 /*yield*/, adminClient.storage.listBuckets()];
                    case 1:
                        _a = _b.sent(), buckets = _a.data, listError = _a.error;
                        if (listError) {
                            console.error('Error listing buckets:', listError);
                            throw new Error('Failed to check storage buckets');
                        }
                        bucketExists = buckets === null || buckets === void 0 ? void 0 : buckets.some(function (bucket) { return bucket.name === _this.BUCKET_NAME; });
                        if (!!bucketExists) return [3 /*break*/, 3];
                        return [4 /*yield*/, adminClient.storage.createBucket(this.BUCKET_NAME, {
                                public: false, // Private bucket - files accessible via signed URLs
                                fileSizeLimit: MAX_FILE_SIZE,
                                allowedMimeTypes: ALLOWED_MIME_TYPES,
                            })];
                    case 2:
                        createError = (_b.sent()).error;
                        if (createError) {
                            console.error('Error creating bucket:', createError);
                            throw new Error('Failed to create storage bucket');
                        }
                        _b.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Upload file to Supabase Storage
     */
    StorageService.prototype.uploadFile = function (userId, file) {
        return __awaiter(this, void 0, void 0, function () {
            var validation, adminClient, filePath, _a, data, uploadError, urlData, fileUrl, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        validation = this.validateFile(file);
                        if (!validation.valid) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: validation.error || 'File validation failed',
                                    error: validation.error || 'File validation failed',
                                }];
                        }
                        // Ensure bucket exists
                        return [4 /*yield*/, this.ensureBucketExists()];
                    case 1:
                        // Ensure bucket exists
                        _b.sent();
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        if (!adminClient) {
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Storage service not available',
                                    error: 'Storage service not available',
                                }];
                        }
                        filePath = this.generateFilePath(userId, file.originalname);
                        return [4 /*yield*/, adminClient.storage
                                .from(this.BUCKET_NAME)
                                .upload(filePath, file.buffer, {
                                contentType: file.mimetype,
                                upsert: false, // Don't overwrite existing files
                            })];
                    case 2:
                        _a = _b.sent(), data = _a.data, uploadError = _a.error;
                        if (uploadError || !data) {
                            console.error('Error uploading file:', uploadError);
                            return [2 /*return*/, {
                                    success: false,
                                    message: 'Failed to upload file to storage',
                                    error: (uploadError === null || uploadError === void 0 ? void 0 : uploadError.message) || 'Upload failed',
                                }];
                        }
                        urlData = adminClient.storage
                            .from(this.BUCKET_NAME)
                            .getPublicUrl(data.path).data;
                        fileUrl = urlData.publicUrl || "".concat(this.BUCKET_NAME, "/").concat(data.path);
                        return [2 /*return*/, {
                                success: true,
                                message: 'File uploaded successfully',
                                data: {
                                    fileUrl: fileUrl,
                                    fileName: file.originalname,
                                    fileSize: file.size,
                                    fileType: file.mimetype,
                                },
                            }];
                    case 3:
                        error_1 = _b.sent();
                        console.error('Error in uploadFile:', error_1);
                        return [2 /*return*/, {
                                success: false,
                                message: error_1 instanceof Error ? error_1.message : 'Failed to upload file',
                                error: error_1 instanceof Error ? error_1.message : 'Failed to upload file',
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Generate signed URL for private file access
     */
    StorageService.prototype.getSignedUrl = function (filePath_1) {
        return __awaiter(this, arguments, void 0, function (filePath, expiresIn) {
            var adminClient, _a, data, error, error_2;
            if (expiresIn === void 0) { expiresIn = 3600; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        if (!adminClient) {
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, adminClient.storage
                                .from(this.BUCKET_NAME)
                                .createSignedUrl(filePath, expiresIn)];
                    case 1:
                        _a = _b.sent(), data = _a.data, error = _a.error;
                        if (error || !data) {
                            console.error('Error generating signed URL:', error);
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, data.signedUrl];
                    case 2:
                        error_2 = _b.sent();
                        console.error('Error in getSignedUrl:', error_2);
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Delete file from storage
     */
    StorageService.prototype.deleteFile = function (filePath) {
        return __awaiter(this, void 0, void 0, function () {
            var adminClient, path, error, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        adminClient = supabase_1.supabaseAdmin || supabase_1.supabase;
                        if (!adminClient) {
                            return [2 /*return*/, false];
                        }
                        path = filePath.includes('/') ? filePath.split("".concat(this.BUCKET_NAME, "/"))[1] || filePath : filePath;
                        return [4 /*yield*/, adminClient.storage.from(this.BUCKET_NAME).remove([path])];
                    case 1:
                        error = (_a.sent()).error;
                        if (error) {
                            console.error('Error deleting file:', error);
                            return [2 /*return*/, false];
                        }
                        return [2 /*return*/, true];
                    case 2:
                        error_3 = _a.sent();
                        console.error('Error in deleteFile:', error_3);
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return StorageService;
}());
exports.StorageService = StorageService;
exports.storageService = new StorageService();
