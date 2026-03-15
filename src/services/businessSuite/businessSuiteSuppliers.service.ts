/**
 * Business Suite Suppliers Service
 * Add supplier: name, wallet address, country, KYC status, contract type, tags.
 */

import { supabaseAdmin } from '../../config/supabase';
import { businessSuiteService } from './businessSuite.service';
import type {
  SupplierDetailItem,
  SupplierDetailsResponse,
  SupplierTransactionListItem,
  SupplierTransactionHistoryParams,
  SupplierTransactionHistoryResponse,
} from '../../types/api/businessSuiteSuppliers.types';

const KYC_STATUSES = ['Not started', 'Pending', 'In review', 'Verified', 'Rejected'];
const CONTRACT_TYPES = ['One-time', 'Recurring', 'Framework', 'Master', 'Spot'];
const ALLOWED_TAGS = ['Local', 'International', 'Logistics', 'Digital', 'Manufacturing', 'Services', 'Wholesale', 'Retail', 'Preferred', 'Trial'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDueDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getUTCDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  const month = MONTHS_SHORT[d.getUTCMonth()];
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${day}${suffix} ${month} ${year}`;
}

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
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No registered business for this account', error: 'No business' };
    }
    const businessStatus = await businessSuiteService.getBusinessStatus(userId);
    if (businessStatus !== 'Verified') {
      return {
        success: false,
        message: 'Your business must be registered and verified to add suppliers',
        error: 'Business not verified',
      };
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return { success: false, message: 'Name is required (supplier or business name)', error: 'Missing name' };
    }
    const supplierBusinessId = await this.findRegisteredBusinessIdByCompanyName(name);
    if (!supplierBusinessId) {
      return {
        success: false,
        message: 'Supplier is not registered. Only verified businesses can be added as suppliers.',
        error: 'Supplier not registered',
      };
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
        business_id: businessId,
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

  /**
   * Check if a supplier (business) name is registered as a verified business.
   * Frontend can call this (e.g. on blur or before submit) to show "Supplier is not registered".
   * Match is case-insensitive on trimmed company_name; only Verified businesses count.
   */
  async checkSupplierRegistered(
    userId: string,
    name: string
  ): Promise<{ success: boolean; registered: boolean; message?: string; error?: string }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, registered: false, message: 'Business suite is not enabled', error: check.error };
    }
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
      return { success: false, registered: false, message: 'Name is required', error: 'Missing name' };
    }
    const client = supabaseAdmin!;
    const { data: rows } = await client
      .from('businesses')
      .select('id, company_name')
      .eq('status', 'Verified')
      .not('company_name', 'is', null);
    const matched = (rows || []).find(
      (b) => b.company_name && b.company_name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (matched) {
      return { success: true, registered: true, message: 'Supplier is registered' };
    }
    return {
      success: true,
      registered: false,
      message: 'Supplier is not registered',
    };
  }

  /**
   * Supplier contract details list from created supply escrows (cards with donut, SUPP-YYYY-NNN, due date/%, amount).
   * GET /api/business-suite/suppliers/details
   */
  async getSupplierDetails(userId: string): Promise<SupplierDetailsResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const client = supabaseAdmin!;
    const { data: rows, error } = await client
      .from('escrows')
      .select('id, amount_usd, progress, expected_completion_date, expected_release_date, created_at')
      .eq('user_id', userId)
      .eq('suite_context', 'business')
      .eq('transaction_type', 'supply')
      .order('created_at', { ascending: true });
    if (error) {
      return { success: false, message: error.message || 'Failed to fetch supplier contract details', error: error.message };
    }
    const list = rows || [];
    const byYear = new Map<number, number>();
    const items: SupplierDetailItem[] = list.map((row: {
      id: string;
      created_at: string;
      expected_completion_date: string | null;
      expected_release_date: string | null;
      amount_usd: string | number;
      progress: number | null;
    }) => {
      const year = new Date(row.created_at).getUTCFullYear();
      const seq = (byYear.get(year) ?? 0) + 1;
      byYear.set(year, seq);
      const supplierId = `SUPP-${year}-${String(seq).padStart(3, '0')}`;
      const progressPct = row.progress != null ? Math.min(100, Math.max(0, Number(row.progress))) : 0;
      const dueDateIso = row.expected_completion_date || row.expected_release_date || null;
      const statusDetail = dueDateIso
        ? `Due date: ${formatDueDateShort(dueDateIso)}`
        : `${progressPct}%`;
      const amount = row.amount_usd != null ? parseFloat(String(row.amount_usd)) : 0;
      return {
        id: row.id,
        supplierId,
        progressPercentage: progressPct,
        statusDetail,
        amount,
        dueDate: dueDateIso,
      };
    });
    return {
      success: true,
      message: 'Supplier contract details retrieved',
      data: { items },
    };
  }

  /**
   * Supplier transaction history for the Supplier transaction history UI.
   * Returns only rows from business_supplier_transactions (payments to/from suppliers), not payroll.
   * GET /api/business-suite/suppliers/transactions?page=1&pageSize=20&month=YYYY-MM&status=Successful
   */
  async getSupplierTransactionHistory(
    userId: string,
    params: SupplierTransactionHistoryParams = {}
  ): Promise<SupplierTransactionHistoryResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No registered business for this account', error: 'No business' };
    }
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const client = supabaseAdmin!;

    let query = client
      .from('business_supplier_transactions')
      .select('id, supplier_id, amount_xrp, amount_usd, status, type, created_at', { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (params.month) {
      const [y, m] = params.month.split('-').map(Number);
      if (y && m) {
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0, 23, 59, 59);
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }

    const from = (page - 1) * pageSize;
    const { data: rows, error, count } = await query.range(from, from + pageSize - 1);
    if (error) {
      return { success: false, message: error.message || 'Failed to fetch supplier transactions', error: error.message };
    }
    const list = rows || [];
    const supplierIds = [...new Set(list.map((r: { supplier_id: string }) => r.supplier_id))];
    const { data: suppliers } = supplierIds.length > 0
      ? await client.from('business_suppliers').select('id, name').in('id', supplierIds)
      : { data: [] };
    const supplierMap = (suppliers || []).reduce<Record<string, string>>((acc, s: { id: string; name: string }) => {
      acc[s.id] = s.name || '—';
      return acc;
    }, {});

    function formatTransactionId(txId: string): string {
      const hex = txId.replace(/-/g, '');
      if (hex.length <= 12) return txId;
      return `${hex.slice(0, 6)}...${hex.slice(-6)}`;
    }

    const items: SupplierTransactionListItem[] = list.map((row: {
      id: string;
      supplier_id: string;
      amount_xrp: string | number | null;
      amount_usd: string | number;
      status: string;
      type: string;
      created_at: string;
    }) => ({
      id: row.id,
      transactionId: formatTransactionId(row.id),
      supplierName: supplierMap[row.supplier_id] ?? '—',
      amountXrp: row.amount_xrp != null ? parseFloat(String(row.amount_xrp)) : null,
      amountUsd: parseFloat(String(row.amount_usd)),
      status: row.status || 'Successful',
      type: (row.type === 'Sent' ? 'Sent' : 'Received') as 'Received' | 'Sent',
      createdAt: row.created_at,
    }));

    const total = count ?? 0;
    return {
      success: true,
      message: 'Supplier transaction history retrieved',
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  /** Returns verified business id if company name matches (case-insensitive), else null. */
  async findRegisteredBusinessIdByCompanyName(name: string): Promise<string | null> {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) return null;
    const client = supabaseAdmin!;
    const { data: rows } = await client
      .from('businesses')
      .select('id, company_name')
      .eq('status', 'Verified')
      .not('company_name', 'is', null);
    const matched = (rows || []).find(
      (b) => b.company_name && b.company_name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    return matched?.id ?? null;
  }
}

export const businessSuiteSuppliersService = new BusinessSuiteSuppliersService();
