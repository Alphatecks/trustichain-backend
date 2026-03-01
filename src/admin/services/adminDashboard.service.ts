/**
 * Admin Dashboard Service
 * Platform-wide stats and lists for admin panel. Uses supabaseAdmin to bypass RLS.
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import { storageService } from '../../services/storage/storage.service';
import type {
  AdminOverviewResponse,
  AdminEscrowInsightResponse,
  AdminDisputeResolutionResponse,
  AdminLiveTransactionsFeedResponse,
  AdminLiveFeedItem,
  AdminUserOverviewResponse,
  AdminUserOverviewItem,
  AdminKycListResponse,
  AdminKycDetailResponse,
  AdminKycApproveResponse,
  AdminSearchResponse,
  AdminAlertsResponse,
  KycStatus,
} from '../../types/api/adminDashboard.types';

const EVENT_TYPE_LABELS: Record<string, string> = {
  escrow_create: 'Escrow Created',
  escrow_release: 'Payment Released',
  escrow_cancel: 'Escrow Cancelled',
  deposit: 'Funds Deposited',
  withdrawal: 'Withdrawal',
  transfer: 'Transfer',
  swap: 'Swap',
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}sec ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}hr ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} weeks ago`;
  return `${Math.floor(seconds / 31536000)} years ago`;
}

function monthLabel(isoMonth: string): string {
  const [, m] = isoMonth.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[(m || 1) - 1] || isoMonth;
}

export class AdminDashboardService {
  private getAdminClient() {
    const client = supabaseAdmin || supabase;
    if (!supabaseAdmin) {
      console.warn('Admin dashboard using anon client; RLS may restrict platform-wide data.');
    }
    return client;
  }

  /**
   * Overview KPIs: total users, escrows, transactions, pending actions (with optional growth %)
   */
  async getOverview(): Promise<AdminOverviewResponse> {
    try {
      const client = this.getAdminClient();

      const now = new Date();
      const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const [
        { count: totalUsers },
        { count: totalEscrows },
        { count: totalTransactions },
        { data: disputesPending },
        { count: usersLastMonth },
        { count: escrowsLastMonth },
        { count: txLastMonth },
        { data: pendingLastMonth },
      ] = await Promise.all([
        client.from('users').select('*', { count: 'exact', head: true }),
        client.from('escrows').select('*', { count: 'exact', head: true }),
        client.from('transactions').select('*', { count: 'exact', head: true }),
        client.from('disputes').select('id').or('status.eq.pending,status.eq.active'),
        client.from('users').select('*', { count: 'exact', head: true }).lt('created_at', thisMonthStart.toISOString()),
        client.from('escrows').select('*', { count: 'exact', head: true }).lt('created_at', thisMonthStart.toISOString()),
        client.from('transactions').select('*', { count: 'exact', head: true }).lt('created_at', thisMonthStart.toISOString()),
        client.from('disputes').select('id').or('status.eq.pending,status.eq.active').lt('opened_at', thisMonthStart.toISOString()),
      ]);

      const pendingActions = (disputesPending?.length ?? 0);
      const pendingActionsLastMonth = (pendingLastMonth?.length ?? 0);

      const totalUsersNum = totalUsers ?? 0;
      const totalEscrowsNum = totalEscrows ?? 0;
      const totalTxNum = totalTransactions ?? 0;
      const usersLastMonthNum = usersLastMonth ?? 0;
      const escrowsLastMonthNum = escrowsLastMonth ?? 0;
      const txLastMonthNum = txLastMonth ?? 0;

      const percent = (current: number, previous: number) =>
        previous === 0 ? undefined : Math.round(((current - previous) / previous) * 100);

      return {
        success: true,
        message: 'Overview retrieved',
        data: {
          totalUsers: totalUsersNum,
          totalUsersChangePercent: percent(totalUsersNum, usersLastMonthNum),
          totalEscrows: totalEscrowsNum,
          totalEscrowsChangePercent: percent(totalEscrowsNum, escrowsLastMonthNum),
          totalTransactions: totalTxNum,
          totalTransactionsChangePercent: percent(totalTxNum, txLastMonthNum),
          pendingActions,
          pendingActionsChangePercent: percent(pendingActions, pendingActionsLastMonth),
        },
      };
    } catch (e) {
      console.error('Admin getOverview error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get overview',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Escrow insight: approved (completed) vs pending for a period (e.g. last month)
   */
  async getEscrowInsight(period?: string): Promise<AdminEscrowInsightResponse> {
    try {
      const client = this.getAdminClient();
      let start: Date;
      let end: Date;
      const now = new Date();
      if (period === 'last_month' || !period) {
        end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
        start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      } else if (period === 'last_6_months') {
        start = new Date(now);
        start.setUTCMonth(start.getUTCMonth() - 6);
        start.setUTCDate(1);
        start.setUTCHours(0, 0, 0, 0);
        end = new Date(now);
      } else {
        start = new Date(now);
        start.setUTCMonth(start.getUTCMonth() - 1);
        start.setUTCDate(1);
        start.setUTCHours(0, 0, 0, 0);
        end = new Date(now);
      }

      const { data: escrows } = await client
        .from('escrows')
        .select('id, status')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const list = escrows || [];
      const approvedCount = list.filter((e: { status: string }) => e.status === 'completed').length;
      const pendingCount = list.filter((e: { status: string }) => e.status === 'pending' || e.status === 'active').length;
      const total = list.length;
      const approvedPercent = total === 0 ? 0 : Math.round((approvedCount / total) * 100);
      const pendingPercent = total === 0 ? 0 : Math.round((pendingCount / total) * 100);

      return {
        success: true,
        message: 'Escrow insight retrieved',
        data: {
          period: period || 'last_month',
          approvedCount,
          pendingCount,
          approvedPercent,
          pendingPercent,
          items: [
            { status: 'approved' as const, count: approvedCount, percent: approvedPercent },
            { status: 'pending' as const, count: pendingCount, percent: pendingPercent },
          ],
        },
      };
    } catch (e) {
      console.error('Admin getEscrowInsight error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get escrow insight',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Dispute resolution: total resolved and by month (e.g. last 6 months)
   */
  async getDisputeResolution(period?: string): Promise<AdminDisputeResolutionResponse> {
    try {
      const client = this.getAdminClient();
      const now = new Date();
      const monthsBack = period === 'last_6_months' ? 6 : 6;
      const start = new Date(now);
      start.setUTCMonth(start.getUTCMonth() - monthsBack);
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);

      const { data: disputes } = await client
        .from('disputes')
        .select('id, status, resolved_at, opened_at')
        .eq('status', 'resolved')
        .gte('resolved_at', start.toISOString());

      const list = disputes || [];
      const byMonthMap: Record<string, number> = {};
      for (let i = 0; i < monthsBack; i++) {
        const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - monthsBack + i, 1);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        byMonthMap[key] = 0;
      }
      list.forEach((d: { resolved_at: string }) => {
        const dt = new Date(d.resolved_at);
        const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
        if (byMonthMap[key] !== undefined) byMonthMap[key]++;
      });

      const byMonth = Object.entries(byMonthMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, resolvedCount]) => ({
          month,
          label: monthLabel(month),
          resolvedCount,
        }));

      return {
        success: true,
        message: 'Dispute resolution retrieved',
        data: {
          period: period || 'last_6_months',
          totalDisputesResolved: list.length,
          byMonth,
        },
      };
    } catch (e) {
      console.error('Admin getDisputeResolution error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get dispute resolution',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Live transactions feed: recent platform transactions with human-readable labels
   */
  async getLiveTransactionsFeed(limit: number = 10): Promise<AdminLiveTransactionsFeedResponse> {
    try {
      const client = this.getAdminClient();

      const { data: transactions } = await client
        .from('transactions')
        .select('id, user_id, type, description, escrow_id, created_at')
        .order('created_at', { ascending: false })
        .limit(Math.min(limit, 50));

      const list = transactions || [];
      const userIds = [...new Set(list.map((t: { user_id: string }) => t.user_id))];
      const { data: users } = await client.from('users').select('id, full_name').in('id', userIds);
      const userMap = (users || []).reduce<Record<string, string>>((acc, u: { id: string; full_name: string }) => {
        acc[u.id] = u.full_name || 'Unknown';
        return acc;
      }, {});

      const items: AdminLiveFeedItem[] = list.map((t: any) => {
        const createdAt = new Date(t.created_at);
        const eventType = EVENT_TYPE_LABELS[t.type] || t.type;
        let description = t.description || `${userMap[t.user_id] || 'User'} — ${eventType}`;
        if (t.type === 'escrow_create' && t.escrow_id) {
          description = `${userMap[t.user_id] || 'User'} created an escrow`;
        } else if (t.type === 'escrow_release') {
          description = `Payment released`;
        } else if (t.type === 'deposit') {
          description = `Funds deposited`;
        }
        return {
          id: t.id,
          eventType,
          description,
          createdAt: t.created_at,
          createdAtAgo: timeAgo(createdAt),
          userId: t.user_id,
          relatedId: t.escrow_id,
        };
      });

      return {
        success: true,
        message: 'Live transactions feed retrieved',
        data: { items, total: items.length },
      };
    } catch (e) {
      console.error('Admin getLiveTransactionsFeed error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get live feed',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * User & Business overview: users with account type, KYC status, total volume, last activity
   */
  async getUserOverview(limit: number = 20, offset: number = 0): Promise<AdminUserOverviewResponse> {
    try {
      const client = this.getAdminClient();

      const { data: users, error: usersError } = await client
        .from('users')
        .select('id, full_name, email, account_type, created_at, updated_at')
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (usersError || !users?.length) {
        return {
          success: true,
          message: 'User overview retrieved',
          data: { users: [], total: 0 },
        };
      }

      const userIds = users.map((u: { id: string }) => u.id);
      let kycRows: { data: any[] | null } = { data: [] };
      try {
        kycRows = await client.from('user_kyc').select('user_id, status').in('user_id', userIds);
      } catch {
        // user_kyc table may not exist yet (migration 031 not run)
      }
      const txSums = await client.from('transactions').select('user_id, amount_usd').in('user_id', userIds);

      const kycByUser = (kycRows?.data || []).reduce<Record<string, KycStatus>>((acc, r: any) => {
        acc[r.user_id] = r.status as KycStatus;
        return acc;
      }, {});
      const volumeByUser: Record<string, number> = {};
      (txSums?.data || []).forEach((t: any) => {
        volumeByUser[t.user_id] = (volumeByUser[t.user_id] || 0) + parseFloat(t.amount_usd || '0');
      });

      const lastActivityByUser: Record<string, string> = {};
      const { data: lastTx } = await client
        .from('transactions')
        .select('user_id, created_at')
        .in('user_id', userIds)
        .order('created_at', { ascending: false });
      (lastTx || []).forEach((t: any) => {
        if (!lastActivityByUser[t.user_id]) lastActivityByUser[t.user_id] = t.created_at;
      });

      const accountTypeLabel = (v: string | null) => {
        if (!v) return 'Basic Package';
        const map: Record<string, string> = {
          starter: 'Starter Plan',
          basic: 'Basic Package',
          premium: 'Premium Plan',
          business_suite: 'Business Suite',
          enterprise: 'Enterprise Solution',
        };
        return map[v] || v;
      };

      const resultUsers: AdminUserOverviewItem[] = users.map((u: any) => {
        const lastAt = lastActivityByUser[u.id] || u.updated_at;
        const lastDate = lastAt ? new Date(lastAt) : null;
        return {
          userId: u.id,
          fullName: u.full_name || '—',
          email: u.email || '—',
          accountType: accountTypeLabel(u.account_type),
          kycStatus: kycByUser[u.id] || 'pending',
          totalVolumeUsd: Math.round((volumeByUser[u.id] || 0) * 100) / 100,
          lastActivityAt: lastAt,
          lastActivityAgo: lastDate ? timeAgo(lastDate) : undefined,
        };
      });

      const { count: total } = await client.from('users').select('*', { count: 'exact', head: true });

      return {
        success: true,
        message: 'User overview retrieved',
        data: { users: resultUsers, total: total ?? resultUsers.length },
      };
    } catch (e) {
      console.error('Admin getUserOverview error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get user overview',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * KYC verification list (users with KYC status for admin review)
   */
  async getKycList(): Promise<AdminKycListResponse> {
    try {
      const client = this.getAdminClient();

      const { data: kycRows, error: kycError } = await client
        .from('user_kyc')
        .select('user_id, status, submitted_at, reviewed_at')
        .in('status', ['pending', 'verified', 'declined', 'suspended']);

      if (kycError) {
        // Table may not exist yet (migration 031 not run)
        if (kycError.code === '42P01') {
          return { success: true, message: 'KYC list retrieved', data: { items: [] } };
        }
        return {
          success: false,
          message: kycError.message,
          error: kycError.message,
        };
      }

      const list = kycRows || [];
      if (list.length === 0) {
        return {
          success: true,
          message: 'KYC list retrieved',
          data: { items: [] },
        };
      }

      const userIds = [...new Set(list.map((k: any) => k.user_id))];
      const { data: users } = await client.from('users').select('id, full_name, email').in('id', userIds);
      const userMap = (users || []).reduce<Record<string, { full_name: string; email: string }>>((acc, u: any) => {
        acc[u.id] = { full_name: u.full_name, email: u.email };
        return acc;
      }, {});

      const items = list.map((k: any) => ({
        userId: k.user_id,
        fullName: userMap[k.user_id]?.full_name || '—',
        email: userMap[k.user_id]?.email || '—',
        kycStatus: k.status as KycStatus,
        submittedAt: k.submitted_at,
        reviewedAt: k.reviewed_at,
      }));

      return {
        success: true,
        message: 'KYC list retrieved',
        data: { items },
      };
    } catch (e) {
      console.error('Admin getKycList error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get KYC list',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * KYC detail for one user. Returns personal KYC and/or business KYC when present.
   * Supports users who only have business_suite_kyc (no user_kyc).
   */
  async getKycDetail(userId: string): Promise<AdminKycDetailResponse> {
    try {
      const client = this.getAdminClient();

      const { data: kyc, error: kycError } = await client
        .from('user_kyc')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (kycError?.code === '42P01') {
        return { success: false, message: 'KYC table not available', error: 'Run migration 031_create_user_kyc_and_account_type.sql' };
      }
      if (kycError) {
        return {
          success: false,
          message: 'KYC record not found',
          error: kycError?.message || 'Not found',
        };
      }

      const [{ data: user }, { data: businessKyc }] = await Promise.all([
        client.from('users').select('id, full_name, email').eq('id', userId).single(),
        client.from('business_suite_kyc').select('company_name, status, submitted_at, reviewed_at, company_logo_url').eq('user_id', userId).maybeSingle(),
      ]);

      if (kyc) {
        const documents: string[] = [];
        if ((kyc as any).document_live_selfie_url) documents.push((kyc as any).document_live_selfie_url);
        if ((kyc as any).document_front_url) documents.push((kyc as any).document_front_url);
        if ((kyc as any).document_back_url) documents.push((kyc as any).document_back_url);

        const rawLogoUrl = (businessKyc as any)?.company_logo_url ?? null;
        const companyLogoUrl = rawLogoUrl
          ? await storageService.getSignedUrlForCompanyLogo(rawLogoUrl, 3600)
          : null;

        return {
          success: true,
          message: 'KYC detail retrieved',
          data: {
            userId: kyc.user_id,
            fullName: (user as any)?.full_name || '—',
            email: (user as any)?.email || '—',
            kycStatus: kyc.status as KycStatus,
            submittedAt: kyc.submitted_at,
            reviewedAt: kyc.reviewed_at,
            documents,
            companyLogoUrl,
            companyName: (businessKyc as any)?.company_name ?? null,
            businessKycStatus: (businessKyc as any)?.status ?? null,
            businessSubmittedAt: (businessKyc as any)?.submitted_at ?? null,
            businessReviewedAt: (businessKyc as any)?.reviewed_at ?? null,
          },
        };
      }

      if (businessKyc) {
        const rawLogoUrl = (businessKyc as any)?.company_logo_url ?? null;
        const companyLogoUrl = rawLogoUrl
          ? await storageService.getSignedUrlForCompanyLogo(rawLogoUrl, 3600)
          : null;
        const bizStatus = (businessKyc as any)?.status;
        const kycStatusFromBiz: KycStatus =
          bizStatus === 'Verified' ? 'verified' : bizStatus === 'Rejected' ? 'declined' : 'pending';

        return {
          success: true,
          message: 'KYC detail retrieved',
          data: {
            userId,
            fullName: (user as any)?.full_name || '—',
            email: (user as any)?.email || '—',
            kycStatus: kycStatusFromBiz,
            submittedAt: (businessKyc as any)?.submitted_at ?? null,
            reviewedAt: (businessKyc as any)?.reviewed_at ?? null,
            documents: [],
            companyLogoUrl,
            companyName: (businessKyc as any)?.company_name ?? null,
            businessKycStatus: (businessKyc as any)?.status ?? null,
            businessSubmittedAt: (businessKyc as any)?.submitted_at ?? null,
            businessReviewedAt: (businessKyc as any)?.reviewed_at ?? null,
          },
        };
      }

      return {
        success: false,
        message: 'KYC record not found',
        error: 'Not found',
      };
    } catch (e) {
      console.error('Admin getKycDetail error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get KYC detail',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Approve / decline / suspend KYC for a user
   */
  async approveKyc(userId: string, status: 'verified' | 'declined' | 'suspended', adminId: string): Promise<AdminKycApproveResponse> {
    try {
      const client = this.getAdminClient();
      const now = new Date().toISOString();

      const { data: existing, error: fetchError } = await client.from('user_kyc').select('id').eq('user_id', userId).maybeSingle();
      if (fetchError?.code === '42P01') {
        return {
          success: false,
          message: 'KYC table not available. Run migration 031_create_user_kyc_and_account_type.sql',
          error: 'Table does not exist',
        };
      }

      if (existing) {
        const { error: updateError } = await client
          .from('user_kyc')
          .update({
            status,
            reviewed_at: now,
            reviewed_by: adminId,
            updated_at: now,
          })
          .eq('user_id', userId);

        if (updateError) {
          return {
            success: false,
            message: updateError.message,
            error: updateError.message,
          };
        }
      } else {
        const { error: insertError } = await client.from('user_kyc').insert({
          user_id: userId,
          status,
          reviewed_at: now,
          reviewed_by: adminId,
          submitted_at: now,
        });

        if (insertError) {
          return {
            success: false,
            message: insertError.message,
            error: insertError.message,
          };
        }
      }

      // Also update business_suite_kyc for this user when admin approves/declines (so one Approve updates both).
      const businessStatus = status === 'verified' ? 'Verified' : 'Rejected';
      try {
        const { error: bizError } = await client
          .from('business_suite_kyc')
          .update({
            status: businessStatus,
            reviewed_at: now,
            reviewed_by: adminId,
            updated_at: now,
          })
          .eq('user_id', userId);
        if (bizError) console.warn('Admin approveKyc: business_suite_kyc update failed (may have no row):', bizError.message);
      } catch (e) {
        console.warn('Admin approveKyc: business_suite_kyc update error:', e);
      }

      return {
        success: true,
        message: 'KYC status updated',
        data: { kycStatus: status },
      };
    } catch (e) {
      console.error('Admin approveKyc error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to update KYC',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Approve / reject / set in-review for business suite KYC (updates business_suite_kyc, not user_kyc).
   */
  async approveBusinessSuiteKyc(
    userId: string,
    status: 'In review' | 'Verified' | 'Rejected',
    adminId: string
  ): Promise<{ success: boolean; message: string; data?: { status: string }; error?: string }> {
    try {
      const client = this.getAdminClient();
      const now = new Date().toISOString();

      const { data: existing, error: fetchError } = await client
        .from('business_suite_kyc')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (fetchError) {
        return { success: false, message: fetchError.message, error: fetchError.message };
      }
      if (!existing) {
        return { success: false, message: 'No business suite KYC record found for this user', error: 'Not found' };
      }

      const { error: updateError } = await client
        .from('business_suite_kyc')
        .update({
          status,
          reviewed_at: now,
          reviewed_by: adminId,
          updated_at: now,
        })
        .eq('user_id', userId);

      if (updateError) {
        return { success: false, message: updateError.message, error: updateError.message };
      }

      if (status === 'Verified') {
        const { error: userUpdateError } = await client
          .from('users')
          .update({ account_type: 'business_suite', updated_at: now })
          .eq('id', userId);
        if (userUpdateError) {
          console.warn('Admin approveBusinessSuiteKyc: failed to set users.account_type:', userUpdateError.message);
        }
      }

      return { success: true, message: 'Business KYC status updated', data: { status } };
    } catch (e) {
      console.error('Admin approveBusinessSuiteKyc error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to update business KYC',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Search across users, escrows, transactions, disputes
   */
  async search(q: string, limit: number = 20): Promise<AdminSearchResponse> {
    try {
      const client = this.getAdminClient();
      const term = (q || '').trim().toLowerCase();
      if (!term) {
        return {
          success: true,
          message: 'Search completed',
          data: { results: [] },
        };
      }

      const results: Array<{ type: 'user' | 'escrow' | 'transaction' | 'dispute'; id: string; title: string; subtitle?: string; metadata?: Record<string, unknown> }> = [];
      const lim = Math.min(limit, 10);

      const [usersRes, escrowsRes, disputesRes] = await Promise.all([
        client.from('users').select('id, full_name, email').or(`full_name.ilike.%${term}%,email.ilike.%${term}%`).limit(lim),
        client.from('escrows').select('id, description, status, created_at').ilike('description', `%${term}%`).limit(lim),
        client.from('disputes').select('id, case_id, status').ilike('case_id', `%${term}%`).limit(lim),
      ]);

      (usersRes?.data || []).forEach((u: any) => {
        results.push({
          type: 'user',
          id: u.id,
          title: u.full_name || u.email,
          subtitle: u.email,
          metadata: { email: u.email },
        });
      });
      (escrowsRes?.data || []).forEach((e: any) => {
        results.push({
          type: 'escrow',
          id: e.id,
          title: (e.description || 'Escrow').slice(0, 60),
          subtitle: e.status,
          metadata: { status: e.status },
        });
      });
      (disputesRes?.data || []).forEach((d: any) => {
        results.push({
          type: 'dispute',
          id: d.id,
          title: d.case_id,
          subtitle: d.status,
          metadata: { status: d.status },
        });
      });

      return {
        success: true,
        message: 'Search completed',
        data: { results: results.slice(0, limit) },
      };
    } catch (e) {
      console.error('Admin search error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Search failed',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Alerts for admin panel (placeholder – can be backed by alerts table later)
   */
  async getAlerts(): Promise<AdminAlertsResponse> {
    try {
      return {
        success: true,
        message: 'Alerts retrieved',
        data: {
          alerts: [],
        },
      };
    } catch (e) {
      console.error('Admin getAlerts error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get alerts',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }
}

export const adminDashboardService = new AdminDashboardService();
