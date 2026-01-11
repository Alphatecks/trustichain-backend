"use strict";
/**
 * Encryption Service
 * Handles encryption/decryption of sensitive data like wallet secrets
 * Uses AES-256-GCM for authenticated encryption
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionService = exports.EncryptionService = void 0;
var crypto = require("crypto");
var EncryptionService = /** @class */ (function () {
    function EncryptionService() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16; // 128 bits
        this.saltLength = 64; // 512 bits
        this.tagLength = 16; // 128 bits
        this.tagPosition = this.saltLength + this.ivLength;
        this.encryptedPosition = this.tagPosition + this.tagLength;
    }
    /**
     * Get encryption key from environment variable
     * Falls back to a default key (NOT SECURE for production)
     */
    EncryptionService.prototype.getEncryptionKey = function () {
        var key = process.env.ENCRYPTION_KEY;
        if (!key) {
            console.warn('WARNING: ENCRYPTION_KEY not set. Using default key (NOT SECURE for production!)');
            // Default key for development only - MUST be changed in production
            return crypto.scryptSync('default-key-change-in-production', 'salt', this.keyLength);
        }
        // If key is provided as hex string, convert it
        if (key.length === 64) {
            return Buffer.from(key, 'hex');
        }
        // Otherwise derive key from the provided string
        return crypto.scryptSync(key, 'trustichain-wallet-encryption', this.keyLength);
    };
    /**
     * Encrypt sensitive data (wallet secret)
     */
    EncryptionService.prototype.encrypt = function (plaintext) {
        try {
            var key = this.getEncryptionKey();
            var iv = crypto.randomBytes(this.ivLength);
            var salt = crypto.randomBytes(this.saltLength);
            var cipher = crypto.createCipheriv(this.algorithm, key, iv);
            var encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            var tag = cipher.getAuthTag();
            // Combine salt + iv + tag + encrypted data
            var result = Buffer.concat([
                salt,
                iv,
                tag,
                Buffer.from(encrypted, 'hex'),
            ]).toString('base64');
            return result;
        }
        catch (error) {
            console.error('Error encrypting data:', error);
            throw new Error('Encryption failed');
        }
    };
    /**
     * Decrypt sensitive data (wallet secret)
     */
    EncryptionService.prototype.decrypt = function (encryptedData) {
        try {
            var key = this.getEncryptionKey();
            var data = Buffer.from(encryptedData, 'base64');
            // Extract components
            // Skip salt (reserved for future key derivation) - start from saltLength
            var iv = data.subarray(this.saltLength, this.tagPosition);
            var tag = data.subarray(this.tagPosition, this.encryptedPosition);
            var encrypted = data.subarray(this.encryptedPosition);
            var decipher = crypto.createDecipheriv(this.algorithm, key, iv);
            decipher.setAuthTag(tag);
            var decrypted = decipher.update(encrypted, undefined, 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            console.error('Error decrypting data:', error);
            throw new Error('Decryption failed');
        }
    };
    /**
     * Generate a secure encryption key (for setting ENCRYPTION_KEY env var)
     */
    EncryptionService.generateKey = function () {
        return crypto.randomBytes(32).toString('hex');
    };
    return EncryptionService;
}());
exports.EncryptionService = EncryptionService;
exports.encryptionService = new EncryptionService();
