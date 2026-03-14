/**
 * Business Suite Supply Contracts
 * Create Supplier Contract (modal steps 1–2): contract info + payment terms → escrow with transaction_type = 'supply'.
 */

import { supabaseAdmin } from '../../config/supabase';
import { businessSuiteService } from './businessSuite.service';
import { escrowService } from '../escrow/escrow.service';
import type {
  CreateSupplierContractRequest,
  CreateSupplierContractResponse,
  ReleaseCondition,
} from '../../types/api/businessSuiteDashboard.types';
import type { CreateEscrowRequest, ReleaseType } from '../../types/api/escrow.types';

const RELEASE_CONDITION_TO_TYPE: Record<ReleaseCondition, ReleaseType> = {
  'Buyer confirms delivery': 'Manual Release',
  'Time based': 'Time based',
  Milestones: 'Milestones',
};

export class BusinessSuiteSupplyContractsService {
  /**
   * Create a supplier contract (escrow with transaction_type = 'supply'). Maps modal Contract Info + Payment Terms to escrow.
   * Supplier must be a registered business on Trustichain; counterparty = that business's owner.
   */
  async createSupplierContract(
    userId: string,
    body: CreateSupplierContractRequest
  ): Promise<CreateSupplierContractResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No registered business for this account', error: 'No business' };
    }

    const supplierName = typeof body.supplierName === 'string' ? body.supplierName.trim() : '';
    if (!supplierName) {
      return { success: false, message: 'Supplier name is required (must be a registered business on Trustichain)', error: 'Missing supplier name' };
    }

    const client = supabaseAdmin!;
    const { data: businesses } = await client
      .from('businesses')
      .select('id, owner_user_id, company_name')
      .eq('status', 'Verified')
      .not('company_name', 'is', null);
    const normalized = supplierName.toLowerCase();
    const biz = (businesses || []).find(
      (b) => b.company_name && b.company_name.trim().toLowerCase() === normalized
    );
    if (!biz?.owner_user_id) {
      return {
        success: false,
        message: 'Supplier must be a registered business on Trustichain. No verified business found with that name.',
        error: 'Supplier not registered',
      };
    }

    const counterpartyUserId = biz.owner_user_id;
    if (counterpartyUserId === userId) {
      return { success: false, message: 'You cannot create a supply contract with your own business', error: 'Same business' };
    }

    const walletAddress = typeof body.supplierWalletAddress === 'string' ? body.supplierWalletAddress.trim() : '';
    if (!walletAddress || !walletAddress.startsWith('r') || walletAddress.length < 25) {
      return { success: false, message: 'Supplier wallet address must be a valid XRPL address', error: 'Invalid wallet address' };
    }

    const paymentAmount = Number(body.paymentAmount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return { success: false, message: 'Payment amount must be a positive number', error: 'Invalid payment amount' };
    }

    const currency = body.currency === 'USDT' ? 'USD' : body.currency;
    const releaseType = RELEASE_CONDITION_TO_TYPE[body.releaseCondition] ?? 'Manual Release';

    const request: CreateEscrowRequest = {
      counterpartyXrpWalletAddress: walletAddress,
      counterpartyId: counterpartyUserId,
      amount: paymentAmount,
      currency: currency as 'USD' | 'XRP',
      description: body.contractDescription || body.contractTitle || undefined,
      transactionType: 'supply',
      suiteContext: 'business',
      counterpartyName: supplierName,
      counterpartyEmail: body.supplierEmail?.trim() || undefined,
      releaseType,
      expectedCompletionDate: body.deliveryDeadline ? parseDeliveryDeadline(body.deliveryDeadline) : undefined,
      expectedReleaseDate: body.deliveryDeadline && releaseType === 'Time based' ? parseDeliveryDeadline(body.deliveryDeadline) : undefined,
      disputeResolutionPeriod: body.disputeWindow || undefined,
      releaseConditions: body.releaseCondition || undefined,
    };

    const result = await escrowService.createEscrow(userId, request);
    if (!result.success || !result.data?.escrowId) {
      return {
        success: false,
        message: result.message || 'Failed to create supply contract escrow',
        error: result.error,
      };
    }

    const escrowId = result.data.escrowId;
    const documentUrls = Array.isArray(body.contractDocumentUrls)
      ? body.contractDocumentUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      : [];
    await client
      .from('escrows')
      .update({
        contract_title: body.contractTitle?.trim() || null,
        delivery_method: body.deliveryMethod || null,
        contract_document_urls: documentUrls.length > 0 ? documentUrls : null,
      })
      .eq('id', escrowId);

    const { data: escrow } = await client
      .from('escrows')
      .select('created_at, escrow_sequence')
      .eq('id', escrowId)
      .single();

    const year = escrow?.created_at ? new Date(escrow.created_at).getUTCFullYear() : new Date().getUTCFullYear();
    const { count } = await client
      .from('escrows')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('transaction_type', 'supply')
      .gte('created_at', `${year}-01-01`)
      .lte('created_at', `${year}-12-31T23:59:59.999Z`);
    const seq = count ?? 0;
    const contractId = `SUPP-${year}-${String(seq).padStart(3, '0')}`;

    return {
      success: true,
      message: 'Supplier contract created',
      data: {
        escrowId,
        contractId,
        amountUsd: result.data.amount?.usd ?? paymentAmount,
        amountXrp: result.data.amount?.xrp ?? null,
        status: result.data.status ?? 'pending',
      },
    };
  }
}

function parseDeliveryDeadline(value: string): string | undefined {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return undefined;
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00.000Z`;
  }
  const iso = new Date(s);
  return isNaN(iso.getTime()) ? undefined : iso.toISOString();
}

export const businessSuiteSupplyContractsService = new BusinessSuiteSupplyContractsService();
