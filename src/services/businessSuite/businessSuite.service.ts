/**
 * Business Suite Service
 * Handles 6-digit PIN for switching into business suite (verify + set).
 */

import * as crypto from 'crypto';
import { supabaseAdmin } from '../../config/supabase';

const BUSINESS_SUITE_TYPES = ['business_suite', 'enterprise'];
const PIN_LENGTH = 6;
const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;

function isBusinessSuite(accountType: string | null): boolean {
  return accountType != null && BUSINESS_SUITE_TYPES.includes(accountType);
}

function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

function hashPin(pin: string, userId: string): string {
  const pepper = process.env.BUSINESS_PIN_PEPPER || 'trustichain-business-pin-v1';
  const salt = `${pepper}:${userId}`;
  return crypto.scryptSync(pin, salt, SCRYPT_KEYLEN, { N: SCRYPT_COST }).toString('hex');
}

function verifyPinHash(pin: string, userId: string, storedHash: string): boolean {
  const computed = hashPin(pin, userId);
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedHash, 'hex'));
}

export class BusinessSuiteService {
  /**
   * Verify the user's 6-digit business suite PIN (e.g. when switching from personal to business).
   * User must have business_suite/enterprise account_type and have a PIN set.
   */
  async verifyPin(
    userId: string,
    pin: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    const client = supabaseAdmin;
    if (!client) {
      return { success: false, message: 'Server configuration error', error: 'No admin client' };
    }

    if (!isValidPin(pin)) {
      return { success: false, message: 'PIN must be exactly 6 digits', error: 'Invalid format' };
    }

    const { data: user, error: fetchError } = await client
      .from('users')
      .select('account_type, business_pin_hash')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return { success: false, message: 'User not found', error: 'User not found' };
    }

    if (!isBusinessSuite(user.account_type)) {
      return { success: false, message: 'Business suite is not enabled for this account', error: 'Not business suite' };
    }

    if (!user.business_pin_hash) {
      return { success: false, message: 'Business PIN has not been set. Set your PIN first.', error: 'PIN not set' };
    }

    try {
      const valid = verifyPinHash(pin, userId, user.business_pin_hash);
      if (!valid) {
        return { success: false, message: 'Invalid PIN', error: 'Invalid PIN' };
      }
      return { success: true, message: 'PIN verified' };
    } catch {
      return { success: false, message: 'Invalid PIN', error: 'Invalid PIN' };
    }
  }

  /**
   * Set or update the 6-digit business suite PIN. User must have business_suite/enterprise.
   */
  async setPin(
    userId: string,
    pin: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    const client = supabaseAdmin;
    if (!client) {
      return { success: false, message: 'Server configuration error', error: 'No admin client' };
    }

    if (!isValidPin(pin)) {
      return { success: false, message: 'PIN must be exactly 6 digits', error: 'Invalid format' };
    }

    const { data: user, error: fetchError } = await client
      .from('users')
      .select('account_type')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return { success: false, message: 'User not found', error: 'User not found' };
    }

    if (!isBusinessSuite(user.account_type)) {
      return { success: false, message: 'Business suite is not enabled for this account', error: 'Not business suite' };
    }

    const businessPinHash = hashPin(pin, userId);
    const { error: updateError } = await client
      .from('users')
      .update({ business_pin_hash: businessPinHash, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      return { success: false, message: 'Failed to save PIN', error: updateError.message };
    }
    return { success: true, message: 'PIN set successfully' };
  }

  /**
   * Check whether the user has business suite and whether they have a PIN set (for frontend to show set vs verify).
   */
  async getPinStatus(
    userId: string
  ): Promise<{ success: boolean; message: string; isBusinessSuite: boolean; pinSet: boolean; error?: string }> {
    const client = supabaseAdmin;
    if (!client) {
      return { success: false, message: 'Server configuration error', isBusinessSuite: false, pinSet: false, error: 'No admin client' };
    }

    const { data: user, error } = await client
      .from('users')
      .select('account_type, business_pin_hash')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return { success: false, message: 'User not found', isBusinessSuite: false, pinSet: false, error: 'User not found' };
    }

    const isBiz = isBusinessSuite(user.account_type);
    const pinSet = Boolean(user.business_pin_hash);
    return { success: true, message: 'OK', isBusinessSuite: isBiz, pinSet };
  }
}

export const businessSuiteService = new BusinessSuiteService();
