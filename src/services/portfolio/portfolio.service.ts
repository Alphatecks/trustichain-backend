/**
 * Portfolio Service
 * Handles portfolio performance data aggregation
 */

import { supabase, supabaseAdmin } from '../../config/supabase';

export class PortfolioService {
  private async fetchEscrowsForRange(
    userId: string,
    _startIso: string,
    endIso: string
  ): Promise<{
    data: Array<{ id: string; created_at: string; updated_at: string | null; amount_usd: unknown }> | null;
    error: string | null;
  }> {
    const adminClient = supabaseAdmin || supabase;
    const personalScope = 'or(suite_context.is.null,suite_context.eq.personal)';
    const participantAndScopeFilter =
      `and(user_id.eq.${userId},${personalScope}),and(counterparty_id.eq.${userId},${personalScope})`;

    const pageSize = 1000;
    let from = 0;
    const allRows: Array<{ id: string; created_at: string; updated_at: string | null; amount_usd: unknown }> = [];

    while (true) {
      const to = from + pageSize - 1;
      const { data, error } = await adminClient
        .from('escrows')
        .select('id, created_at, updated_at, amount_usd')
        .or(participantAndScopeFilter)
        // Keep the SQL filter broad and do exact activity-month checks in memory.
        // This avoids dropping rows when updated_at is null or not refreshed.
        .lte('created_at', endIso)
        .order('created_at', { ascending: true })
        .range(from, to);

      if (error) {
        return { data: null, error: error.message || 'Failed to fetch escrow totals' };
      }

      const rows = (data || []) as Array<{ id: string; created_at: string; updated_at: string | null; amount_usd: unknown }>;
      allRows.push(...rows);

      if (rows.length < pageSize) break;
      from += pageSize;
    }

    return { data: allRows, error: null };
  }

  private parseAmountUsd(raw: unknown): number {
    const direct = Number(raw);
    if (Number.isFinite(direct)) return direct;

    // Safeguard against formatted strings (e.g., "1,250.50") so valid months do not collapse to 0.
    const normalized = String(raw ?? '').replace(/,/g, '').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  /**
   * Get portfolio performance data for a specific timeframe.
   * Optional year filters data to that year (e.g. 2024 => Jan 1 - Dec 31 of 2024).
   */
  async getPortfolioPerformance(
    userId: string,
    timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    year?: number
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      timeframe: string;
      year?: number;
      data: Array<{
        period: string;
        value: number;
      }>;
    };
    error?: string;
  }> {
    try {
      const now = new Date();
      const requestedTimeframe = timeframe;
      const currentYear = now.getUTCFullYear();
      const targetYear = year ?? currentYear;

      // Gross total escrowed per month for personal suite (escrows created by user).
      const startDate = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0, 0));
      const endDate = targetYear === currentYear
        ? now
        : new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));

      const { data: escrows, error } = await this.fetchEscrowsForRange(
        userId,
        startDate.toISOString(),
        endDate.toISOString()
      );

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch escrow totals',
          error: 'Failed to fetch escrow totals',
        };
      }

      const monthTotals = new Map<number, number>();
      for (let month = 0; month < 12; month++) monthTotals.set(month, 0);

      const startMs = startDate.getTime();
      const endMs = endDate.getTime();
      const rowMonthSeen = new Set<string>();

      for (const row of escrows || []) {
        const amount = this.parseAmountUsd(row.amount_usd);
        if (!Number.isFinite(amount)) continue;

        const activityMonths = new Set<number>();
        const createdAt = new Date(row.created_at);
        if (Number.isFinite(createdAt.getTime())) {
          const createdMs = createdAt.getTime();
          if (createdMs >= startMs && createdMs <= endMs && createdAt.getUTCFullYear() === targetYear) {
            activityMonths.add(createdAt.getUTCMonth());
          }
        }

        if (row.updated_at) {
          const updatedAt = new Date(row.updated_at);
          if (Number.isFinite(updatedAt.getTime())) {
            const updatedMs = updatedAt.getTime();
            if (updatedMs >= startMs && updatedMs <= endMs && updatedAt.getUTCFullYear() === targetYear) {
              activityMonths.add(updatedAt.getUTCMonth());
            }
          }
        }

        for (const month of activityMonths) {
          const seenKey = `${row.id}:${month}`;
          if (rowMonthSeen.has(seenKey)) continue;
          rowMonthSeen.add(seenKey);
          monthTotals.set(month, (monthTotals.get(month) || 0) + amount);
        }
      }

      // Keep chart length aligned to current UTC month for current year.
      const maxMonth = targetYear === currentYear ? now.getUTCMonth() : 11;
      const formattedData = Array.from({ length: maxMonth + 1 }, (_, month) => {
        const date = new Date(Date.UTC(targetYear, month, 1, 0, 0, 0, 0));
        return {
          period: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
          value: parseFloat((monthTotals.get(month) || 0).toFixed(2)),
        };
      });

      return {
        success: true,
        message: 'Portfolio performance retrieved successfully',
        data: {
          timeframe: requestedTimeframe === 'monthly' ? 'monthly' : 'monthly',
          ...(year != null && { year: targetYear }),
          data: formattedData,
        },
      };
    } catch (error) {
      console.error('Error getting portfolio performance:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get portfolio performance',
        error: error instanceof Error ? error.message : 'Failed to get portfolio performance',
      };
    }
  }

}

export const portfolioService = new PortfolioService();






