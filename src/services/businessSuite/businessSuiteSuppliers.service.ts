/**
 * Business Suite Suppliers Service
 * Add supplier: name, wallet address, country, KYC status, contract type, tags.
 */

import { supabaseAdmin } from '../../config/supabase';
import { businessSuiteService } from './businessSuite.service';

const KYC_STATUSES = ['Not started', 'Pending', 'In review', 'Verified', 'Rejected'];
const CONTRACT_TYPES = ['One-time', 'Recurring', 'Framework', 'Master', 'Spot'];
const ALLOWED_TAGS = ['Local', 'International', 'Logistics', 'Digital', 'Manufacturing', 'Services', 'Wholesale', 'Retail', 'Preferred', 'Trial'];

export interface CreateSupplierRequest {
  /** Supplier or business name */
  name: string;
  /** XRPL wallet address (e.g. rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX) */
  walletAddress?: string;
  /** Country name */
  country?: string;
  /** KYC status */
  kycStatus?: 'Not started' | 'Pending' | 'In review' | 'Verified' | 'Rejected';
  /** Contract type */
  contractType?: 'One-time' | 'Recurring' | 'Framework' | 'Master' | 'Spot';
  /** Tags (e.g. local, international, logistics, digital) */
  tags?: string[];
  /** Optional: due date (YYYY-MM-DD) - for Create New Supplier flow */
  dueDate?: string;
  /** Optional: amount USD - for Create New Supplier flow */
  amount?: number;
}

export class BusinessSuiteSuppliersService {
  /**
   * Create a new supplier. POST /api/business-suite/suppliers
   * Supports Add supplier UI: name, walletAddress, country, kycStatus, contractType, tags.
   * Also supports legacy: dueDate, amount.
   */
  async createSupplier(
    userId: string,
    body: CreateSupplierRequest
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      id: string;
      name: string;
      walletAddress: string | null;
      country: string | null;
      kycStatus: string | null;
      contractType: string | null;
      tags: string[] | null;
      dueDate?: string | null;
      amountUsd?: number | null;
    };
    error?: string;
  }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return { success: false, message: 'Name is required (supplier or business name)', error: 'Missing name' };
    }

    let walletAddress: string | null = null;
    if (body.walletAddress != null && body.walletAddress !== '') {
      const w = String(body.walletAddress).trim();
      if (w.startsWith('0x')) {
        return { success: false, message: 'Invalid wallet: use XRPL address (starts with r), not Ethereum', error: 'Invalid wallet address' };
      }
      if (!w.startsWith('r') || w.length < 25 || w.length > 35) {
        return { success: false, message: 'Wallet address must be a valid XRPL address (starts with r, 25-35 characters)', error: 'Invalid wallet address' };
      }
      walletAddress = w;
    }

    const country = typeof body.country === 'string' ? body.country.trim() || null : null;
    let kycStatus: string | null = null;
    const kycRaw = body.kycStatus != null ? String(body.kycStatus).trim() : '';
    if (kycRaw && KYC_STATUSES.includes(kycRaw)) kycStatus = kycRaw;

    let contractType: string | null = null;
    const contractRaw = body.contractType != null ? String(body.contractType).trim() : '';
    if (contractRaw && CONTRACT_TYPES.includes(contractRaw)) contractType = contractRaw;

    let tags: string[] | null = null;
    if (Array.isArray(body.tags) && body.tags.length > 0) {
      tags = body.tags
        .map((t) => (typeof t === 'string' ? t.trim() : ''))
        .filter(Boolean)
        .filter((t) => ALLOWED_TAGS.some((a) => a.toLowerCase() === t.toLowerCase()));
      if (tags.length === 0) tags = null;
    }

    const dueDate =
      typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate.trim()) ? body.dueDate.trim() : null;
    const amount =
      body.amount != null && Number.isFinite(Number(body.amount)) && Number(body.amount) >= 0
        ? Number(body.amount)
        : null;

    const client = supabaseAdmin!;
    const { data: supplier, error } = await client
      .from('business_suppliers')
      .insert({
        user_id: userId,
        name,
        wallet_address: walletAddress,
        country,
        kyc_status: kycStatus,
        contract_type: contractType,
        tags,
        due_date: dueDate,
        amount_usd: amount,
      })
      .select('id, name, wallet_address, country, kyc_status, contract_type, tags, due_date, amount_usd')
      .single();

    if (error) {
      return { success: false, message: error.message || 'Failed to create supplier', error: error.message };
    }

    return {
      success: true,
      message: 'Supplier added successfully',
      data: {
        id: supplier.id,
        name: supplier.name,
        walletAddress: supplier.wallet_address ?? null,
        country: supplier.country ?? null,
        kycStatus: supplier.kyc_status ?? null,
        contractType: supplier.contract_type ?? null,
        tags: supplier.tags ?? null,
        dueDate: supplier.due_date ?? null,
        amountUsd: supplier.amount_usd != null ? Number(supplier.amount_usd) : null,
      },
    };
  }
}

export const businessSuiteSuppliersService = new BusinessSuiteSuppliersService();
