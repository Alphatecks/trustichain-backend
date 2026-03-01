/**
 * Business Suite KYC Service
 * Get and submit business suite KYC (uses business_suite_kyc table, not user_kyc).
 */

import { supabaseAdmin } from '../../config/supabase';

const APPROVAL_WORKFLOWS = ['single', 'dual', 'multi'];
const ARBITRATION_TYPES = ['binding', 'non-binding', 'mediation'];

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
  identityVerificationDocumentUrl?: string;
  addressVerificationDocumentUrl?: string;
  enhancedDueDiligenceDocumentUrl?: string;
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
  identityVerificationDocumentUrl: string | null;
  addressVerificationDocumentUrl: string | null;
  enhancedDueDiligenceDocumentUrl: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapRowToResponse(row: any): BusinessSuiteKycResponse {
  const userId = row.owner_user_id ?? row.user_id;
  return {
    id: row.id,
    userId,
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
    identityVerificationDocumentUrl: row.identity_verification_document_url ?? null,
    addressVerificationDocumentUrl: row.address_verification_document_url ?? null,
    enhancedDueDiligenceDocumentUrl: row.enhanced_due_diligence_document_url ?? null,
    submittedAt: row.submitted_at ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BusinessSuiteKycService {
  /**
   * Get current business suite KYC for the user. GET /api/business-suite/kyc
   * Allowed for any authenticated user (so they can view/edit before or after business suite upgrade).
   */
  async getKyc(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: BusinessSuiteKycResponse;
    error?: string;
  }> {
    const client = supabaseAdmin;
    if (!client) return { success: false, message: 'Service unavailable', error: 'No admin client' };
    const { data: row, error } = await client
      .from('businesses')
      .select('*')
      .eq('owner_user_id', userId)
      .maybeSingle();
    if (error) {
      const fallback = await client.from('business_suite_kyc').select('*').eq('user_id', userId).maybeSingle();
      if (fallback.error || !fallback.data) {
        return { success: false, message: error.message || 'Failed to fetch KYC', error: error.message };
      }
      if (fallback.data.status === 'In review') {
        return { success: false, message: 'Account is under review; access is temporarily suspended.', error: 'Account under review' };
      }
      return { success: true, message: 'KYC retrieved', data: mapRowToResponse(fallback.data) };
    }
    if (!row) {
      const { data: legacyRow } = await client.from('business_suite_kyc').select('*').eq('user_id', userId).maybeSingle();
      if (legacyRow) {
        if (legacyRow.status === 'In review') {
          return { success: false, message: 'Account is under review; access is temporarily suspended.', error: 'Account under review' };
        }
        return { success: true, message: 'KYC retrieved', data: mapRowToResponse(legacyRow) };
      }
      return { success: true, message: 'No KYC record yet', data: undefined };
    }
    if (row.status === 'In review') {
      return { success: false, message: 'Account is under review; access is temporarily suspended.', error: 'Account under review' };
    }
    return { success: true, message: 'KYC retrieved', data: mapRowToResponse(row) };
  }

  /**
   * Submit or update business suite KYC. POST /api/business-suite/kyc
   * Allowed for any authenticated user (verification can be submitted before account is upgraded to business_suite).
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
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';
    if (!companyName) {
      return { success: false, message: 'companyName is required', error: 'Missing companyName' };
    }
    const client = supabaseAdmin;
    if (!client) return { success: false, message: 'Service unavailable', error: 'No admin client' };

    const defaultEscrowFeeRate =
      body.defaultEscrowFeeRate != null && body.defaultEscrowFeeRate !== ''
        ? String(body.defaultEscrowFeeRate).trim().replace(/%\s*$/, '')
        : null;
    const approvalWorkflow =
      body.approvalWorkflow && APPROVAL_WORKFLOWS.includes(body.approvalWorkflow) ? body.approvalWorkflow : null;
    const arbitrationType =
      body.arbitrationType && ARBITRATION_TYPES.includes(body.arbitrationType) ? body.arbitrationType : null;

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
      identity_verification_document_url: body.identityVerificationDocumentUrl?.trim() || null,
      address_verification_document_url: body.addressVerificationDocumentUrl?.trim() || null,
      enhanced_due_diligence_document_url: body.enhancedDueDiligenceDocumentUrl?.trim() || null,
      status: 'Pending',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: existingBiz } = await client
      .from('businesses')
      .select('id, status')
      .eq('owner_user_id', userId)
      .maybeSingle();

    if (existingBiz?.status === 'In review') {
      return { success: false, message: 'Account is under review; you cannot update KYC while under review.', error: 'Account under review' };
    }
    if (!existingBiz) {
      const { data: legacyKyc } = await client.from('business_suite_kyc').select('status').eq('user_id', userId).maybeSingle();
      if (legacyKyc?.status === 'In review') {
        return { success: false, message: 'Account is under review; you cannot update KYC while under review.', error: 'Account under review' };
      }
    }

    let resultRow: any;
    if (existingBiz) {
      const { data: updated, error: updateError } = await client
        .from('businesses')
        .update(payload)
        .eq('owner_user_id', userId)
        .select()
        .single();
      if (updateError) {
        return { success: false, message: updateError.message || 'Failed to update KYC', error: updateError.message };
      }
      resultRow = updated;
    } else {
      const { data: inserted, error: insertError } = await client
        .from('businesses')
        .insert({ owner_user_id: userId, ...payload })
        .select()
        .single();
      if (insertError) {
        return { success: false, message: insertError.message || 'Failed to submit KYC', error: insertError.message };
      }
      resultRow = inserted;
    }

    await client
      .from('business_suite_kyc')
      .upsert(
        { user_id: userId, ...payload },
        { onConflict: 'user_id' }
      );

    return {
      success: true,
      message: existingBiz ? 'KYC updated and submitted for review' : 'KYC submitted for review',
      data: mapRowToResponse(resultRow),
    };
  }
}

export const businessSuiteKycService = new BusinessSuiteKycService();
