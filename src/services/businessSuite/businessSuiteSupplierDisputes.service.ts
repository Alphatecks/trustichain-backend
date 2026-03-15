/**
 * File dispute for suppliers: resolve supplier reference (ID or name) to escrow + respondent, then create dispute.
 */

import { supabaseAdmin } from '../../config/supabase';
import { businessSuiteService } from './businessSuite.service';
import { disputeService } from '../dispute/dispute.service';
import type { FileSupplierDisputeRequest, FileSupplierDisputeResponse } from '../../types/api/businessSuiteDashboard.types';
import type { CreateDisputeRequest, DisputeCategory, DisputeReasonType } from '../../types/api/dispute.types';

export class BusinessSuiteSupplierDisputesService {
  /**
   * File a dispute against a supplier. Resolves supplier reference (SUPP-YYYY-NNN or business name) to a supply escrow.
   */
  async fileSupplierDispute(userId: string, body: FileSupplierDisputeRequest): Promise<FileSupplierDisputeResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const ref = (body.supplierReference ?? '').trim();
    if (!ref) {
      return { success: false, message: 'Supplier reference ID or name is required', error: 'Missing supplier reference' };
    }
    if (!(body.reason ?? '').trim()) {
      return { success: false, message: 'Reason is required', error: 'Missing reason' };
    }
    if (!(body.description ?? '').trim()) {
      return { success: false, message: 'Description is required', error: 'Missing description' };
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { success: false, message: 'Amount must be greater than 0', error: 'Invalid amount' };
    }

    const client = supabaseAdmin!;
    let escrow: { id: string; counterparty_id: string | null } | null = null;

    const suppMatch = ref.match(/^SUPP-(\d{4})-(\d{3})$/i);
    if (suppMatch) {
      const year = parseInt(suppMatch[1], 10);
      const seq = parseInt(suppMatch[2], 10);
      const { data: rows } = await client
        .from('escrows')
        .select('id, counterparty_id')
        .eq('user_id', userId)
        .eq('transaction_type', 'supply')
        .gte('created_at', `${year}-01-01`)
        .lte('created_at', `${year}-12-31T23:59:59.999Z`)
        .order('created_at', { ascending: true });
      const list = rows || [];
      if (seq < 1 || seq > list.length) {
        return { success: false, message: 'No supply contract found with this supplier reference', error: 'Escrow not found' };
      }
      escrow = list[seq - 1];
    } else {
      const { data: businesses } = await client
        .from('businesses')
        .select('id, owner_user_id, company_name')
        .not('company_name', 'is', null);
      const normalized = ref.toLowerCase();
      const biz = (businesses || []).find(
        (b) => b.company_name && b.company_name.trim().toLowerCase() === normalized
      );
      if (!biz?.owner_user_id) {
        return { success: false, message: 'No registered business found with this name', error: 'Supplier not found' };
      }
      const respondentId = biz.owner_user_id;
      if (respondentId === userId) {
        return { success: false, message: 'You cannot file a dispute with your own business', error: 'Invalid supplier' };
      }
      const { data: escrowRow } = await client
        .from('escrows')
        .select('id, counterparty_id')
        .eq('user_id', userId)
        .eq('counterparty_id', respondentId)
        .eq('transaction_type', 'supply')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!escrowRow) {
        return { success: false, message: 'No supply contract found with this supplier. Create a supply contract first.', error: 'Escrow not found' };
      }
      escrow = escrowRow;
    }

    if (!escrow?.id || !escrow.counterparty_id) {
      return { success: false, message: 'Supply contract or counterparty not found', error: 'Invalid escrow' };
    }

    const { data: payerWallet } = await client
      .from('wallets')
      .select('xrpl_address')
      .eq('user_id', userId)
      .eq('suite_context', 'business')
      .maybeSingle();
    if (!payerWallet?.xrpl_address) {
      return { success: false, message: 'Business wallet not found. Connect a business wallet first.', error: 'Payer wallet not found' };
    }

    const { data: respondentWallet } = await client
      .from('wallets')
      .select('xrpl_address')
      .eq('user_id', escrow.counterparty_id)
      .maybeSingle();
    if (!respondentWallet?.xrpl_address) {
      return { success: false, message: 'Supplier wallet not found. The supplier must have a registered wallet.', error: 'Respondent wallet not found' };
    }

    const { data: payerUser } = await client.from('users').select('full_name, email').eq('id', userId).single();
    const { data: respondentUser } = await client.from('users').select('full_name, email').eq('id', escrow.counterparty_id).single();

    const request: CreateDisputeRequest = {
      escrowId: escrow.id,
      disputeCategory: 'product_purchase' as DisputeCategory,
      disputeReasonType: 'payment_dispute' as DisputeReasonType,
      payerXrpWalletAddress: payerWallet.xrpl_address,
      payerName: payerUser?.full_name ?? undefined,
      payerEmail: payerUser?.email ?? undefined,
      respondentXrpWalletAddress: respondentWallet.xrpl_address,
      respondentName: respondentUser?.full_name ?? undefined,
      respondentEmail: respondentUser?.email ?? undefined,
      disputeReason: body.reason.trim(),
      amount,
      currency: body.currency,
      description: body.description.trim(),
      evidence: body.evidence,
    };

    const result = await disputeService.createDispute(userId, request);
    if (!result.success) {
      return {
        success: false,
        message: result.message ?? 'Failed to create dispute',
        error: result.error,
      };
    }
    return {
      success: true,
      message: 'Dispute filed successfully',
      data: result.data ? { disputeId: result.data.disputeId, caseId: result.data.caseId } : undefined,
    };
  }
}

export const businessSuiteSupplierDisputesService = new BusinessSuiteSupplierDisputesService();
