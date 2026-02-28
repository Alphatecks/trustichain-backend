/**
 * Business Suite KYC Service
 * Get and submit business suite KYC (uses business_suite_kyc table, not user_kyc).
 */

import { supabaseAdmin } from '../../config/supabase';

const BUSINESS_SUITE_TYPES = ['business_suite', 'enterprise'];
const APPROVAL_WORKFLOWS = ['single', 'dual', 'multi'];
const ARBITRATION_TYPES = ['binding', 'non-binding', 'mediation'];

function isBusinessSuite(accountType: string | null): boolean {
  return accountType != null && BUSINESS_SUITE_TYPES.includes(accountType);
}

export interface BusinessSuiteKycVerificationRequest {
  companyName: string;
  businessDescription?: string;
  companyLogoUrl?: string;
  defaultEscrowFeeRate?: string;
  autoReleasePeriod?: string;
  approvalWorkflow?: 'single' | 'dual' | 'multi';
  arbitrationType?: 'binding' | 'non-binding' | 'mediation';
  transactionLimits?: string;
  identityVerificationRequired?: boolean;
  addressVerificationRequired?: boolean;
  enhancedDueDiligence?: boolean;
}

export interface BusinessSuiteKycResponse {
  id: string;
  userId: string;
  status: string;
  companyName: string | null;
  businessDescription: string | null;
  companyLogoUrl: string | null;
  defaultEscrowFeeRate: string | null;
  autoReleasePeriod: string | null;
  approvalWorkflow: string | null;
  arbitrationType: string | null;
  transactionLimits: string | null;
  identityVerificationRequired: boolean;
  addressVerificationRequired: boolean;
  enhancedDueDiligence: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRowToResponse(row: any): BusinessSuiteKycResponse {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    companyName: row.company_name ?? null,
    businessDescription: row.business_description ?? null,
    companyLogoUrl: row.company_logo_url ?? null,
    defaultEscrowFeeRate: row.default_escrow_fee_rate ?? null,
    autoReleasePeriod: row.auto_release_period ?? null,
    approvalWorkflow: row.approval_workflow ?? null,
    arbitrationType: row.arbitration_type ?? null,
    transactionLimits: row.transaction_limits ?? null,
    identityVerificationRequired: row.identity_verification_required ?? false,
    addressVerificationRequired: row.address_verification_required ?? false,
    enhancedDueDiligence: row.enhanced_due_diligence ?? false,
    submittedAt: row.submitted_at ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BusinessSuiteKycService {
  private async ensureBusinessSuite(userId: string): Promise<{ allowed: boolean; error?: string }> {
    const client = supabaseAdmin;
    if (!client) return { allowed: false, error: 'No admin client' };
    const { data: user, error } = await client
      .from('users')
      .select('account_type')
      .eq('id', userId)
      .single();
    if (error || !user) return { allowed: false, error: 'User not found' };
    if (!isBusinessSuite(user.account_type)) return { allowed: false, error: 'Not business suite' };
    return { allowed: true };
  }

  /**
   * Get current business suite KYC for the user. GET /api/business-suite/kyc
   */
  async getKyc(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: BusinessSuiteKycResponse;
    error?: string;
  }> {
    const check = await this.ensureBusinessSuite(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const client = supabaseAdmin!;
    const { data: row, error } = await client
      .from('business_suite_kyc')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      return { success: false, message: error.message || 'Failed to fetch KYC', error: error.message };
    }
    if (!row) {
      return {
        success: true,
        message: 'No KYC record yet',
        data: undefined,
      };
    }
    return {
      success: true,
      message: 'KYC retrieved',
      data: mapRowToResponse(row),
    };
  }

  /**
   * Submit or update business suite KYC. POST /api/business-suite/kyc
   */
  async submitKyc(
    userId: string,
    body: BusinessSuiteKycVerificationRequest
  ): Promise<{
    success: boolean;
    message: string;
    data?: BusinessSuiteKycResponse;
    error?: string;
  }> {
    const check = await this.ensureBusinessSuite(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
    if (!companyName) {
      return { success: false, message: 'companyName is required', error: 'Missing companyName' };
    }

    const defaultEscrowFeeRate =
      body.defaultEscrowFeeRate != null && body.defaultEscrowFeeRate !== ''
        ? String(body.defaultEscrowFeeRate).trim().replace(/%\s*$/, '')
        : null;
    const approvalWorkflow =
      body.approvalWorkflow && APPROVAL_WORKFLOWS.includes(body.approvalWorkflow) ? body.approvalWorkflow : null;
    const arbitrationType =
      body.arbitrationType && ARBITRATION_TYPES.includes(body.arbitrationType) ? body.arbitrationType : null;

    const client = supabaseAdmin!;
    const { data: existing } = await client
      .from('business_suite_kyc')
      .select('id, status')
      .eq('user_id', userId)
      .maybeSingle();

    const payload = {
      company_name: companyName,
      business_description: body.businessDescription?.trim() || null,
      company_logo_url: body.companyLogoUrl?.trim() || null,
      default_escrow_fee_rate: defaultEscrowFeeRate,
      auto_release_period: body.autoReleasePeriod?.trim() || null,
      approval_workflow: approvalWorkflow,
      arbitration_type: arbitrationType,
      transaction_limits: body.transactionLimits?.trim() || null,
      identity_verification_required: Boolean(body.identityVerificationRequired),
      address_verification_required: Boolean(body.addressVerificationRequired),
      enhanced_due_diligence: Boolean(body.enhancedDueDiligence),
      status: 'Pending',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { data: updated, error: updateError } = await client
        .from('business_suite_kyc')
        .update(payload)
        .eq('user_id', userId)
        .select()
        .single();
      if (updateError) {
        return { success: false, message: updateError.message || 'Failed to update KYC', error: updateError.message };
      }
      return {
        success: true,
        message: 'KYC updated and submitted for review',
        data: mapRowToResponse(updated),
      };
    }

    const { data: inserted, error: insertError } = await client
      .from('business_suite_kyc')
      .insert({
        user_id: userId,
        ...payload,
      })
      .select()
      .single();
    if (insertError) {
      return { success: false, message: insertError.message || 'Failed to submit KYC', error: insertError.message };
    }
    return {
      success: true,
      message: 'KYC submitted for review',
      data: mapRowToResponse(inserted),
    };
  }
}

export const businessSuiteKycService = new BusinessSuiteKycService();
