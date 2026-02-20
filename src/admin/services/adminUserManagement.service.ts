/**
 * Admin User Management Service
 * Stats (total, verified, personal suite, business suite), user list with filters/pagination,
 * user detail, single and batch KYC status update.
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import type {
  UserManagementStatsResponse,
  UserManagementListResponse,
  UserManagementListItem,
  UserManagementDetailResponse,
  UserManagementDetailData,
  UserDetailWalletItem,
  UserDetailKyc,
  UserDetailEscrowItem,
  UserDetailTransactionItem,
  UserDetailDisputeItem,
  UserManagementUpdateKycResponse,
  UserManagementBatchKycResponse,
  UserManagementKycStatus,
} from '../../types/api/adminUserManagement.types';

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}sec ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}hrs ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 86400)} days ago`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} weeks ago`;
  return `${Math.floor(seconds / 31536000)} years ago`;
}

const BUSINESS_SUITE_TYPES = ['business_suite', 'enterprise'];

function isBusinessSuite(accountType: string | null): boolean {
  return accountType != null && BUSINESS_SUITE_TYPES.includes(accountType);
}

export class AdminUserManagementService {
  private getAdminClient() {
    const client = supabaseAdmin || supabase;
    if (!supabaseAdmin) {
      console.warn('Admin user-management using anon client; RLS may restrict data.');
    }
    return client;
  }

  /**
   * User management stats: total users, verified, personal suite, business suite + growth %
   */
  async getStats(): Promise<UserManagementStatsResponse> {
    try {
      const client = this.getAdminClient();
      const now = new Date();
      const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      let verifiedCount = 0;
      let verifiedLastMonth = 0;
      try {
        const { count: vCount } = await client.from('user_kyc').select('*', { count: 'exact', head: true }).eq('status', 'verified');
        verifiedCount = vCount ?? 0;
        const { count: vLast } = await client.from('user_kyc').select('*', { count: 'exact', head: true }).eq('status', 'verified').lt('reviewed_at', thisMonthStart.toISOString());
        verifiedLastMonth = vLast ?? 0;
      } catch {
        // user_kyc may not exist
      }

      const [
        { count: totalUsers },
        { count: totalUsersLastMonth },
        allUsersForSuite,
      ] = await Promise.all([
        client.from('users').select('*', { count: 'exact', head: true }),
        client.from('users').select('*', { count: 'exact', head: true }).lt('created_at', thisMonthStart.toISOString()),
        client.from('users').select('id, account_type'),
      ]);

      const total = totalUsers ?? 0;
      const totalLast = totalUsersLastMonth ?? 0;

      const users = allUsersForSuite?.data ?? [];
      let personalSuite = 0;
      let businessSuite = 0;
      users.forEach((u: { account_type: string | null }) => {
        if (isBusinessSuite(u.account_type)) businessSuite++;
        else personalSuite++;
      });

      const percent = (current: number, prev: number) =>
        prev === 0 ? undefined : Math.round(((current - prev) / prev) * 100);

      return {
        success: true,
        message: 'User management stats retrieved',
        data: {
          totalUsers: total,
          totalUsersChangePercent: percent(total, totalLast),
          verifiedUsers: verifiedCount,
          verifiedUsersChangePercent: percent(verifiedCount, verifiedLastMonth),
          personalSuiteUsers: personalSuite,
          personalSuiteUsersChangePercent: undefined,
          businessSuiteUsers: businessSuite,
          businessSuiteUsersChangePercent: undefined,
        },
      };
    } catch (e) {
      console.error('Admin user-management getStats error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get stats',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * User list with search, accountType (personal | business_suite), kycStatus, pagination, sort
   */
  async getUsers(params: {
    searchQuery?: string;
    accountType?: 'personal' | 'business_suite';
    kycStatus?: UserManagementKycStatus;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<UserManagementListResponse> {
    try {
      const client = this.getAdminClient();
      const page = Math.max(1, params.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
      const sortBy = params.sortBy || 'created_at';
      const sortOrder = params.sortOrder || 'desc';

      let userIdsFilter: string[] | null = null;
      if (params.kycStatus) {
        try {
          const { data: kycUserIds } = await client
            .from('user_kyc')
            .select('user_id')
            .eq('status', params.kycStatus);
          userIdsFilter = (kycUserIds || []).map((r: { user_id: string }) => r.user_id);
          if (userIdsFilter.length === 0) {
            return {
              success: true,
              message: 'Users retrieved',
              data: { totalPages: 0, currentPage: page, totalUsers: 0, pageSize, users: [] },
            };
          }
        } catch {
          userIdsFilter = [];
        }
      }

      let query = client.from('users').select('id, full_name, email, account_type, created_at, updated_at', { count: 'exact' });

      if (userIdsFilter && userIdsFilter.length > 0) {
        query = query.in('id', userIdsFilter);
      }
      if (params.searchQuery?.trim()) {
        const q = params.searchQuery.trim();
        query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
      }
      if (params.accountType === 'business_suite') {
        query = query.in('account_type', BUSINESS_SUITE_TYPES);
      } else if (params.accountType === 'personal') {
        query = query.or('account_type.is.null,account_type.not.in.(business_suite,enterprise)');
      }

      const orderCol = sortBy === 'name' ? 'full_name' : sortBy === 'accountCreatedDate' ? 'created_at' : sortBy === 'totalVolume' || sortBy === 'lastActivity' ? 'updated_at' : 'created_at';
      const { data: users, error: usersError, count: totalUsers } = await query
        .order(orderCol, { ascending: sortOrder === 'asc' })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (usersError) {
        return {
          success: false,
          message: usersError.message,
          error: usersError.message,
        };
      }

      const list = users ?? [];
      if (list.length === 0) {
        return {
          success: true,
          message: 'Users retrieved',
          data: {
            totalPages: Math.ceil((totalUsers ?? 0) / pageSize) || 0,
            currentPage: page,
            totalUsers: totalUsers ?? 0,
            pageSize,
            users: [],
          },
        };
      }

      const userIds = list.map((u: { id: string }) => u.id);

      let kycRows: { data: any[] | null } = { data: [] };
      try {
        kycRows = await client.from('user_kyc').select('user_id, status').in('user_id', userIds);
      } catch {
        // user_kyc may not exist
      }
      const kycByUser = (kycRows?.data || []).reduce<Record<string, string>>((acc, r: any) => {
        acc[r.user_id] = r.status;
        return acc;
      }, {});

      const [escrowCounts, savingsCounts, volumes, lastActivities] = await Promise.all([
        client.from('escrows').select('user_id').in('user_id', userIds),
        client.from('savings_wallets').select('user_id').in('user_id', userIds),
        client.from('transactions').select('user_id, amount_usd').in('user_id', userIds),
        client.from('transactions').select('user_id, created_at').in('user_id', userIds).order('created_at', { ascending: false }),
      ]);

      const escrowByUser: Record<string, number> = {};
      (escrowCounts?.data || []).forEach((e: any) => {
        escrowByUser[e.user_id] = (escrowByUser[e.user_id] || 0) + 1;
      });
      const savingsByUser: Record<string, number> = {};
      (savingsCounts?.data || []).forEach((s: any) => {
        savingsByUser[s.user_id] = (savingsByUser[s.user_id] || 0) + 1;
      });
      const volumeByUser: Record<string, number> = {};
      (volumes?.data || []).forEach((t: any) => {
        volumeByUser[t.user_id] = (volumeByUser[t.user_id] || 0) + parseFloat(t.amount_usd || '0');
      });
      const lastActivityByUser: Record<string, string> = {};
      (lastActivities?.data || []).forEach((t: any) => {
        if (!lastActivityByUser[t.user_id]) lastActivityByUser[t.user_id] = t.created_at;
      });

      const resultList: UserManagementListItem[] = list.map((u: any) => {
        const kyc = (kycByUser[u.id] || 'pending') as UserManagementKycStatus;
        const lastAt = lastActivityByUser[u.id] || u.updated_at;
        const lastDate = lastAt ? new Date(lastAt) : null;
        return {
          id: u.id,
          name: u.full_name || '—',
          email: u.email || '—',
          kycStatus: kyc,
          totalVolume: Math.round((volumeByUser[u.id] || 0) * 100) / 100,
          escrowCreatedCount: escrowByUser[u.id] || 0,
          savingsAccountCount: savingsByUser[u.id] || 0,
          accountCreatedDate: u.created_at,
          lastActivityTimestamp: lastActivityByUser[u.id] || null,
          lastActivityAgo: lastDate ? timeAgo(lastDate) : undefined,
          accountType: u.account_type || undefined,
        };
      });

      const total = totalUsers ?? 0;
      const totalPages = Math.ceil(total / pageSize) || 0;

      return {
        success: true,
        message: 'Users retrieved',
        data: {
          totalPages,
          currentPage: page,
          totalUsers: total,
          pageSize,
          users: resultList,
        },
      };
    } catch (e) {
      console.error('Admin user-management getUsers error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get users',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Single user detail by id – full User Details view: user info, wallet details, KYC, escrows, transactions, disputes
   */
  async getUserById(
    userId: string,
    opts?: {
      walletPage?: number;
      walletPageSize?: number;
      escrowPage?: number;
      escrowPageSize?: number;
      transactionLimit?: number;
      disputeLimit?: number;
    }
  ): Promise<UserManagementDetailResponse> {
    try {
      const client = this.getAdminClient();
      const walletPage = Math.max(1, opts?.walletPage ?? 1);
      const walletPageSize = Math.min(50, Math.max(1, opts?.walletPageSize ?? 10));
      const escrowPage = Math.max(1, opts?.escrowPage ?? 1);
      const escrowPageSize = Math.min(50, Math.max(1, opts?.escrowPageSize ?? 10));
      const transactionLimit = Math.min(50, Math.max(1, opts?.transactionLimit ?? 10));
      const disputeLimit = Math.min(50, Math.max(1, opts?.disputeLimit ?? 10));

      const { data: user, error: userError } = await client
        .from('users')
        .select('id, full_name, email, account_type, country, avatar_url, date_of_birth, created_at, updated_at')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        return {
          success: false,
          message: 'User not found',
          error: userError?.message || 'Not found',
        };
      }

      const [kyc, mainWallet, savingsList, escrowsResp, transactionsResp, disputesResp, volumes, lastTx] = await Promise.all([
        client.from('user_kyc').select('status, submitted_at, reviewed_at, linked_id_type, card_number, wallet_address, document_live_selfie_url, document_front_url, document_back_url').eq('user_id', userId).maybeSingle(),
        client.from('wallets').select('id, balance_usd, balance_xrp, xrpl_address, created_at').eq('user_id', userId).maybeSingle(),
        client.from('savings_wallets').select('id, name, target_amount_usd, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
        client.from('escrows').select('id, user_id, counterparty_id, amount_usd, status, created_at').or(`user_id.eq.${userId},counterparty_id.eq.${userId}`).order('created_at', { ascending: false }).range((escrowPage - 1) * escrowPageSize, escrowPage * escrowPageSize - 1),
        client.from('transactions').select('id, type, description, amount_usd, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(transactionLimit),
        client.from('disputes').select('id, case_id, dispute_category, initiator_user_id, respondent_user_id, status, opened_at').or(`initiator_user_id.eq.${userId},respondent_user_id.eq.${userId}`).order('opened_at', { ascending: false }).limit(disputeLimit),
        client.from('transactions').select('amount_usd').eq('user_id', userId),
        client.from('transactions').select('created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      const kycData = kyc?.data;
      const kycStatus = (kycData?.status || 'pending') as UserManagementKycStatus;
      const totalVolume = (volumes?.data || []).reduce((sum: number, t: any) => sum + parseFloat(t.amount_usd || '0'), 0);
      const lastAt = lastTx?.data?.created_at ?? null;
      const lastDate = lastAt ? new Date(lastAt) : null;

      const { count: escrowsTotal } = await client.from('escrows').select('*', { count: 'exact', head: true }).or(`user_id.eq.${userId},counterparty_id.eq.${userId}`);

      const mainWalletData = mainWallet?.data as { id: string; balance_usd?: string; balance_xrp?: string; xrpl_address?: string; created_at: string } | undefined;
      const userPrimaryWalletAddress = mainWalletData?.xrpl_address ?? undefined;

      const walletItems: UserDetailWalletItem[] = [];
      if (mainWalletData) {
        walletItems.push({
          id: mainWalletData.id,
          walletName: 'XRP Wallet',
          walletType: 'xrp',
          amountUsd: Math.round(parseFloat(mainWalletData.balance_usd || '0') * 100) / 100,
          date: mainWalletData.created_at,
          walletAddress: mainWalletData.xrpl_address,
        });
      }
      const savings = savingsList?.data ?? [];
      savings.forEach((s: any) => {
        walletItems.push({
          id: s.id,
          walletName: s.name || 'Savings',
          walletType: 'savings',
          amountUsd: Math.round(parseFloat(s.target_amount_usd || '0') * 100) / 100,
          date: s.created_at,
        });
      });
      const walletTotal = (mainWalletData ? 1 : 0) + savings.length;

      const userKyc: UserDetailKyc = {
        status: kycStatus,
        linkedIdType: kycData?.linked_id_type ?? undefined,
        cardNumber: kycData?.card_number ?? undefined,
        walletAddress: kycData?.wallet_address ?? undefined,
        documents: {
          liveSelfie: (kycData as any)?.document_live_selfie_url,
          front: (kycData as any)?.document_front_url,
          back: (kycData as any)?.document_back_url,
        },
        submittedAt: kycData?.submitted_at,
        reviewedAt: kycData?.reviewed_at,
      };

      const counterpartyIds = [...new Set((escrowsResp?.data ?? []).map((e: any) => e.counterparty_id).filter(Boolean))];
      const userIdsForNames = [...new Set([userId, ...counterpartyIds])];
      const { data: nameRows } = await client.from('users').select('id, full_name').in('id', userIdsForNames);
      const nameByUserId = (nameRows || []).reduce<Record<string, string>>((acc, r: any) => {
        acc[r.id] = r.full_name || '—';
        return acc;
      }, {});

      const escrowItems: UserDetailEscrowItem[] = (escrowsResp?.data ?? []).map((e: any) => {
        const parties = [nameByUserId[e.user_id], nameByUserId[e.counterparty_id]].filter(Boolean).join(', ') || '—';
        const statusMap: Record<string, string> = {
          pending: 'Pending',
          active: 'In progress',
          completed: 'Completed',
          cancelled: 'Cancelled',
          disputed: 'Disputed',
        };
        return {
          id: e.id,
          escrowIdNo: e.id.slice(0, 8),
          partiesInvolved: parties,
          amountUsd: Math.round(parseFloat(e.amount_usd || '0') * 100) / 100,
          status: statusMap[e.status] || e.status,
          createdAt: e.created_at,
        };
      });

      const txTypeLabels: Record<string, string> = {
        deposit: 'Payment Received',
        withdrawal: 'Withdrawal',
        escrow_create: 'Escrow Created',
        escrow_release: 'Payment Released',
        escrow_cancel: 'Escrow Cancelled',
        transfer: 'Funds Transferred',
        swap: 'Swap',
      };
      const transactionItems: UserDetailTransactionItem[] = (transactionsResp?.data ?? []).map((t: any) => {
        const createdAt = new Date(t.created_at);
        return {
          id: t.id,
          type: t.type,
          typeLabel: txTypeLabels[t.type] || t.type,
          description: t.description || `${txTypeLabels[t.type] || t.type}`,
          amountUsd: t.amount_usd != null ? parseFloat(t.amount_usd) : undefined,
          createdAt: t.created_at,
          createdAtAgo: timeAgo(createdAt),
        };
      });

      const disputeUserIds = [...new Set((disputesResp?.data ?? []).flatMap((d: any) => [d.initiator_user_id, d.respondent_user_id]))];
      const { data: disputeNames } = await client.from('users').select('id, full_name').in('id', disputeUserIds);
      const disputeNameMap = (disputeNames || []).reduce<Record<string, string>>((acc, r: any) => {
        acc[r.id] = r.full_name || '—';
        return acc;
      }, {});
      const categoryLabel: Record<string, string> = {
        freelancing: 'Freelancing',
        real_estate: 'Real Estate',
        product_purchase: 'Product Purchase',
        custom: 'Dispute',
      };
      const disputeItems: UserDetailDisputeItem[] = (disputesResp?.data ?? []).map((d: any) => {
        const parties = [disputeNameMap[d.initiator_user_id], disputeNameMap[d.respondent_user_id]].filter(Boolean).join(', ') || '—';
        const statusMap: Record<string, string> = {
          pending: 'Pending',
          active: 'In progress',
          resolved: 'Resolved',
          cancelled: 'Closed',
        };
        return {
          id: d.id,
          caseId: d.case_id,
          name: categoryLabel[d.dispute_category] || 'Dispute',
          partiesInvolved: parties,
          status: statusMap[d.status] || d.status,
          date: d.opened_at,
        };
      });

      const { count: disputesTotal } = await client.from('disputes').select('*', { count: 'exact', head: true }).or(`initiator_user_id.eq.${userId},respondent_user_id.eq.${userId}`);
      const { count: transactionsTotal } = await client.from('transactions').select('*', { count: 'exact', head: true }).eq('user_id', userId);

      const accountTypeLabel = (v: string | null) => {
        if (!v) return 'Personal';
        const map: Record<string, string> = {
          business_suite: 'Business suite',
          enterprise: 'Business suite',
          starter: 'Personal',
          basic: 'Personal',
          premium: 'Personal',
          personal: 'Personal',
        };
        return map[v] || v;
      };

      const data: UserManagementDetailData = {
        id: user.id,
        userId: user.id,
        name: user.full_name || '—',
        email: user.email || '—',
        profilePictureUrl: (user as any).avatar_url,
        accountType: accountTypeLabel(user.account_type),
        kycStatus,
        walletAddress: userPrimaryWalletAddress,
        country: user.country,
        nationality: user.country ? this.countryToNationality(user.country) : undefined,
        dateOfBirth: (user as any).date_of_birth,
        accountCreatedDate: user.created_at,
        totalVolume: Math.round(totalVolume * 100) / 100,
        escrowCreatedCount: escrowsTotal ?? 0,
        savingsAccountCount: savings.length,
        lastActivityTimestamp: lastAt,
        lastActivityAgo: lastDate ? timeAgo(lastDate) : undefined,
        updatedAt: user.updated_at,
        kycSubmittedAt: kycData?.submitted_at,
        kycReviewedAt: kycData?.reviewed_at,
        walletDetails: {
          total: walletTotal,
          items: walletItems.slice((walletPage - 1) * walletPageSize, walletPage * walletPageSize),
          page: walletPage,
          pageSize: walletPageSize,
        },
        userKyc,
        escrowDetails: {
          total: escrowsTotal ?? 0,
          items: escrowItems,
          page: escrowPage,
          pageSize: escrowPageSize,
        },
        transactionHistory: {
          total: transactionsTotal ?? 0,
          items: transactionItems,
        },
        disputes: {
          total: disputesTotal ?? 0,
          items: disputeItems,
        },
      };

      return {
        success: true,
        message: 'User detail retrieved',
        data,
      };
    } catch (e) {
      console.error('Admin user-management getUserById error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to get user',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  private countryToNationality(countryCode: string): string {
    const map: Record<string, string> = {
      NG: 'Nigerian',
      GH: 'Ghanaian',
      KE: 'Kenyan',
      ZA: 'South African',
      US: 'American',
      GB: 'British',
      CA: 'Canadian',
    };
    return map[countryCode?.toUpperCase()] || countryCode;
  }

  /**
   * Update one user's KYC status
   */
  async updateUserKycStatus(userId: string, status: UserManagementKycStatus, adminId: string): Promise<UserManagementUpdateKycResponse> {
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
          return { success: false, message: updateError.message, error: updateError.message };
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
          return { success: false, message: insertError.message, error: insertError.message };
        }
      }

      return {
        success: true,
        message: 'KYC status updated',
        data: { kycStatus: status },
      };
    } catch (e) {
      console.error('Admin user-management updateUserKycStatus error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Failed to update KYC',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch update KYC status for multiple users
   */
  async batchUpdateKycStatus(userIds: string[], status: UserManagementKycStatus, adminId: string): Promise<UserManagementBatchKycResponse> {
    try {
      if (!userIds?.length) {
        return {
          success: true,
          message: 'No users to update',
          data: { updated: 0, failed: 0, kycStatus: status },
        };
      }

      let updated = 0;
      let failed = 0;
      for (const userId of userIds) {
        const result = await this.updateUserKycStatus(userId, status, adminId);
        if (result.success) updated++;
        else failed++;
      }

      return {
        success: true,
        message: `Updated ${updated} user(s), ${failed} failed`,
        data: { updated, failed, kycStatus: status },
      };
    } catch (e) {
      console.error('Admin user-management batchUpdateKycStatus error:', e);
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Batch update failed',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }
  }
}

export const adminUserManagementService = new AdminUserManagementService();
