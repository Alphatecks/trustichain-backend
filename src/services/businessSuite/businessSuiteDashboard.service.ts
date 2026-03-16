/**
 * Business Suite Dashboard Service
 * Summary and activity list for the business suite dashboard (requires business_suite/enterprise or approved business_suite_kyc).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../../config/supabase';
import { storageService } from '../storage/storage.service';
import { businessSuiteService } from './businessSuite.service';
import { walletService } from '../wallet/wallet.service';
import { trustiscoreService } from '../trustiscore/trustiscore.service';
import { emailService } from '../email.service';
import type {
  BusinessSuiteDashboardSummaryResponse,
  BusinessSuiteActivityListResponse,
  BusinessSuiteActivityListParams,
  BusinessSuiteActivityListItem,
  BusinessSuiteActivityStatus,
  BusinessSuitePortfolioPeriod,
  BusinessSuitePortfolioDataPoint,
  BusinessSuiteSupplyOrSubscriptionItem,
  BusinessSuiteUpcomingSupplyResponse,
  BusinessSuiteSubscriptionListResponse,
  SupplyContractEscrowedToMeItem,
  SupplyContractsEscrowedToMeResponse,
  SupplyContractDetailForSupplier,
  SupplyContractDetailForSupplierResponse,
  SupplyContractDetailForContractor,
  SupplyContractDetailForContractorResponse,
  SupplyContractsCreatedByMeResponse,
  SupplierContractOverviewResponse,
} from '../../types/api/businessSuiteDashboard.types';

const ESCROW_STATUS_TO_ACTIVITY: Record<string, BusinessSuiteActivityStatus> = {
  pending: 'Pending',
  active: 'In progress',
  completed: 'Completed',
  cancelled: 'Pending',
  disputed: 'In progress',
};

function formatEscrowId(year: number, sequence: number): string {
  return `ESC-${year}-${sequence.toString().padStart(3, '0')}`;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTRACT_ID_REGEX = /^(?:SUPP|SC)-(\d{4})-(\d+)$/i;

/** Resolve escrow identifier (UUID or SUPP-YYYY-NNN / SC-YYYY-NNN) to escrow UUID for counterparty (supplier). */
async function resolveSupplyContractEscrowIdForCounterparty(
  client: SupabaseClient,
  identifier: string,
  counterpartyUserId: string
): Promise<string | null> {
  const trimmed = identifier.trim();
  if (UUID_REGEX.test(trimmed)) {
    const { data } = await client
      .from('escrows')
      .select('id')
      .eq('id', trimmed)
      .eq('counterparty_id', counterpartyUserId)
      .eq('suite_context', 'business')
      .eq('transaction_type', 'supply')
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  }
  const match = trimmed.match(CONTRACT_ID_REGEX);
  if (!match) return null;
  const [, yearStr, seqStr] = match;
  const year = parseInt(yearStr!, 10);
  const seq = parseInt(seqStr!, 10);
  if (!year || !seq || seq < 1) return null;
  const start = `${year}-01-01T00:00:00.000Z`;
  const end = `${year + 1}-01-01T00:00:00.000Z`;
  const { data: rows } = await client
    .from('escrows')
    .select('id')
    .eq('counterparty_id', counterpartyUserId)
    .eq('suite_context', 'business')
    .eq('transaction_type', 'supply')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: true });
  const list = (rows || []) as { id: string }[];
  const row = list[seq - 1];
  return row?.id ?? null;
}

/** Normalize contract_document_urls from DB (array or Postgres text[] string like "{url1,url2}"). */
function normalizeContractDocumentUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((u): u is string => typeof u === 'string' && u.length > 0);
  }
  if (typeof value === 'string' && value.trim()) {
    const s = value.trim();
    const inner = s.startsWith('{') && s.endsWith('}') ? s.slice(1, -1) : s;
    if (!inner) return [];
    return inner.split(',').map((u) => u.trim().replace(/^"|"$/g, '')).filter(Boolean);
  }
  return [];
}

function formatActivityDate(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  const year = String(d.getUTCFullYear()).slice(-2);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${day}${suffix} ${month} ${year}`;
}

function formatDateShort(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const day = d.getUTCDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return `${day}${suffix} ${month}`;
}

export class BusinessSuiteDashboardService {
  /**
   * Dashboard summary for business suite: only escrows with suite_context = 'business'.
   * Balance and trustiscore remain user-level; all escrow-derived stats are business-only.
   * Access: account_type business_suite/enterprise OR business_suite_kyc status Approved.
   */
  async getDashboardSummary(userId: string): Promise<BusinessSuiteDashboardSummaryResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const businessId = await businessSuiteService.getBusinessId(userId);
    const client = supabaseAdmin!;
    const now = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [
      balanceResult,
      trustiscoreResult,
      { data: activeEscrowRows },
      { data: allBusinessEscrowRows },
      { count: payrollsCreated },
      { count: supplierCount },
      { count: completedThisMonth },
    ] = await Promise.all([
      walletService.getBalance(userId, 'business'),
      trustiscoreService.getTrustiscore(userId),
      client.from('escrows').select('amount_usd').eq('suite_context', 'business').or(`user_id.eq.${userId},counterparty_id.eq.${userId}`).in('status', ['pending', 'active']),
      client.from('escrows').select('amount_usd').eq('suite_context', 'business').or(`user_id.eq.${userId},counterparty_id.eq.${userId}`),
      client.from('escrows').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('suite_context', 'business'),
      businessId
        ? client.from('business_suppliers').select('*', { count: 'exact', head: true }).eq('business_id', businessId)
        : Promise.resolve({ count: 0 }),
      client.from('escrows').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('suite_context', 'business').eq('status', 'completed').gte('updated_at', thisMonthStart.toISOString()),
    ]);

    if (!balanceResult.success || !balanceResult.data) {
      return { success: false, message: 'Failed to fetch balance', error: balanceResult.error };
    }
    if (!trustiscoreResult.success || !trustiscoreResult.data) {
      return { success: false, message: 'Failed to fetch trustiscore', error: trustiscoreResult.error };
    }

    const activeCount = activeEscrowRows?.length ?? 0;
    const lockedAmount = activeEscrowRows?.reduce((sum: number, r: { amount_usd: string | number }) => sum + parseFloat(String(r.amount_usd)), 0) ?? 0;
    const totalEscrowed = allBusinessEscrowRows?.reduce((sum: number, r: { amount_usd: string | number }) => sum + parseFloat(String(r.amount_usd)), 0) ?? 0;

    return {
      success: true,
      message: 'Business suite dashboard summary retrieved',
      data: {
        balance: balanceResult.data.balance,
        activeEscrows: { count: activeCount, lockedAmount: parseFloat(lockedAmount.toFixed(2)) },
        trustiscore: { score: trustiscoreResult.data.score, level: trustiscoreResult.data.level },
        totalEscrowed: parseFloat(totalEscrowed.toFixed(2)),
        payrollsCreated: payrollsCreated ?? 0,
        suppliers: supplierCount ?? 0,
        completedThisMonth: completedThisMonth ?? 0,
      },
    };
  }

  /**
   * Paginated activity list (escrows created by this business user).
   */
  async getActivityList(userId: string, params: BusinessSuiteActivityListParams): Promise<BusinessSuiteActivityListResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const client = supabaseAdmin!;
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
    const sortBy = params.sortBy ?? 'created_at';
    const sortOrder = params.sortOrder ?? 'desc';
    const statusFilter = params.status;

    const selectCols = 'id, user_id, counterparty_id, status, created_at, updated_at, escrow_sequence, description, payer_name, counterparty_name, amount_usd';
    let query = client
      .from('escrows')
      .select(selectCols, { count: 'exact' })
      .eq('user_id', userId)
      .eq('suite_context', 'business');

    if (statusFilter) {
      const escrowStatuses = statusFilter === 'Pending' ? ['pending', 'cancelled'] : statusFilter === 'In progress' ? ['active', 'disputed'] : ['completed'];
      query = query.in('status', escrowStatuses);
    }

    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    const from = (page - 1) * pageSize;
    const { data: rows, error, count } = await query.range(from, from + pageSize - 1);

    if (error) {
      return { success: false, message: error.message, error: error.message };
    }

    const list = rows || [];
    const counterpartyIds = list
      .map((e: { counterparty_id: string | null }) => e.counterparty_id)
      .filter(Boolean) as string[];
    const { data: users } = counterpartyIds.length > 0
      ? await client.from('users').select('id, full_name').in('id', counterpartyIds)
      : { data: [] };
    const nameByUserId = (users || []).reduce<Record<string, string>>((acc, u: { id: string; full_name: string | null }) => {
      acc[u.id] = u.full_name || '—';
      return acc;
    }, {});

    const total = count ?? 0;
    const items: BusinessSuiteActivityListItem[] = list.map((e: any) => {
      const year = e.created_at ? new Date(e.created_at).getUTCFullYear() : new Date().getFullYear();
      const seq = e.escrow_sequence ?? 0;
      const activityId = formatEscrowId(year, seq);
      const party1Name = e.payer_name || '—';
      const party2Name = e.counterparty_name || (e.counterparty_id ? nameByUserId[e.counterparty_id] : null) || '—';
      const name = `${party1Name}, ${party2Name}`.trim();
      const address = (e.description || '').trim() || '—';
      const status = ESCROW_STATUS_TO_ACTIVITY[e.status] ?? 'Pending';
      const amountUsd = e.amount_usd != null ? parseFloat(String(e.amount_usd)) : undefined;
      return {
        id: e.id,
        activityId,
        description: { name, address },
        status,
        date: formatActivityDate(e.updated_at || e.created_at),
        createdAt: e.created_at,
        amountUsd,
      };
    });

    return {
      success: true,
      message: 'Business suite activity list retrieved',
      data: {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  /**
   * Portfolio chart: Subscription and Payroll amounts and percentages by period (business escrows only).
   * Uses escrow created_at and transaction_type ('subscription' | 'payroll'); other types excluded from chart.
   */
  async getPortfolioChart(
    userId: string,
    period: BusinessSuitePortfolioPeriod = 'monthly',
    year?: number
  ): Promise<{ success: boolean; message: string; data?: { period: BusinessSuitePortfolioPeriod; year?: number; data: BusinessSuitePortfolioDataPoint[] }; error?: string }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const client = supabaseAdmin!;
    const now = new Date();
    let startDate: Date;
    let endDate: Date;
    if (year != null) {
      startDate = new Date(Date.UTC(year, 0, 1));
      endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
      if (endDate > now) endDate = now;
    } else {
      endDate = new Date(now);
      startDate = new Date(now);
      if (period === 'monthly') startDate.setUTCMonth(startDate.getUTCMonth() - 11);
      else if (period === 'quarterly') startDate.setUTCMonth(startDate.getUTCMonth() - 11);
      else if (period === 'weekly') startDate.setUTCDate(startDate.getUTCDate() - 84);
      else startDate.setUTCFullYear(startDate.getUTCFullYear() - 2);
    }

    const { data: escrows, error } = await client
      .from('escrows')
      .select('created_at, amount_usd, transaction_type')
      .eq('user_id', userId)
      .eq('suite_context', 'business')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) return { success: false, message: error.message, error: error.message };

    const periodKey = (d: Date): string => {
      if (period === 'yearly') return `${d.getUTCFullYear()}`;
      if (period === 'monthly') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (period === 'quarterly') return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
      const w = this.getWeekNumber(d);
      return `${d.getUTCFullYear()}-W${String(w).padStart(2, '0')}`;
    };
    const formatLabel = (key: string): string => {
      if (period === 'yearly') return key;
      if (period === 'monthly') {
        const [y, m] = key.split('-');
        return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short' });
      }
      if (period === 'quarterly') return key;
      return key.replace('W', ' Week ');
    };

    const byPeriod = new Map<string, { subscription: number; payroll: number }>();
    (escrows || []).forEach((e: { created_at: string; amount_usd: string | number; transaction_type: string | null }) => {
      const key = periodKey(new Date(e.created_at));
      if (!byPeriod.has(key)) byPeriod.set(key, { subscription: 0, payroll: 0 });
      const val = byPeriod.get(key)!;
      const amount = parseFloat(String(e.amount_usd)) || 0;
      const type = (e.transaction_type || '').toLowerCase();
      if (type === 'subscription') val.subscription += amount;
      else if (type === 'payroll') val.payroll += amount;
    });

    const allPeriodKeys = this.generatePeriodKeys(period, startDate, endDate);
    const data: BusinessSuitePortfolioDataPoint[] = allPeriodKeys.map(key => {
      const val = byPeriod.get(key) ?? { subscription: 0, payroll: 0 };
      const total = val.subscription + val.payroll;
      const subscriptionPercent = total > 0 ? Math.round((val.subscription / total) * 100) : 0;
      const payrollPercent = total > 0 ? Math.round((val.payroll / total) * 100) : 0;
      return {
        period: formatLabel(key),
        subscriptionUsd: parseFloat(val.subscription.toFixed(2)),
        payrollUsd: parseFloat(val.payroll.toFixed(2)),
        subscriptionPercent,
        payrollPercent,
      };
    });

    return {
      success: true,
      message: 'Business suite portfolio chart retrieved',
      data: { period, ...(year != null && { year }), data },
    };
  }

  private getWeekNumber(d: Date): number {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private generatePeriodKeys(period: BusinessSuitePortfolioPeriod, start: Date, end: Date): string[] {
    const keys: string[] = [];
    const cur = new Date(start);
    const key = (d: Date): string => {
      if (period === 'yearly') return `${d.getUTCFullYear()}`;
      if (period === 'monthly') return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (period === 'quarterly') return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
      return `${d.getUTCFullYear()}-W${String(this.getWeekNumber(d)).padStart(2, '0')}`;
    };
    while (cur <= end) {
      keys.push(key(cur));
      if (period === 'yearly') cur.setUTCFullYear(cur.getUTCFullYear() + 1);
      else if (period === 'monthly' || period === 'quarterly') cur.setUTCMonth(cur.getUTCMonth() + 1);
      else cur.setUTCDate(cur.getUTCDate() + 7);
    }
    return keys;
  }

  /**
   * Upcoming Supply: business escrows (pending/active) with counterparty name, email, amount, due date.
   */
  async getUpcomingSupply(
    userId: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<BusinessSuiteUpcomingSupplyResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const client = supabaseAdmin!;
    const from = (page - 1) * pageSize;
    const orderCol = 'expected_release_date';
    const { data: rows, error, count } = await client
      .from('escrows')
      .select('id, counterparty_id, counterparty_name, counterparty_email, amount_usd, expected_release_date, expected_completion_date', { count: 'exact' })
      .eq('user_id', userId)
      .eq('suite_context', 'business')
      .in('status', ['pending', 'active'])
      .order(orderCol, { ascending: true, nullsFirst: false })
      .range(from, from + pageSize - 1);
    if (error) return { success: false, message: error.message, error: error.message };
    const list = rows || [];
    const counterpartyIds = list.map((r: { counterparty_id: string | null }) => r.counterparty_id).filter(Boolean) as string[];
    const { data: users } = counterpartyIds.length > 0 ? await client.from('users').select('id, full_name, email').in('id', counterpartyIds) : { data: [] };
    const userMap = (users || []).reduce<Record<string, { full_name: string; email: string }>>((acc, u: { id: string; full_name: string | null; email: string }) => {
      acc[u.id] = { full_name: u.full_name || '—', email: u.email || '' };
      return acc;
    }, {});
    const items: BusinessSuiteSupplyOrSubscriptionItem[] = list.map((r: any) => {
      const dateRaw = r.expected_release_date || r.expected_completion_date;
      const name = r.counterparty_name || (r.counterparty_id ? userMap[r.counterparty_id]?.full_name : null) || '—';
      const email = r.counterparty_email || (r.counterparty_id ? userMap[r.counterparty_id]?.email : null) || '';
      return {
        id: r.id,
        name,
        email,
        amountUsd: parseFloat(String(r.amount_usd)) || 0,
        dueDate: formatDateShort(dateRaw),
      };
    });
    const total = count ?? 0;
    return {
      success: true,
      message: 'Upcoming supply list retrieved',
      data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 },
    };
  }

  /**
   * Subscription: business escrows with transaction_type = 'subscription' (pending/active), name, email, amount, next payment date.
   */
  async getSubscriptionList(
    userId: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<BusinessSuiteSubscriptionListResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const client = supabaseAdmin!;
    const from = (page - 1) * pageSize;
    const { data: rows, error, count } = await client
      .from('escrows')
      .select('id, counterparty_id, counterparty_name, counterparty_email, amount_usd, expected_release_date, expected_completion_date', { count: 'exact' })
      .eq('user_id', userId)
      .eq('suite_context', 'business')
      .eq('transaction_type', 'subscription')
      .in('status', ['pending', 'active'])
      .order('expected_release_date', { ascending: true, nullsFirst: false })
      .range(from, from + pageSize - 1);
    if (error) return { success: false, message: error.message, error: error.message };
    const list = rows || [];
    const counterpartyIds = list.map((r: { counterparty_id: string | null }) => r.counterparty_id).filter(Boolean) as string[];
    const { data: users } = counterpartyIds.length > 0 ? await client.from('users').select('id, full_name, email').in('id', counterpartyIds) : { data: [] };
    const userMap = (users || []).reduce<Record<string, { full_name: string; email: string }>>((acc, u: { id: string; full_name: string | null; email: string }) => {
      acc[u.id] = { full_name: u.full_name || '—', email: u.email || '' };
      return acc;
    }, {});
    const items: BusinessSuiteSupplyOrSubscriptionItem[] = list.map((r: any) => {
      const dateRaw = r.expected_release_date || r.expected_completion_date;
      const name = r.counterparty_name || (r.counterparty_id ? userMap[r.counterparty_id]?.full_name : null) || '—';
      const email = r.counterparty_email || (r.counterparty_id ? userMap[r.counterparty_id]?.email : null) || '';
      return {
        id: r.id,
        name,
        email,
        amountUsd: parseFloat(String(r.amount_usd)) || 0,
        dueDate: formatDateShort(dateRaw),
      };
    });
    const total = count ?? 0;
    return {
      success: true,
      message: 'Subscription list retrieved',
      data: { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 },
    };
  }

  /**
   * Supplier contract overview stats for the three cards: Total created supplier contracts ($ locked), Pending supplier (X/Total + tier), Total Supplier Amount.
   * GET /api/business-suite/supply-contracts/overview
   */
  async getSupplierContractOverview(userId: string): Promise<SupplierContractOverviewResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const client = supabaseAdmin!;
    const [countResult, supplyEscrowsResult, trustiscoreResult] = await Promise.all([
      client
        .from('escrows')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('suite_context', 'business')
        .eq('transaction_type', 'supply'),
      client
        .from('escrows')
        .select('id, amount_usd, status')
        .eq('user_id', userId)
        .eq('suite_context', 'business')
        .eq('transaction_type', 'supply'),
      trustiscoreService.getTrustiscore(userId),
    ]);
    if (supplyEscrowsResult.error) {
      return { success: false, message: supplyEscrowsResult.error.message || 'Failed to fetch supply contracts', error: supplyEscrowsResult.error.message };
    }
    const rows = supplyEscrowsResult.data || [];
    const totalSupplierContracts = countResult.count ?? rows.length;
    const pendingStatuses = ['pending', 'active'];
    const pendingRows = rows.filter((r: { status: string }) => pendingStatuses.includes(r.status));
    const pendingCount = pendingRows.length;
    const lockedUsd = pendingRows.reduce((sum: number, r: { amount_usd: string | number }) => sum + parseFloat(String(r.amount_usd)), 0);
    const totalSupplierAmount = rows.reduce((sum: number, r: { amount_usd: string | number }) => sum + parseFloat(String(r.amount_usd)), 0);
    const tier = trustiscoreResult.success && trustiscoreResult.data?.level ? trustiscoreResult.data.level : 'Bronze';
    return {
      success: true,
      message: 'Supplier contract overview retrieved',
      data: {
        totalSupplierContracts,
        lockedUsd: parseFloat(lockedUsd.toFixed(2)),
        pendingCount,
        pendingTotal: totalSupplierContracts,
        tier,
        totalSupplierAmount: parseFloat(totalSupplierAmount.toFixed(2)),
      },
    };
  }

  /**
   * Supply contracts created by this business (creator view). Use for supply status list with release button.
   * Visible only to the business that created the escrow (user_id = userId).
   */
  async getSupplyContractsCreatedByMe(userId: string): Promise<SupplyContractsCreatedByMeResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const client = supabaseAdmin!;
    const { data: rows, error } = await client
      .from('escrows')
      .select('id, amount_xrp, amount_usd, status, expected_release_date, expected_completion_date, created_at, contract_document_urls')
      .eq('user_id', userId)
      .eq('suite_context', 'business')
      .eq('transaction_type', 'supply')
      .order('created_at', { ascending: true });
    if (error) {
      return { success: false, message: error.message || 'Failed to fetch supply contracts', error: error.message };
    }
    const list = rows || [];
    const byYear = new Map<number, number>();
    const items: SupplyContractEscrowedToMeItem[] = list.map((row: {
      id: string;
      amount_xrp: string | number | null;
      amount_usd: string | number;
      status: string;
      expected_release_date: string | null;
      expected_completion_date: string | null;
      created_at: string;
      contract_document_urls?: string[] | null;
    }) => {
      const year = new Date(row.created_at).getUTCFullYear();
      const seq = (byYear.get(year) ?? 0) + 1;
      byYear.set(year, seq);
      const contractId = `SC-${year}-${String(seq).padStart(3, '0')}`;
      const status = row.status || 'pending';
      const isLocked = status === 'pending' || status === 'active';
      const expectedReleaseDate = row.expected_release_date || row.expected_completion_date || null;
      const contractDocumentUrls = normalizeContractDocumentUrls(row.contract_document_urls);
      return {
        escrowId: row.id,
        contractId,
        amountUsd: parseFloat(String(row.amount_usd)) || 0,
        amountXrp: row.amount_xrp != null ? parseFloat(String(row.amount_xrp)) : null,
        status,
        statusDisplay: isLocked ? 'Pending' : 'Released',
        expectedReleaseDate,
        canRelease: isLocked,
        createdAt: row.created_at,
        contractDocumentUrls: contractDocumentUrls.length > 0 ? contractDocumentUrls : undefined,
      };
    });
    return {
      success: true,
      message: 'Supply contracts created by you',
      data: { items },
    };
  }

  /**
   * Single supply contract detail for contractor modal (creator view). Includes contract documents uploaded at creation.
   * GET /api/business-suite/supply-contracts/created-by-me/:escrowId
   */
  async getSupplyContractCreatedByMeDetail(
    userId: string,
    escrowId: string
  ): Promise<SupplyContractDetailForContractorResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const client = supabaseAdmin!;
    const { data: escrow, error } = await client
      .from('escrows')
      .select(
        'id, user_id, counterparty_id, amount_xrp, amount_usd, status, created_at, expected_completion_date, expected_release_date, release_conditions, release_type, dispute_resolution_period, contract_title, delivery_method, contract_document_urls, counterparty_name, supplier_completion_document_urls'
      )
      .eq('id', escrowId)
      .eq('user_id', userId)
      .eq('suite_context', 'business')
      .eq('transaction_type', 'supply')
      .maybeSingle();
    if (error) {
      return { success: false, message: error.message || 'Failed to fetch contract', error: error.message };
    }
    if (!escrow) {
      return { success: false, message: 'Contract not found or access denied', error: 'Not found' };
    }

    const created = new Date(escrow.created_at);
    const year = created.getUTCFullYear();
    const { count } = await client
      .from('escrows')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('suite_context', 'business')
      .eq('transaction_type', 'supply')
      .gte('created_at', `${year}-01-01T00:00:00.000Z`)
      .lte('created_at', escrow.created_at);
    const seq = count ?? 1;
    const contractId = `SC-${year}-${String(seq).padStart(3, '0')}`;

    let supplierName: string | null = (escrow.counterparty_name && escrow.counterparty_name.trim()) || null;
    if (!supplierName && escrow.counterparty_id) {
      const { data: biz } = await client
        .from('businesses')
        .select('company_name')
        .eq('owner_user_id', escrow.counterparty_id)
        .maybeSingle();
      if (biz?.company_name) supplierName = biz.company_name;
    }

    const status = escrow.status || 'pending';
    const isLocked = status === 'pending' || status === 'active';

    const deliveryDeadline = escrow.expected_completion_date
      ? new Date(escrow.expected_completion_date).toISOString()
      : null;
    const contractDocumentUrls = normalizeContractDocumentUrls(escrow.contract_document_urls);
    const proofOfCompletionDocumentUrls = normalizeContractDocumentUrls((escrow as { supplier_completion_document_urls?: string[] | null }).supplier_completion_document_urls);

    const data: SupplyContractDetailForContractor = {
      escrowId: escrow.id,
      contractId,
      supplierName,
      amountUsd: parseFloat(String(escrow.amount_usd)) || 0,
      amountXrp: escrow.amount_xrp != null ? parseFloat(String(escrow.amount_xrp)) : null,
      currency: 'USDT',
      status,
      fundsVerifiedInEscrow: status === 'active',
      deliveryDeadline,
      releaseCondition: escrow.release_conditions || null,
      escrowType: escrow.release_type || null,
      disputeWindow: escrow.dispute_resolution_period || null,
      contractTitle: escrow.contract_title || null,
      deliveryMethod: escrow.delivery_method || null,
      contractDocumentUrls,
      proofOfCompletionDocumentUrls,
      canRelease: isLocked,
      expectedReleaseDate: escrow.expected_release_date || escrow.expected_completion_date || null,
      createdAt: escrow.created_at,
    };

    return {
      success: true,
      message: 'Supply contract detail retrieved',
      data,
    };
  }

  /**
   * Supply contracts escrowed to the current business (supplier view, e.g. balance card "incoming").
   * Only visible to the counterparty: when Business B contracts Business A and escrows funds, only Business A sees these.
   * Excludes released/completed and cancelled escrows so the list only shows contracts still awaiting release.
   */
  async getSupplyContractsEscrowedToMe(userId: string): Promise<SupplyContractsEscrowedToMeResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const client = supabaseAdmin!;
    const { data: rows, error } = await client
      .from('escrows')
      .select('id, amount_xrp, amount_usd, status, expected_release_date, expected_completion_date, created_at')
      .eq('counterparty_id', userId)
      .eq('suite_context', 'business')
      .eq('transaction_type', 'supply')
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: true });
    if (error) {
      return { success: false, message: error.message || 'Failed to fetch supply contracts', error: error.message };
    }
    const list = rows || [];
    const byYear = new Map<number, number>();
    const items: SupplyContractEscrowedToMeItem[] = list.map((row: {
      id: string;
      amount_xrp: string | number | null;
      amount_usd: string | number;
      status: string;
      expected_release_date: string | null;
      expected_completion_date: string | null;
      created_at: string;
    }) => {
      const year = new Date(row.created_at).getUTCFullYear();
      const seq = (byYear.get(year) ?? 0) + 1;
      byYear.set(year, seq);
      const contractId = `SC-${year}-${String(seq).padStart(3, '0')}`;
      const status = row.status || 'pending';
      const isLocked = status === 'pending' || status === 'active';
      const expectedReleaseDate = row.expected_release_date || row.expected_completion_date || null;
      return {
        escrowId: row.id,
        contractId,
        amountUsd: parseFloat(String(row.amount_usd)) || 0,
        amountXrp: row.amount_xrp != null ? parseFloat(String(row.amount_xrp)) : null,
        status,
        statusDisplay: isLocked ? 'Pending' : 'Released',
        expectedReleaseDate,
        canRelease: isLocked,
        createdAt: row.created_at,
      };
    });
    return {
      success: true,
      message: 'Supply contracts escrowed to you',
      data: { items },
    };
  }

  /**
   * Single supply contract detail for the supplier modal (Escrow contract + terms + documents from contractor).
   * GET /api/business-suite/supply-contracts/escrowed-to-me/:escrowId
   */
  async getSupplyContractEscrowedToMeDetail(
    userId: string,
    escrowIdParam: string
  ): Promise<SupplyContractDetailForSupplierResponse> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const client = supabaseAdmin!;
    const escrowId = await resolveSupplyContractEscrowIdForCounterparty(client, escrowIdParam, userId);
    if (!escrowId) {
      return { success: false, message: 'Contract not found or access denied', error: 'Not found' };
    }
    const { data: escrow, error } = await client
      .from('escrows')
      .select(
        'id, user_id, counterparty_id, amount_xrp, amount_usd, status, created_at, expected_completion_date, expected_release_date, release_conditions, release_type, dispute_resolution_period, contract_title, delivery_method, contract_document_urls, payer_name, delivery_marked_at, buyer_confirmation_requested_at, supplier_completion_document_urls'
      )
      .eq('id', escrowId)
      .eq('counterparty_id', userId)
      .eq('suite_context', 'business')
      .eq('transaction_type', 'supply')
      .maybeSingle();
    if (error) {
      return { success: false, message: error.message || 'Failed to fetch contract', error: error.message };
    }
    if (!escrow) {
      return { success: false, message: 'Contract not found or access denied', error: 'Not found' };
    }

    const created = new Date(escrow.created_at);
    const year = created.getUTCFullYear();
    const { count } = await client
      .from('escrows')
      .select('id', { count: 'exact', head: true })
      .eq('counterparty_id', userId)
      .eq('suite_context', 'business')
      .eq('transaction_type', 'supply')
      .gte('created_at', `${year}-01-01T00:00:00.000Z`)
      .lte('created_at', escrow.created_at);
    const seq = count ?? 1;
    const contractId = `SC-${year}-${String(seq).padStart(3, '0')}`;

    let buyer: string | null = (escrow.payer_name && escrow.payer_name.trim()) || null;
    if (!buyer && escrow.user_id) {
      const { data: biz } = await client
        .from('businesses')
        .select('company_name')
        .eq('owner_user_id', escrow.user_id)
        .maybeSingle();
      if (biz?.company_name) buyer = biz.company_name;
    }

    const status = escrow.status || 'pending';
    const isLocked = status === 'pending' || status === 'active';
    const isCompleted = status === 'completed';

    const deliveryDeadline = escrow.expected_completion_date
      ? new Date(escrow.expected_completion_date).toISOString()
      : null;
    const documentsFromContractor = normalizeContractDocumentUrls(escrow.contract_document_urls);
    const proofOfCompletionDocumentUrls = normalizeContractDocumentUrls((escrow as { supplier_completion_document_urls?: string[] | null }).supplier_completion_document_urls);

    const data: SupplyContractDetailForSupplier = {
      escrowId: escrow.id,
      contractId,
      buyer,
      amountUsd: parseFloat(String(escrow.amount_usd)) || 0,
      amountXrp: escrow.amount_xrp != null ? parseFloat(String(escrow.amount_xrp)) : null,
      currency: 'USDT',
      status,
      fundsVerifiedInEscrow: status === 'active',
      timeline: {
        escrowCreated: true,
        fundsDeposited: status === 'active' || status === 'completed',
        contractAccepted: true,
        awaitingDelivery: !isCompleted,
        paymentRelease: isCompleted,
      },
      deliveryDeadline,
      releaseCondition: escrow.release_conditions || null,
      escrowType: escrow.release_type || null,
      disputeWindow: escrow.dispute_resolution_period || null,
      contractTitle: escrow.contract_title || null,
      deliveryMethod: escrow.delivery_method || null,
      documentsFromContractor,
      canRelease: isLocked,
      expectedReleaseDate: escrow.expected_release_date || escrow.expected_completion_date || null,
      createdAt: escrow.created_at,
      deliveryMarkedAt: (escrow as { delivery_marked_at?: string | null }).delivery_marked_at ?? null,
      buyerConfirmationRequestedAt: (escrow as { buyer_confirmation_requested_at?: string | null }).buyer_confirmation_requested_at ?? null,
      proofOfCompletionDocumentUrls,
    };

    return {
      success: true,
      message: 'Supply contract detail retrieved',
      data,
    };
  }

  /**
   * Mark supply contract as delivered (supplier action). POST .../escrowed-to-me/:escrowId/mark-delivered
   */
  async markSupplyContractDelivered(
    userId: string,
    escrowIdParam: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const client = supabaseAdmin!;
    const escrowId = await resolveSupplyContractEscrowIdForCounterparty(client, escrowIdParam, userId);
    if (!escrowId) {
      return { success: false, message: 'Contract not found or access denied', error: 'Not found' };
    }
    const { error } = await client
      .from('escrows')
      .update({
        delivery_marked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', escrowId)
      .eq('counterparty_id', userId);
    if (error) {
      return { success: false, message: error.message || 'Failed to update', error: error.message };
    }
    return { success: true, message: 'Contract marked as delivered' };
  }

  /**
   * Request buyer confirmation (supplier action). Sends email to buyer and sets buyer_confirmation_requested_at.
   * POST .../escrowed-to-me/:escrowId/request-buyer-confirmation
   */
  async requestSupplyContractBuyerConfirmation(
    userId: string,
    escrowIdParam: string
  ): Promise<{ success: boolean; message: string; error?: string }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    const client = supabaseAdmin!;
    const escrowId = await resolveSupplyContractEscrowIdForCounterparty(client, escrowIdParam, userId);
    if (!escrowId) {
      return { success: false, message: 'Contract not found or access denied', error: 'Not found' };
    }
    const { data: escrow, error: fetchErr } = await client
      .from('escrows')
      .select('id, user_id, counterparty_id, contract_title, payer_name, counterparty_name, created_at')
      .eq('id', escrowId)
      .eq('counterparty_id', userId)
      .maybeSingle();
    if (fetchErr || !escrow) {
      return { success: false, message: 'Contract not found or access denied', error: 'Not found' };
    }
    const now = new Date().toISOString();
    const { error: updateErr } = await client
      .from('escrows')
      .update({
        buyer_confirmation_requested_at: now,
        updated_at: now,
      })
      .eq('id', escrowId)
      .eq('counterparty_id', userId);
    if (updateErr) {
      return { success: false, message: updateErr.message || 'Failed to update', error: updateErr.message };
    }
    const createdAt = (escrow as { created_at: string }).created_at;
    const year = new Date(createdAt).getUTCFullYear();
    const { count } = await client
      .from('escrows')
      .select('id', { count: 'exact', head: true })
      .eq('counterparty_id', userId)
      .eq('suite_context', 'business')
      .eq('transaction_type', 'supply')
      .gte('created_at', `${year}-01-01T00:00:00.000Z`)
      .lte('created_at', createdAt);
    const seq = count ?? 1;
    const contractId = `SC-${year}-${String(seq).padStart(3, '0')}`;
    const contractTitle = (escrow as { contract_title?: string | null }).contract_title ?? null;
    const supplierName = (escrow as { counterparty_name?: string | null }).counterparty_name || 'Supplier';
    const buyerUserId = (escrow as { user_id: string }).user_id;
    const { data: buyerUser } = await client
      .from('users')
      .select('email, full_name')
      .eq('id', buyerUserId)
      .maybeSingle();
    const buyerEmail = (buyerUser as { email?: string } | null)?.email;
    const buyerName = (buyerUser as { full_name?: string } | null)?.full_name || (escrow as { payer_name?: string | null }).payer_name || 'Buyer';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const dashboardOrContractLink = `${frontendUrl}/dashboard`;
    if (buyerEmail) {
      await emailService.sendSupplyContractBuyerConfirmationRequest(
        buyerEmail,
        buyerName,
        supplierName,
        contractTitle,
        contractId,
        dashboardOrContractLink
      ).catch((e) => console.error('[RequestBuyerConfirmation] Email failed:', e));
    }
    return { success: true, message: 'Buyer confirmation requested; email sent to buyer' };
  }

  /**
   * Upload proof-of-completion document (supplier action). Appends URL to escrow.supplier_completion_document_urls.
   * POST .../escrowed-to-me/:escrowId/documents/upload-completion
   */
  async uploadSupplierCompletionDocument(
    userId: string,
    escrowIdParam: string,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number } | undefined
  ): Promise<{ success: boolean; message: string; data?: { fileUrl: string }; error?: string }> {
    const check = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }
    if (!file || !file.buffer) {
      return { success: false, message: 'No document file provided', error: 'Missing file' };
    }
    const client = supabaseAdmin!;
    const escrowId = await resolveSupplyContractEscrowIdForCounterparty(client, escrowIdParam, userId);
    if (!escrowId) {
      return { success: false, message: 'Contract not found or access denied', error: 'Not found' };
    }
    const uploadResult = await storageService.uploadSupplyCompletionDocument(escrowId, userId, file);
    if (!uploadResult.success || !uploadResult.data?.fileUrl) {
      return {
        success: false,
        message: uploadResult.message || 'Upload failed',
        error: uploadResult.error || uploadResult.message,
      };
    }
    const fileUrl = uploadResult.data.fileUrl;
    const { data: row } = await client
      .from('escrows')
      .select('supplier_completion_document_urls')
      .eq('id', escrowId)
      .eq('counterparty_id', userId)
      .maybeSingle();
    const existing: string[] = Array.isArray((row as { supplier_completion_document_urls?: string[] } | null)?.supplier_completion_document_urls)
      ? (row as { supplier_completion_document_urls: string[] }).supplier_completion_document_urls.filter((u): u is string => typeof u === 'string')
      : [];
    const combined = [...existing, fileUrl];
    const { error: updateErr } = await client
      .from('escrows')
      .update({
        supplier_completion_document_urls: combined,
        updated_at: new Date().toISOString(),
      })
      .eq('id', escrowId)
      .eq('counterparty_id', userId);
    if (updateErr) {
      return { success: false, message: updateErr.message || 'Failed to save document link', error: updateErr.message };
    }
    return { success: true, message: 'Proof of completion document uploaded', data: { fileUrl } };
  }
}

export const businessSuiteDashboardService = new BusinessSuiteDashboardService();
