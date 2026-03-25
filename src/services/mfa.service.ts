import * as crypto from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { supabaseAdmin } from '../config/supabase';

const AES = 'aes-256-gcm';
const MFA_LOGIN_TTL_SEC = 10 * 60; // 10 minutes

export interface MfaLoginPayload {
  userId: string;
  email: string;
  access_token: string;
  refresh_token: string;
  exp: number;
}

function getEncryptionKey(): Buffer {
  const hex = process.env.MFA_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(
      'MFA_ENCRYPTION_KEY must be set to 64 hexadecimal characters (32 bytes) for MFA.'
    );
  }
  return Buffer.from(hex, 'hex');
}

/** Encrypt arbitrary UTF-8 string for DB storage (IV + tag + ciphertext, base64). */
export function encryptSecret(plain: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(AES, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(blob: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(blob, 'base64');
  if (buf.length < 32) {
    throw new Error('Invalid encrypted blob');
  }
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const data = buf.subarray(32);
  const decipher = crypto.createDecipheriv(AES, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function createMfaLoginToken(payload: Omit<MfaLoginPayload, 'exp'>): string {
  const exp = Math.floor(Date.now() / 1000) + MFA_LOGIN_TTL_SEC;
  const full: MfaLoginPayload = { ...payload, exp };
  return encryptSecret(JSON.stringify(full));
}

export function parseMfaLoginToken(token: string): MfaLoginPayload | null {
  try {
    const json = decryptSecret(token);
    const parsed = JSON.parse(json) as MfaLoginPayload;
    if (
      !parsed.userId ||
      !parsed.email ||
      !parsed.access_token ||
      !parsed.refresh_token ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (Math.floor(Date.now() / 1000) > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function requireAdmin() {
  if (!supabaseAdmin) {
    throw new Error('MFA requires Supabase service role (supabaseAdmin) to be configured.');
  }
  return supabaseAdmin;
}

export class MfaService {
  private issuerName(): string {
    return process.env.MFA_APP_NAME?.trim() || 'TrustiChain';
  }

  /**
   * Start TOTP enrollment: store pending secret, return secret + otpauth URL for the app.
   */
  async setup(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: { secret: string; otpauthUrl?: string };
    error?: string;
  }> {
    try {
      requireAdmin();
      getEncryptionKey();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'MFA not configured';
      return { success: false, message: msg, error: 'MFA configuration error' };
    }

    const { data: row, error: fetchError } = await supabaseAdmin!
      .from('users')
      .select('email, mfa_enabled')
      .eq('id', userId)
      .single();

    if (fetchError || !row) {
      return { success: false, message: 'User not found', error: 'Not found' };
    }

    if (row.mfa_enabled) {
      return {
        success: false,
        message: 'MFA is already enabled. Disable it before enrolling again.',
        error: 'MFA already enabled',
      };
    }

    const secret = generateSecret();
    const pendingEnc = encryptSecret(secret);

    const { error: upError } = await supabaseAdmin!.from('users').update({
      mfa_pending_secret_encrypted: pendingEnc,
      mfa_secret_encrypted: null,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);

    if (upError) {
      return { success: false, message: 'Failed to save MFA setup', error: upError.message };
    }

    const email = row.email as string;
    const otpauthUrl = generateURI({
      issuer: this.issuerName(),
      label: email,
      secret,
    });

    return {
      success: true,
      message: 'Scan the QR code or enter the secret in your authenticator app.',
      data: { secret, otpauthUrl },
    };
  }

  /**
   * Complete enrollment with a valid TOTP code.
   */
  async verifySetup(userId: string, code: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      requireAdmin();
      getEncryptionKey();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'MFA not configured';
      return { success: false, message: msg, error: 'MFA configuration error' };
    }

    const normalized = String(code).replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalized)) {
      return { success: false, message: 'Invalid code format (expect 6 digits)', error: 'Validation failed' };
    }

    const { data: row, error: fetchError } = await supabaseAdmin!
      .from('users')
      .select('mfa_pending_secret_encrypted, mfa_enabled')
      .eq('id', userId)
      .single();

    if (fetchError || !row) {
      return { success: false, message: 'User not found', error: 'Not found' };
    }

    if (row.mfa_enabled) {
      return { success: false, message: 'MFA is already enabled', error: 'Already enabled' };
    }

    const pendingEnc = row.mfa_pending_secret_encrypted as string | null;
    if (!pendingEnc) {
      return {
        success: false,
        message: 'No MFA setup in progress. Call POST /api/user/mfa/setup first.',
        error: 'No pending setup',
      };
    }

    let secretPlain: string;
    try {
      secretPlain = decryptSecret(pendingEnc);
    } catch {
      return { success: false, message: 'Failed to read pending secret', error: 'Decryption failed' };
    }

    const result = verifySync({
      secret: secretPlain,
      token: normalized,
    });

    if (!result.valid) {
      return { success: false, message: 'Invalid authenticator code', error: 'Invalid code' };
    }

    const secretStored = encryptSecret(secretPlain);

    const { error: upError } = await supabaseAdmin!.from('users').update({
      mfa_enabled: true,
      mfa_secret_encrypted: secretStored,
      mfa_pending_secret_encrypted: null,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);

    if (upError) {
      return { success: false, message: 'Failed to enable MFA', error: upError.message };
    }

    return { success: true, message: 'Two-factor authentication is now enabled.' };
  }

  /**
   * Disable MFA after verifying a current TOTP code.
   */
  async disable(userId: string, code: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      requireAdmin();
      getEncryptionKey();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'MFA not configured';
      return { success: false, message: msg, error: 'MFA configuration error' };
    }

    const normalized = String(code).replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalized)) {
      return { success: false, message: 'Invalid code format (expect 6 digits)', error: 'Validation failed' };
    }

    const { data: row, error: fetchError } = await supabaseAdmin!
      .from('users')
      .select('mfa_enabled, mfa_secret_encrypted')
      .eq('id', userId)
      .single();

    if (fetchError || !row) {
      return { success: false, message: 'User not found', error: 'Not found' };
    }

    if (!row.mfa_enabled) {
      return { success: false, message: 'MFA is not enabled', error: 'MFA not enabled' };
    }

    const enc = row.mfa_secret_encrypted as string | null;
    if (!enc) {
      return { success: false, message: 'MFA data inconsistent; contact support', error: 'Invalid state' };
    }

    let secretPlain: string;
    try {
      secretPlain = decryptSecret(enc);
    } catch {
      return { success: false, message: 'Failed to read MFA secret', error: 'Decryption failed' };
    }

    const result = verifySync({
      secret: secretPlain,
      token: normalized,
    });

    if (!result.valid) {
      return { success: false, message: 'Invalid authenticator code', error: 'Invalid code' };
    }

    const { error: upError } = await supabaseAdmin!.from('users').update({
      mfa_enabled: false,
      mfa_secret_encrypted: null,
      mfa_pending_secret_encrypted: null,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);

    if (upError) {
      return { success: false, message: 'Failed to disable MFA', error: upError.message };
    }

    return { success: true, message: 'Two-factor authentication has been disabled.' };
  }

  /**
   * Verify TOTP for a user who has MFA enabled (login second step).
   */
  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    if (!supabaseAdmin) {
      return false;
    }
    try {
      getEncryptionKey();
    } catch {
      return false;
    }

    const normalized = String(code).replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalized)) {
      return false;
    }

    const { data: row } = await supabaseAdmin
      .from('users')
      .select('mfa_enabled, mfa_secret_encrypted')
      .eq('id', userId)
      .single();

    if (!row?.mfa_enabled || !row.mfa_secret_encrypted) {
      return false;
    }

    let secretPlain: string;
    try {
      secretPlain = decryptSecret(row.mfa_secret_encrypted as string);
    } catch {
      return false;
    }

    const result = verifySync({
      secret: secretPlain,
      token: normalized,
    });
    return result.valid;
  }

}

export const mfaService = new MfaService();
