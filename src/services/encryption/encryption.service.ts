/**
 * Encryption Service
 * Handles encryption/decryption of sensitive data like wallet secrets
 * Uses AES-256-GCM for authenticated encryption
 */

import * as crypto from 'crypto';

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly saltLength = 64; // 512 bits
  private readonly tagLength = 16; // 128 bits
  private readonly tagPosition = this.saltLength + this.ivLength;
  private readonly encryptedPosition = this.tagPosition + this.tagLength;

  /**
   * Get encryption key from environment variable
   * Falls back to a default key (NOT SECURE for production)
   */
  private getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    
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
  }

  /**
   * Encrypt sensitive data (wallet secret)
   */
  encrypt(plaintext: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.ivLength);
      const salt = crypto.randomBytes(this.saltLength);

      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      // Combine salt + iv + tag + encrypted data
      const result = Buffer.concat([
        salt,
        iv,
        tag,
        Buffer.from(encrypted, 'hex'),
      ]).toString('base64');

      return result;
    } catch (error) {
      console.error('Error encrypting data:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt sensitive data (wallet secret)
   */
  decrypt(encryptedData: string): string {
    try {
      const key = this.getEncryptionKey();
      const data = Buffer.from(encryptedData, 'base64');

      // Extract components
      // Skip salt (reserved for future key derivation) - start from saltLength
      const iv = data.subarray(this.saltLength, this.tagPosition);
      const tag = data.subarray(this.tagPosition, this.encryptedPosition);
      const encrypted = data.subarray(this.encryptedPosition);

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Error decrypting data:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Generate a secure encryption key (for setting ENCRYPTION_KEY env var)
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

export const encryptionService = new EncryptionService();
