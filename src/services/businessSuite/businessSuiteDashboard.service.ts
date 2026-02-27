/**
 * Business Suite Dashboard Service
 * Summary and activity list for the business suite dashboard (requires business_suite/enterprise account).
 */

import { supabaseAdmin } from '../../config/supabase';
import { walletService } from '../wallet/wallet.service';
import { trustiscoreService } from '../trustiscore/trustiscore.service';
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
} from '../../types/api/businessSuiteDashboard.types';

const BUSINESS_SUITE_TYPES = ['business_suite', 'enterprise'];

const ESCROW_STATUS_TO_ACTIVITY: Record<string, BusinessSuiteActivityStatus> = {
  pending: 'Pending',
  active: 'In progress',
  completed: 'Completed',
  cancelled: 'Pending',
  disputed: 'In progress',
};

function isBusinessSuite(accountType: string | null): boolean {
  return accountType != null && BUSINESS_SUITE_TYPES.includes(accountType);
}

function formatEscrowId(year: number, sequence: number): string {
  return `ESC-${year}-${sequence.toString().padStart(3, '0')}`;
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
   * Dashboard summary for business suite: only escrows with suite_context = 'business'.
   * Balance and trustiscore remain user-level; all escrow-derived stats are business-only.
   */
  async getDashboardSummary(userId: string): Promise<BusinessSuiteDashboardSummaryResponse> {
    const check = await this.ensureBusinessSuite(userId);
    if (!check.allowed) {
      return { success: false, message: 'Business suite is not enabled for this account', error: check.error };
    }

    const client = supabaseAdmin!;
    const now = new Date();
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [
      balanceResult,
      trustiscoreResult,
      { data: activeEscrowRows },
      { data: allBusinessEscrowRows },
      { count: payrollsCreated },
      { data: supplierRows },
      { count: completedThisMonth },
    ] = await Promise.all([
      walletService.getBalance(userId),
      trustiscoreService.getTrustiscore(userId),
      client.from('escrows').select('amount_usd').eq('suite_context', 'business').or(`user_id.eq.${userId},counterparty_id.eq.${userId}`).in('status', ['pending', 'active']),
      client.from('escrows').select('amount_usd').eq('suite_context', 'business').or(`user_id.eq.${userId},counterparty_id.eq.${userId}`),
      client.from('escrows').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('suite_context', 'business'),
      client.from('escrows').select('counterparty_id').eq('user_id', userId).eq('suite_context', 'business').not('counterparty_id', 'is', null),
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

    const supplierIds = new Set<string>();
    (supplierRows || []).forEach((r: { counterparty_id: string | null }) => {
      if (r.counterparty_id) supplierIds.add(r.counterparty_id);
    });

    return {
      success: true,
      message: 'Business suite dashboard summary retrieved',
      data: {
        balance: balanceResult.data.balance,
        activeEscrows: { count: activeCount, lockedAmount: parseFloat(lockedAmount.toFixed(2)) },
        trustiscore: { score: trustiscoreResult.data.score, level: trustiscoreResult.data.level },
        totalEscrowed: parseFloat(totalEscrowed.toFixed(2)),
        payrollsCreated: payrollsCreated ?? 0,
        suppliers: supplierIds.size,
        completedThisMonth: completedThisMonth ?? 0,
      },
    };
  }

  /**
   * Paginated activity list (escrows created by this business user).
   */
  async getActivityList(userId: string, params: BusinessSuiteActivityListParams): Promise<BusinessSuiteActivityListResponse> {
    const check = await this.ensureBusinessSuite(userId);
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
    const check = await this.ensureBusinessSuite(userId);
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
    const check = await this.ensureBusinessSuite(userId);
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
    const check = await this.ensureBusinessSuite(userId);
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
}

export const businessSuiteDashboardService = new BusinessSuiteDashboardService();
