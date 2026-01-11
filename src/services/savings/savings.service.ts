/**
 * Savings Service
 * Aggregates savings allocation, cashflow, wallets, and transaction history
 */

import { supabase, supabaseAdmin } from '../../config/supabase';

import {
  SavingsSummaryResponse,
  SavingsCashflowResponse,
  SavingsWalletsResponse,
  SavingsTransactionsResponse,
  SavingsTransactionDirection,
} from '../../types/api/savings.types';
import type { TransactionType } from '../../types/api/transaction.types';

export class SavingsService {
  /**
   * Determine current period range and label based on filter
   * range: this_month | last_month | this_year
   */
  private getPeriodRange(range?: string): {
    start: Date;
    end: Date;
    label: string;
  } {
    const now = new Date();
    const year = now.getUTCFullYear();
    const monthIndex = now.getUTCMonth();

    if (range === 'last_month') {
      const lastMonthIndex = monthIndex - 1 >= 0 ? monthIndex - 1 : 11;
      const lastMonthYear = monthIndex - 1 >= 0 ? year : year - 1;
      const start = new Date(Date.UTC(lastMonthYear, lastMonthIndex, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(lastMonthYear, lastMonthIndex + 1, 0, 23, 59, 59, 999));
      return { start, end, label: 'Last Month' };
    }

    if (range === 'this_year') {
      const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const end = now;
      return { start, end, label: 'This Year' };
    }

    // Default: this_month
    const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const end = now;
    return { start, end, label: 'This Month' };
  }

  /**
   * Get previous period range given a current range
   */
  private getPreviousPeriodRange(range?: string): { start: Date; end: Date } {
    const now = new Date();
    const year = now.getUTCFullYear();
    const monthIndex = now.getUTCMonth();

    if (range === 'last_month') {
      // Previous of last_month = month before last
      let m = monthIndex - 2;
      let y = year;
      if (m < 0) {
        m += 12;
        y -= 1;
      }
      const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
      return { start, end };
    }

    if (range === 'this_year') {
      const prevYear = year - 1;
      const start = new Date(Date.UTC(prevYear, 0, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(prevYear, 11, 31, 23, 59, 59, 999));
      return { start, end };
    }

    // Default: previous month of this_month
    const prevMonthIndex = monthIndex - 1 >= 0 ? monthIndex - 1 : 11;
    const prevYear = monthIndex - 1 >= 0 ? year : year - 1;
    const start = new Date(Date.UTC(prevYear, prevMonthIndex, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(prevYear, prevMonthIndex + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }

  /**
   * Get a simple date range based on range filter for transactions
   * range: daily | weekly | monthly
   */
  private getDateRange(range?: string): { start: Date; end: Date } {
    const end = new Date();
    const start = new Date(end);

    if (range === 'daily') {
      start.setUTCDate(end.getUTCDate() - 1);
    } else if (range === 'weekly') {
      start.setUTCDate(end.getUTCDate() - 7);
    } else {
      // monthly or default: last 30 days
      start.setUTCDate(end.getUTCDate() - 30);
    }

    return { start, end };
  }

  /**
   * Determine direction (received/spent) from transaction type
   */
  private getDirection(type: TransactionType): SavingsTransactionDirection {
    const receivedTypes: TransactionType[] = ['deposit', 'escrow_release', 'transfer'];
    return receivedTypes.includes(type) ? 'received' : 'spent';
  }

  /**
   * Get savings allocation summary
   * GET /api/savings/summary
   */
  async getSummary(userId: string, range?: string): Promise<SavingsSummaryResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;
      const { start, end, label } = this.getPeriodRange(range);
      const prevRange = this.getPreviousPeriodRange(range);

      // Current period transactions linked to savings wallets
      const { data: currentTx, error: currentError } = await adminClient
        .from('transactions')
        .select('savings_wallet_id, amount_usd')
        .eq('user_id', userId)
        .not('savings_wallet_id', 'is', null)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Previous period for trend
      const { data: prevTx, error: prevError } = await adminClient
        .from('transactions')
        .select('savings_wallet_id, amount_usd')
        .eq('user_id', userId)
        .not('savings_wallet_id', 'is', null)
        .gte('created_at', prevRange.start.toISOString())
        .lte('created_at', prevRange.end.toISOString());

      if (currentError || prevError) {
        return {
          success: false,
          message: 'Failed to fetch savings summary',
          error: 'Failed to fetch savings summary',
        };
      }

      const currentRows = currentTx || [];
      const prevRows = prevTx || [];

      const sumByWallet = (rows: any[]) => {
        const totals = new Map<string, number>();
        for (const row of rows) {
          if (!row.savings_wallet_id) continue;
          const key = row.savings_wallet_id as string;
          const current = totals.get(key) || 0;
          totals.set(key, current + parseFloat(row.amount_usd));
        }
        return totals;
      };

      const currentTotals = sumByWallet(currentRows);
      const prevTotals = sumByWallet(prevRows);

      const totalUsd = Array.from(currentTotals.values()).reduce((sum, v) => sum + v, 0);
      const prevTotalUsd = Array.from(prevTotals.values()).reduce((sum, v) => sum + v, 0);

      const walletIds = Array.from(
        new Set<string>([
          ...Array.from(currentTotals.keys()),
          ...Array.from(prevTotals.keys()),
        ])
      );

      let categoryMap: Record<string, { name: string }> = {};
      if (walletIds.length > 0) {
        const { data: wallets } = await adminClient
          .from('savings_wallets')
          .select('id, name')
          .in('id', walletIds);
        categoryMap = (wallets || []).reduce((acc, w) => {
          acc[w.id] = { name: w.name };
          return acc;
        }, {} as Record<string, { name: string }>);
      }

      const categories = Array.from(currentTotals.entries()).map(([walletId, amount]) => {
        const percentage = totalUsd > 0 ? (amount / totalUsd) * 100 : 0;
        return {
          walletId,
          name: categoryMap[walletId]?.name || 'Unnamed',
          amountUsd: amount,
          percentage: parseFloat(percentage.toFixed(2)),
        };
      });

      let changePercent: number | undefined = undefined;
      if (prevTotalUsd > 0) {
        changePercent = ((totalUsd - prevTotalUsd) / prevTotalUsd) * 100;
      }

      return {
        success: true,
        message: 'Savings summary retrieved successfully',
        data: {
          totalUsd,
          changePercent,
          periodLabel: label,
          categories,
        },
      };
    } catch (error) {
      console.error('Error getting savings summary:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get savings summary',
        error: error instanceof Error ? error.message : 'Failed to get savings summary',
      };
    }
  }

  /**
   * Get savings cashflow data
   * GET /api/savings/cashflow
   */
  async getCashflow(params: {
    userId: string;
    interval?: 'monthly' | 'weekly';
    from?: string;
    to?: string;
  }): Promise<SavingsCashflowResponse> {
    const { userId, interval = 'monthly', from, to } = params;

    try {
      const adminClient = supabaseAdmin || supabase;

      const start = from ? new Date(from) : (() => {
        const { start } = this.getDateRange('monthly');
        return start;
      })();
      const end = to ? new Date(to) : new Date();

      const { data: rows, error } = await adminClient
        .from('transactions')
        .select('type, amount_usd, created_at')
        .eq('user_id', userId)
        .not('savings_wallet_id', 'is', null)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch savings cashflow',
          error: 'Failed to fetch savings cashflow',
        };
      }

      const buckets = new Map<string, { receivedUsd: number; spentUsd: number }>();

      const formatPeriod = (dateStr: string) => {
        const d = new Date(dateStr);
        if (interval === 'weekly') {
          // Simple weekly label: YYYY-Www
          const firstJan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
          const days = Math.floor(
            (d.getTime() - firstJan.getTime()) / (1000 * 60 * 60 * 24)
          );
          const week = Math.floor(days / 7) + 1;
          return `${d.getUTCFullYear()}-W${week.toString().padStart(2, '0')}`;
        }

        // Monthly: Jan, Feb, ...
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return monthNames[d.getUTCMonth()];
      };

      for (const row of rows || []) {
        const period = formatPeriod(row.created_at);
        const bucket = buckets.get(period) || { receivedUsd: 0, spentUsd: 0 };
        const direction = this.getDirection(row.type as TransactionType);
        const amount = parseFloat(row.amount_usd);

        if (direction === 'received') {
          bucket.receivedUsd += amount;
        } else {
          bucket.spentUsd += amount;
        }

        buckets.set(period, bucket);
      }

      const points = Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, data]) => ({
          period,
          receivedUsd: data.receivedUsd,
          spentUsd: data.spentUsd,
        }));

      return {
        success: true,
        message: 'Savings cashflow retrieved successfully',
        data: {
          interval,
          points,
        },
      };
    } catch (error) {
      console.error('Error getting savings cashflow:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get savings cashflow',
        error: error instanceof Error ? error.message : 'Failed to get savings cashflow',
      };
    }
  }

  /**
   * Get list of savings wallets and their balances
   * GET /api/savings/wallets
   */
  async getWallets(userId: string): Promise<SavingsWalletsResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;

      const { data: wallets, error: walletsError } = await adminClient
        .from('savings_wallets')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (walletsError) {
        return {
          success: false,
          message: 'Failed to fetch savings wallets',
          error: 'Failed to fetch savings wallets',
        };
      }

      const walletIds = (wallets || []).map(w => w.id);

      let totalsByWallet = new Map<string, number>();
      if (walletIds.length > 0) {
        const { data: txRows } = await adminClient
          .from('transactions')
          .select('savings_wallet_id, amount_usd')
          .eq('user_id', userId)
          .in('savings_wallet_id', walletIds);

        totalsByWallet = new Map<string, number>();
        for (const row of txRows || []) {
          if (!row.savings_wallet_id) continue;
          const key = row.savings_wallet_id as string;
          const current = totalsByWallet.get(key) || 0;
          totalsByWallet.set(key, current + parseFloat(row.amount_usd));
        }
      }

      const totalUsd = Array.from(totalsByWallet.values()).reduce((sum, v) => sum + v, 0);

      const items = (wallets || []).map(w => {
        const amountUsd = totalsByWallet.get(w.id) || 0;
        const percentage = totalUsd > 0 ? (amountUsd / totalUsd) * 100 : 0;

        return {
          id: w.id,
          name: w.name,
          amountUsd,
          percentage: parseFloat(percentage.toFixed(2)),
          targetAmountUsd: w.target_amount_usd ? parseFloat(w.target_amount_usd) : undefined,
        };
      });

      return {
        success: true,
        message: 'Savings wallets retrieved successfully',
        data: {
          totalUsd,
          wallets: items,
        },
      };
    } catch (error) {
      console.error('Error getting savings wallets:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get savings wallets',
        error: error instanceof Error ? error.message : 'Failed to get savings wallets',
      };
    }
  }

  /**
   * Create a new savings wallet
   * POST /api/savings/wallets
   */
  async createWallet(userId: string, body: { name: string; targetAmountUsd?: number }): Promise<SavingsWalletsResponse> {
    try {
      const adminClient = supabaseAdmin || supabase;
      const { name, targetAmountUsd } = body;

      const { data: wallet, error } = await adminClient
        .from('savings_wallets')
        .insert({
          user_id: userId,
          name,
          target_amount_usd: typeof targetAmountUsd === 'number' ? targetAmountUsd : null,
        })
        .select()
        .single();

      if (error || !wallet) {
        return {
          success: false,
          message: 'Failed to create savings wallet',
          error: 'Failed to create savings wallet',
        };
      }

      return {
        success: true,
        message: 'Savings wallet created successfully',
        data: {
          totalUsd: 0,
          wallets: [
            {
              id: wallet.id,
              name: wallet.name,
              amountUsd: 0,
              percentage: 0,
              targetAmountUsd: wallet.target_amount_usd
                ? parseFloat(wallet.target_amount_usd)
                : undefined,
            },
          ],
        },
      };
    } catch (error) {
      console.error('Error creating savings wallet:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create savings wallet',
        error: error instanceof Error ? error.message : 'Failed to create savings wallet',
      };
    }
  }

  /**
   * Get savings transaction history
   * GET /api/savings/transactions
   */
  async getTransactions(params: {
    userId: string;
    walletId?: string;
    direction?: SavingsTransactionDirection | 'all';
    range?: string; // daily | weekly | monthly
    page?: number;
    pageSize?: number;
  }): Promise<SavingsTransactionsResponse> {
    const { userId, walletId, direction = 'all', range, page = 1, pageSize = 10 } = params;

    try {
      const adminClient = supabaseAdmin || supabase;
      const { start, end } = this.getDateRange(range);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = adminClient
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .not('savings_wallet_id', 'is', null)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (walletId) {
        query = query.eq('savings_wallet_id', walletId);
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data: rows, error: listError } = await query;

      if (listError) {
        return {
          success: false,
          message: 'Failed to fetch savings transactions',
          error: 'Failed to fetch savings transactions',
        };
      }

      // Count query (without pagination)
      let countQuery = adminClient
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('savings_wallet_id', 'is', null)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (walletId) {
        countQuery = countQuery.eq('savings_wallet_id', walletId);
      }

      const { count } = await countQuery;

      const txRows = rows || [];

      // Filter by direction in-memory (simpler than complex DB filters)
      const filtered = txRows.filter(row => {
        const dir = this.getDirection(row.type as TransactionType);
        if (direction === 'all') return true;
        return dir === direction;
      });

      // Get wallet names
      const walletIds = Array.from(
        new Set<string>(filtered.map(r => r.savings_wallet_id).filter(Boolean))
      );

      let walletNameMap: Record<string, string> = {};
      if (walletIds.length > 0) {
        const { data: wallets } = await adminClient
          .from('savings_wallets')
          .select('id, name')
          .in('id', walletIds);
        walletNameMap = (wallets || []).reduce((acc, w) => {
          acc[w.id] = w.name;
          return acc;
        }, {} as Record<string, string>);
      }

      const items = filtered.map(row => {
        const dir = this.getDirection(row.type as TransactionType);
        const label = dir === 'received' ? 'Received' : 'Spent';
        const createdDate = row.created_at
          ? new Date(row.created_at).toISOString().split('T')[0]
          : '';

        return {
          id: row.id,
          walletId: row.savings_wallet_id,
          walletName: walletNameMap[row.savings_wallet_id] || undefined,
          direction: dir,
          txLabel: label,
          txHash: row.xrpl_tx_hash || undefined,
          amountUsd: parseFloat(row.amount_usd),
          status: row.status,
          date: createdDate,
        };
      });

      return {
        success: true,
        message: 'Savings transactions retrieved successfully',
        data: {
          transactions: items,
          total: count || 0,
        },
      };
    } catch (error) {
      console.error('Error getting savings transactions:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get savings transactions',
        error: error instanceof Error ? error.message : 'Failed to get savings transactions',
      };
    }
  }
}

export const savingsService = new SavingsService();


