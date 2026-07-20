/**
 * Business Suite Suppliers Service
 * Add supplier: name, wallet address, country, KYC status, contract type, tags.
 */

import { supabaseAdmin } from '../../config/supabase';
import {
  ensureGlobalSupplierIdForBusinessDetailed,
  generateSupplierDisplayId,
  resolveGlobalSupplierBusiness,
} from './supplierDisplayId.util';
import { businessSuiteService } from './businessSuite.service';
import type {
  SupplierAutocompleteItem,
  SupplierAutocompleteResponse,
  SupplierDetailItem,
  SupplierDetailsResponse,
  SupplierTransactionListItem,
  SupplierTransactionHistoryParams,
  SupplierTransactionHistoryResponse,
  ListSuppliersResponse,
  SupplierListItem,
  MySupplierIdResponse,
  GlobalSupplierLookupResponse,
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
  private normalizeCompanyName(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  /**
   * List saved suppliers for the authenticated business (includes supplierDisplayId for contract creation).
   * GET /api/business-suite/suppliers
   */
  async listSuppliers(userId: string): Promise<ListSuppliersResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No registered business for this account', error: 'No business' };
    }

    const client = supabaseAdmin!;
    const { data: rows, error } = await client
      .from('business_suppliers')
      .select(
        'id, supplier_display_id, name, wallet_address, country, kyc_status, contract_type, tags, created_at, supplier_business_id'
      )
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        success: false,
        message: error.message || 'Failed to fetch suppliers',
        error: error.message,
      };
    }

    const supplierBusinessIds = [
      ...new Set(
        (rows ?? [])
          .map((row) => row.supplier_business_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const globalIdByBusinessId: Record<string, string> = {};
    if (supplierBusinessIds.length > 0) {
      const { data: bizRows, error: bizErr } = await client
        .from('businesses')
        .select('id, global_supplier_id')
        .in('id', supplierBusinessIds);
      if (!bizErr) {
        for (const biz of bizRows ?? []) {
          if (biz.id && biz.global_supplier_id) {
            globalIdByBusinessId[biz.id as string] = biz.global_supplier_id as string;
          }
        }
      }
    }

    const items: SupplierListItem[] = (rows ?? [])
      .filter((row) => row.supplier_display_id)
      .map((row) => ({
        id: row.id,
        supplierDisplayId: row.supplier_display_id as string,
        globalSupplierId: row.supplier_business_id
          ? globalIdByBusinessId[row.supplier_business_id as string] ?? null
          : null,
        name: row.name,
        walletAddress: row.wallet_address ?? null,
        country: row.country ?? null,
        kycStatus: row.kyc_status ?? null,
        contractType: row.contract_type ?? null,
        tags: row.tags ?? null,
        createdAt: row.created_at,
      }));

    return {
      success: true,
      message: items.length > 0 ? 'Suppliers retrieved successfully' : 'No suppliers found',
      data: { items },
    };
  }

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
      supplierDisplayId: string;
      globalSupplierId?: string | null;
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
    let supplierDisplayId: string;
    try {
      supplierDisplayId = await generateSupplierDisplayId(client, businessId);
    } catch (e) {
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to generate supplier ID',
        error: 'ID generation failed',
      };
    }

    const { data: supplier, error } = await client
      .from('business_suppliers')
      .insert({
        business_id: businessId,
        user_id: userId,
        supplier_display_id: supplierDisplayId,
        supplier_business_id: supplierBusinessId,
        name,
        wallet_address: walletAddress,
        country,
        kyc_status: kycStatus,
        contract_type: contractType,
        tags,
        due_date: dueDate,
        amount_usd: amount,
      })
      .select('id, supplier_display_id, name, wallet_address, country, kyc_status, contract_type, tags, due_date, amount_usd')
      .single();

    if (error) {
      return { success: false, message: error.message || 'Failed to create supplier', error: error.message };
    }

    const globalResolved = await resolveGlobalSupplierBusiness(client, supplierBusinessId);

    return {
      success: true,
      message: 'Supplier added successfully',
      data: {
        id: supplier.id,
        supplierDisplayId: supplier.supplier_display_id,
        globalSupplierId: globalResolved?.globalSupplierId ?? null,
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
   * Autocomplete verified supplier businesses by company name.
   * GET /api/business-suite/suppliers/autocomplete?q=&limit= - prefix matches first, then alphabetical; excludes caller's business.
   */
  async autocompleteSupplierBusinesses(
    userId: string,
    query: string,
    limit = 10
  ): Promise<SupplierAutocompleteResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const trimmedQuery = typeof query === 'string' ? query.trim() : '';
    if (trimmedQuery.length < 1) {
      return {
        success: true,
        message: 'Type at least 1 character',
        data: { items: [] },
      };
    }

    const rawLimit = limit === undefined || limit === null || !Number.isFinite(Number(limit)) ? 10 : Math.floor(Number(limit));
    const cappedLimit = Math.min(20, Math.max(1, rawLimit));
    const client = supabaseAdmin!;

    const [ownBusinessId, { data: rows, error }] = await Promise.all([
      businessSuiteService.getBusinessId(userId),
      client
        .from('businesses')
        .select('id, company_name, status, global_supplier_id')
        .not('company_name', 'is', null)
        .ilike('company_name', `%${trimmedQuery}%`)
        .limit(100),
    ]);

    if (error) {
      return { success: false, message: error.message || 'Failed to fetch supplier suggestions', error: error.message };
    }

    const normalizedQuery = this.normalizeCompanyName(trimmedQuery);
    const items: SupplierAutocompleteItem[] = (rows || [])
      .filter((row) => row.company_name && row.id && row.id !== ownBusinessId)
      .map((row) => {
        const companyName = String(row.company_name).trim();
        const normalizedName = this.normalizeCompanyName(companyName);
        const status = typeof (row as any).status === 'string' ? String((row as any).status) : '';
        const isVerified = status.toLowerCase() === 'verified';
        const startsWith = normalizedName.startsWith(normalizedQuery);
        const includes = normalizedName.includes(normalizedQuery);
        const score = startsWith ? 0 : includes ? 1 : 2;
        return {
          businessId: row.id as string,
          companyName,
          normalizedName,
          score,
          isVerified,
          globalSupplierId: isVerified ? ((row as { global_supplier_id?: string | null }).global_supplier_id ?? null) : null,
        };
      })
      .filter((item) => item.normalizedName.includes(normalizedQuery))
      .filter((item) => item.companyName.length > 0)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
        const aName = a.companyName.toLowerCase();
        const bName = b.companyName.toLowerCase();
        return aName.localeCompare(bName);
      })
      .map(({ businessId, companyName, globalSupplierId }) => ({ businessId, companyName, globalSupplierId }))
      .slice(0, cappedLimit);

    return {
      success: true,
      message: items.length > 0 ? 'Supplier suggestions retrieved' : 'No matching suppliers found',
      data: { items },
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
    const escrowSelectWithSupplierBusiness = `
        id,
        amount_usd,
        progress,
        expected_completion_date,
        expected_release_date,
        created_at,
        contract_display_id,
        business_supplier_id,
        supplier_business_id
      `;
    const escrowSelectBase = `
        id,
        amount_usd,
        progress,
        expected_completion_date,
        expected_release_date,
        created_at,
        contract_display_id,
        business_supplier_id
      `;

    let rows: Array<Record<string, unknown>> | null = null;
    let error: { message: string } | null = null;

    ({ data: rows, error } = await client
      .from('escrows')
      .select(escrowSelectWithSupplierBusiness)
      .eq('user_id', userId)
      .eq('suite_context', 'business')
      .eq('transaction_type', 'supply')
      .order('created_at', { ascending: true }));

    if (error?.message?.toLowerCase().includes('supplier_business_id')) {
      ({ data: rows, error } = await client
        .from('escrows')
        .select(escrowSelectBase)
        .eq('user_id', userId)
        .eq('suite_context', 'business')
        .eq('transaction_type', 'supply')
        .order('created_at', { ascending: true }));
    }

    if (error?.message?.toLowerCase().includes('business_supplier_id')) {
      ({ data: rows, error } = await client
        .from('escrows')
        .select(`
        id,
        amount_usd,
        progress,
        expected_completion_date,
        expected_release_date,
        created_at,
        contract_display_id
      `)
        .eq('user_id', userId)
        .eq('suite_context', 'business')
        .eq('transaction_type', 'supply')
        .order('created_at', { ascending: true }));
    }

    if (error) {
      return { success: false, message: error.message || 'Failed to fetch supplier contract details', error: error.message };
    }
    const list = rows || [];

    const businessSupplierIds = [
      ...new Set(
        list
          .map((row) => row.business_supplier_id as string | null | undefined)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const supplierBusinessIds = [
      ...new Set(
        list
          .map((row) => row.supplier_business_id as string | null | undefined)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const suppDisplayById: Record<string, string> = {};
    if (businessSupplierIds.length > 0) {
      const { data: supplierRows } = await client
        .from('business_suppliers')
        .select('id, supplier_display_id')
        .in('id', businessSupplierIds);
      for (const s of supplierRows ?? []) {
        if (s.id && s.supplier_display_id) {
          suppDisplayById[s.id as string] = s.supplier_display_id as string;
        }
      }
    }

    const globalIdByBusinessId: Record<string, string> = {};
    if (supplierBusinessIds.length > 0) {
      const { data: bizRows, error: bizErr } = await client
        .from('businesses')
        .select('id, global_supplier_id')
        .in('id', supplierBusinessIds);
      if (!bizErr) {
        for (const biz of bizRows ?? []) {
          if (biz.id && biz.global_supplier_id) {
            globalIdByBusinessId[biz.id as string] = biz.global_supplier_id as string;
          }
        }
      }
    }

    const byYear = new Map<number, number>();
    const items: SupplierDetailItem[] = list.map((row) => {
      const createdAt = String(row.created_at ?? '');
      const expectedCompletion = (row.expected_completion_date as string | null) ?? null;
      const expectedRelease = (row.expected_release_date as string | null) ?? null;
      const amountUsd = row.amount_usd;
      const progress = row.progress as number | null;
      const contractDisplayId = (row.contract_display_id as string | null) ?? null;
      const businessSupplierId = (row.business_supplier_id as string | null | undefined) ?? null;
      const supplierBusinessId = (row.supplier_business_id as string | null | undefined) ?? null;

      let contractId = contractDisplayId?.trim() || null;
      if (!contractId && createdAt) {
        const year = new Date(createdAt).getUTCFullYear();
        const seq = (byYear.get(year) ?? 0) + 1;
        byYear.set(year, seq);
        contractId = `SC-${year}-${String(seq).padStart(3, '0')}`;
      }
      const supplierDisplayId =
        (businessSupplierId ? suppDisplayById[businessSupplierId] : null) ??
        (supplierBusinessId ? globalIdByBusinessId[supplierBusinessId] : null) ??
        null;
      const progressPct = progress != null ? Math.min(100, Math.max(0, Number(progress))) : 0;
      const dueDateIso = expectedCompletion || expectedRelease || null;
      const statusDetail = dueDateIso
        ? `Due date: ${formatDueDateShort(dueDateIso)}`
        : `${progressPct}%`;
      const amount = amountUsd != null ? parseFloat(String(amountUsd)) : 0;
      return {
        id: String(row.id),
        contractId: contractId ?? String(row.id),
        supplierDisplayId,
        supplierId: contractId ?? String(row.id),
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
      ? await client.from('business_suppliers').select('id, name, supplier_display_id').in('id', supplierIds)
      : { data: [] };
    const supplierMap = (suppliers || []).reduce<
      Record<string, { name: string; supplierDisplayId: string | null }>
    >((acc, s: { id: string; name: string; supplier_display_id?: string | null }) => {
      acc[s.id] = {
        name: s.name || '—',
        supplierDisplayId: s.supplier_display_id ?? null,
      };
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
      supplierName: supplierMap[row.supplier_id]?.name ?? '—',
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

  /**
   * Get this business's platform-wide supplier ID (BSUP-YYYY-NNNNN).
   * GET /api/business-suite/my-supplier-id
   */
  async getMySupplierId(userId: string): Promise<MySupplierIdResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    if (!businessId) {
      return { success: false, message: 'No registered business for this account', error: 'No business' };
    }

    const client = supabaseAdmin!;
    const result = await ensureGlobalSupplierIdForBusinessDetailed(client, businessId);
    if (!result.ok) {
      return { success: false, message: result.message, error: result.error };
    }

    return {
      success: true,
      message: 'Global supplier ID retrieved',
      data: { globalSupplierId: result.globalSupplierId },
    };
  }

  /**
   * Look up a registered supplier business by BSUP-YYYY-NNNNN (for contract creation).
   * GET /api/business-suite/suppliers/lookup/:globalSupplierId
   */
  async lookupGlobalSupplier(userId: string, globalSupplierId: string): Promise<GlobalSupplierLookupResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const ref = typeof globalSupplierId === 'string' ? globalSupplierId.trim() : '';
    if (!ref) {
      return { success: false, message: 'Global supplier ID is required', error: 'Missing ID' };
    }

    const ownBusinessId = await businessSuiteService.getBusinessId(userId);
    const client = supabaseAdmin!;
    const resolved = await resolveGlobalSupplierBusiness(client, ref);
    if (!resolved) {
      return {
        success: false,
        message: 'No verified supplier business found with this ID',
        error: 'Supplier not found',
      };
    }
    if (resolved.businessId === ownBusinessId) {
      return {
        success: false,
        message: 'This is your own business supplier ID',
        error: 'Same business',
      };
    }

    return {
      success: true,
      message: 'Supplier found',
      data: {
        globalSupplierId: resolved.globalSupplierId,
        companyName: resolved.companyName,
        walletAddress: resolved.walletAddress,
        status: resolved.status,
      },
    };
  }
}

export const businessSuiteSuppliersService = new BusinessSuiteSuppliersService();
