/**
 * Business Suite Service
 * Handles 6-digit PIN for switching into business suite (verify + set).
 */

import * as crypto from 'crypto';
import { supabaseAdmin } from '../../config/supabase';

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;

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

    const access = await this.ensureBusinessSuiteAccess(userId);
    if (!access.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: 'Not business suite' };
    }

    const { data: user, error: fetchError } = await client
      .from('users')
      .select('business_pin_hash')
      .eq('id', userId)
      .single();

    if (fetchError || !user) {
      return { success: false, message: 'User not found', error: 'User not found' };
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

    const access = await this.ensureBusinessSuiteAccess(userId);
    if (!access.allowed) {
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

  /** KYC statuses that grant business suite access. In review = suspended (no fetch, no operations). */
  private static readonly ALLOWED_KYC_STATUSES = ['Pending', 'Verified'] as const;

  /**
   * When business_suite_kyc has a row but businesses does not, create a businesses row so admin can see and change status.
   * Uses only columns that exist in migration 047 so sync works even if 048 (document URLs) is not applied yet.
   */
  private async syncBusinessRowFromKyc(userId: string): Promise<void> {
    const client = supabaseAdmin;
    if (!client) return;
    const { data: existing } = await client.from('businesses').select('id').eq('owner_user_id', userId).maybeSingle();
    if (existing) return;
    const { data: kycRow, error: selectError } = await client
      .from('business_suite_kyc')
      .select('company_name, business_description, company_logo_url, default_escrow_fee_rate, auto_release_period, approval_workflow, arbitration_type, transaction_limits, identity_verification_required, address_verification_required, enhanced_due_diligence, status, submitted_at, reviewed_at, reviewed_by, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (selectError || !kycRow) return;
    const now = new Date().toISOString();
    const basePayload = {
      owner_user_id: userId,
      status: (kycRow as any).status ?? 'Pending',
      company_name: (kycRow as any).company_name ?? null,
      business_description: (kycRow as any).business_description ?? null,
      company_logo_url: (kycRow as any).company_logo_url ?? null,
      default_escrow_fee_rate: (kycRow as any).default_escrow_fee_rate ?? null,
      auto_release_period: (kycRow as any).auto_release_period ?? null,
      approval_workflow: (kycRow as any).approval_workflow ?? null,
      arbitration_type: (kycRow as any).arbitration_type ?? null,
      transaction_limits: (kycRow as any).transaction_limits ?? null,
      identity_verification_required: Boolean((kycRow as any).identity_verification_required),
      address_verification_required: Boolean((kycRow as any).address_verification_required),
      enhanced_due_diligence: Boolean((kycRow as any).enhanced_due_diligence),
      submitted_at: (kycRow as any).submitted_at ?? null,
      reviewed_at: (kycRow as any).reviewed_at ?? null,
      reviewed_by: (kycRow as any).reviewed_by ?? null,
      updated_at: (kycRow as any).updated_at ?? now,
    };
    const { error: insertError } = await client.from('businesses').insert(basePayload);
    if (insertError) {
      console.warn('[BusinessSuite] sync business row from kyc insert failed:', insertError.message);
    }
  }

  /**
   * Public: ensure a businesses row exists when business_suite_kyc has one (so admin can see and change status). Idempotent.
   */
  async ensureBusinessRowSynced(userId: string): Promise<void> {
    await this.syncBusinessRowFromKyc(userId);
  }

  /**
   * Returns the business KYC status for a user (from businesses or business_suite_kyc). Null if none.
   * If only business_suite_kyc exists, syncs a row into businesses so admin can see it.
   */
  async getBusinessStatus(userId: string): Promise<string | null> {
    const client = supabaseAdmin;
    if (!client) return null;
    const { data: biz } = await client.from('businesses').select('status').eq('owner_user_id', userId).maybeSingle();
    if (biz?.status) return biz.status;
    const { data: kyc } = await client.from('business_suite_kyc').select('status').eq('user_id', userId).maybeSingle();
    if (kyc) {
      this.syncBusinessRowFromKyc(userId).catch((err) => console.warn('[BusinessSuite] sync business row from kyc:', err));
    }
    return kyc?.status ?? null;
  }

  /**
   * Returns whether the user is allowed to use business suite features (dashboard, teams, payrolls, suppliers, wallet).
   * Allowed when status is Pending or Verified. Blocked when In review or Rejected.
   */
  async ensureBusinessSuiteAccess(userId: string): Promise<{ allowed: boolean; error?: string }> {
    const client = supabaseAdmin;
    if (!client) return { allowed: false, error: 'No admin client' };
    const { data: biz, error: bizError } = await client
      .from('businesses')
      .select('status')
      .eq('owner_user_id', userId)
      .maybeSingle();
    if (!bizError && biz?.status && (BusinessSuiteService.ALLOWED_KYC_STATUSES as readonly string[]).includes(biz.status)) {
      return { allowed: true };
    }
    const { data: kyc } = await client
      .from('business_suite_kyc')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle();
    if (kyc?.status && (BusinessSuiteService.ALLOWED_KYC_STATUSES as readonly string[]).includes(kyc.status)) {
      return { allowed: true };
    }
    if (!biz && kyc) {
      await this.ensureBusinessRowSynced(userId).catch((err) => console.warn('[BusinessSuite] ensureBusinessRowSynced:', err));
    }
    const status = biz?.status ?? kyc?.status;
    if (status === 'In review') {
      return { allowed: false, error: 'Account is under review; access is temporarily suspended.' };
    }
    return { allowed: false, error: 'Not business suite' };
  }

  /**
   * Check whether the user has business suite access and whether they have a PIN set (for frontend to show set vs verify).
   * isBusinessSuite is true when account_type is business_suite/enterprise OR business_suite_kyc is Approved.
   */
  async getPinStatus(
    userId: string
  ): Promise<{ success: boolean; message: string; isBusinessSuite: boolean; pinSet: boolean; error?: string }> {
    const access = await this.ensureBusinessSuiteAccess(userId);
    if (!access.allowed) {
      return { success: true, message: 'OK', isBusinessSuite: false, pinSet: false };
    }
    const client = supabaseAdmin;
    if (!client) {
      return { success: false, message: 'Server configuration error', isBusinessSuite: true, pinSet: false, error: 'No admin client' };
    }
    const { data: user, error } = await client
      .from('users')
      .select('business_pin_hash')
      .eq('id', userId)
      .single();
    if (error || !user) {
      return { success: false, message: 'User not found', isBusinessSuite: true, pinSet: false, error: 'User not found' };
    }
    const pinSet = Boolean(user.business_pin_hash);
    return { success: true, message: 'OK', isBusinessSuite: true, pinSet };
  }
}

export const businessSuiteService = new BusinessSuiteService();
