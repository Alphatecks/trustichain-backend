/**
 * Validation utilities for signed transaction formats
 */

/**
 * UUID pattern (8-4-4-4-12 hexadecimal digits)
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates if a string looks like a UUID
 */
export function isUUID(str: string): boolean {
  return UUID_PATTERN.test(str);
}

/**
 * Validates if a string looks like a transaction ID (UUID format)
 */
export function looksLikeTransactionId(value: any): boolean {
  if (typeof value !== 'string') return false;
  return isUUID(value);
}

/**
 * Validates if a string could be a valid hex transaction blob
 * XRPL transaction blobs are typically 1000+ characters long
 */
export function couldBeHexBlob(value: any): boolean {
  if (typeof value !== 'string') return false;
  // Hex strings should be at least 100 characters and contain only hex digits
  return value.length >= 100 && /^[0-9A-Fa-f]+$/.test(value);
}

/**
 * Validates if a value could be a valid JSON transaction object
 */
export function couldBeJsonTransaction(value: any): boolean {
  if (typeof value === 'object' && value !== null) {
    // Check if it has TransactionType field (XRPL transaction indicator)
    return 'TransactionType' in value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null && 'TransactionType' in parsed;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Validates signed transaction format and returns validation result
 */
export function validateSignedTransactionFormat(value: any): {
  valid: boolean;
  error?: string;
  detectedFormat?: 'uuid' | 'hex' | 'json' | 'object' | 'unknown';
} {
  // Check for null/undefined
  if (value === null || value === undefined) {
    return {
      valid: false,
      error: 'Signed transaction blob is required',
      detectedFormat: 'unknown',
    };
  }

  // Check if it's a UUID (transaction ID mistake)
  if (looksLikeTransactionId(value)) {
    return {
      valid: false,
      error: 'Invalid signed transaction format. You appear to be sending a transaction ID (UUID) instead of the signed transaction blob from MetaMask. Please ensure you are sending the actual signed transaction returned by MetaMask/XRPL Snap (e.g., { tx_blob: "..." } or the signed transaction object).',
      detectedFormat: 'uuid',
    };
  }

  // Check if it's a valid hex blob
  if (couldBeHexBlob(value)) {
    return {
      valid: true,
      detectedFormat: 'hex',
    };
  }

  // Check if it's a valid JSON transaction
  if (couldBeJsonTransaction(value)) {
    return {
      valid: true,
      detectedFormat: typeof value === 'object' ? 'object' : 'json',
    };
  }

  // Check if it's too short to be valid
  if (typeof value === 'string' && value.length < 50) {
    return {
      valid: false,
      error: `Invalid signed transaction format. Transaction blob appears too short (${value.length} characters). Expected a signed transaction from MetaMask/XRPL Snap (hex string 1000+ chars or transaction object).`,
      detectedFormat: 'unknown',
    };
  }

  // If it's an object but doesn't have TransactionType, it might be wrapped
  if (typeof value === 'object' && value !== null) {
    // Check for common wrapper formats
    if ('tx_blob' in value || 'signedTransaction' in value || 'transaction' in value) {
      return {
        valid: true,
        detectedFormat: 'object',
      };
    }
  }

  // Unknown format
  return {
    valid: false,
    error: `Invalid signed transaction format. Expected a signed transaction from MetaMask/XRPL Snap (hex string, transaction object, or wrapped format like { tx_blob: "..." }). Got: ${typeof value === 'string' ? value.substring(0, 100) + '...' : JSON.stringify(value).substring(0, 100) + '...'}`,
    detectedFormat: 'unknown',
  };
}
