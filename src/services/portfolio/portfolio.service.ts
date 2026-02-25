/**
 * Portfolio Service
 * Handles portfolio performance data aggregation
 */

import { supabase, supabaseAdmin } from '../../config/supabase';

export class PortfolioService {
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
      const adminClient = supabaseAdmin || supabase;

      const now = new Date();
      let startDate: Date;
      let endDate: Date | null = null;

      if (year != null) {
        startDate = new Date(year, 0, 1); // Jan 1
        endDate = new Date(year, 11, 31); // Dec 31
        if (endDate > now) endDate = now;
      } else {
        startDate = this.getStartDate(now, timeframe);
      }

      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate ? endDate.toISOString().split('T')[0] : null;

      let query = adminClient
        .from('portfolio_performance')
        .select('period, value_usd')
        .eq('user_id', userId)
        .gte('period', startStr)
        .order('period', { ascending: true });

      if (endStr) {
        query = query.lte('period', endStr);
      }

      const { data: portfolioData, error } = await query;

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch portfolio data',
          error: 'Failed to fetch portfolio data',
        };
      }

      // If no data exists, generate from transactions
      if (!portfolioData || portfolioData.length === 0) {
        const generatedData = await this.generatePortfolioData(userId, timeframe, startDate, endDate ?? undefined);
        return {
          success: true,
          message: 'Portfolio performance retrieved successfully',
          data: {
            timeframe,
            ...(year != null && { year }),
            data: generatedData,
          },
        };
      }

      // Format data for chart
      const formattedData = portfolioData.map((item: { period: string; value_usd: string | number }) => ({
        period: this.formatPeriod(item.period, timeframe),
        value: parseFloat(String(item.value_usd)),
      }));

      return {
        success: true,
        message: 'Portfolio performance retrieved successfully',
        data: {
          timeframe,
          ...(year != null && { year }),
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

  /**
   * Generate portfolio data from transactions if no portfolio_performance data exists
   */
  private async generatePortfolioData(
    userId: string,
    timeframe: string,
    startDate: Date,
    endDate?: Date
  ): Promise<Array<{ period: string; value: number }>> {
    try {
      const adminClient = supabaseAdmin || supabase;
      const end = endDate ?? new Date();

      let query = adminClient
        .from('transactions')
        .select('created_at, amount_usd, type')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

      if (endDate) {
        query = query.lte('created_at', end.toISOString());
      }

      const { data: transactions } = await query;

      if (!transactions || transactions.length === 0) {
        return this.generateEmptyDataPoints(startDate, end, timeframe);
      }

      // Aggregate by period
      const aggregated = this.aggregateByTimeframe(transactions, timeframe);
      return aggregated;
    } catch (error) {
      console.error('Error generating portfolio data:', error);
      return [];
    }
  }

  /**
   * Get start date based on timeframe
   */
  private getStartDate(now: Date, timeframe: string): Date {
    const date = new Date(now);
    
    switch (timeframe) {
      case 'daily':
        date.setDate(date.getDate() - 30); // Last 30 days
        break;
      case 'weekly':
        date.setDate(date.getDate() - 84); // Last 12 weeks
        break;
      case 'monthly':
        date.setMonth(date.getMonth() - 6); // Last 6 months
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() - 2); // Last 2 years
        break;
      default:
        date.setMonth(date.getMonth() - 6);
    }
    
    return date;
  }

  /**
   * Format period string based on timeframe
   */
  private formatPeriod(dateString: string, timeframe: string): string {
    const date = new Date(dateString);
    
    switch (timeframe) {
      case 'daily':
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'weekly':
        return `Week ${this.getWeekNumber(date)}`;
      case 'monthly':
        return date.toLocaleDateString('en-US', { month: 'short' });
      case 'yearly':
        return date.getFullYear().toString();
      default:
        return date.toLocaleDateString('en-US', { month: 'short' });
    }
  }

  /**
   * Get week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Aggregate transactions by timeframe
   */
  private aggregateByTimeframe(
    transactions: Array<{ created_at: string; amount_usd: string; type: string }>,
    timeframe: string
  ): Array<{ period: string; value: number }> {
    const aggregated: Map<string, number> = new Map();
    let runningTotal = 0;

    transactions.forEach(tx => {
      const date = new Date(tx.created_at);
      const period = this.getPeriodKey(date, timeframe);
      
      // Add to running total (deposits and escrow releases increase, withdrawals decrease)
      if (tx.type === 'deposit' || tx.type === 'escrow_release') {
        runningTotal += parseFloat(tx.amount_usd);
      } else if (tx.type === 'withdrawal' || tx.type === 'escrow_create') {
        runningTotal -= parseFloat(tx.amount_usd);
      }

      // Store the running total for this period
      aggregated.set(period, runningTotal);
    });

    // Convert to array and format
    return Array.from(aggregated.entries())
      .map(([period, value]) => ({
        period: this.formatPeriodKey(period, timeframe),
        value: parseFloat(value.toFixed(2)),
      }))
      .sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Get period key for aggregation
   */
  private getPeriodKey(date: Date, timeframe: string): string {
    switch (timeframe) {
      case 'daily':
        return date.toISOString().split('T')[0];
      case 'weekly':
        return `${date.getFullYear()}-W${this.getWeekNumber(date)}`;
      case 'monthly':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'yearly':
        return date.getFullYear().toString();
      default:
        return date.toISOString().split('T')[0];
    }
  }

  /**
   * Format period key for display
   */
  private formatPeriodKey(key: string, timeframe: string): string {
    if (timeframe === 'daily') {
      const date = new Date(key);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (timeframe === 'weekly') {
      return key.replace('W', ' Week ');
    } else if (timeframe === 'monthly') {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('en-US', { month: 'short' });
    } else {
      return key;
    }
  }

  /**
   * Generate empty data points for a date range
   */
  private generateEmptyDataPoints(startDate: Date, endDate: Date, timeframe: string): Array<{ period: string; value: number }> {
    const points: Array<{ period: string; value: number }> = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      points.push({
        period: this.formatPeriod(current.toISOString(), timeframe),
        value: 0,
      });

      // Increment based on timeframe
      switch (timeframe) {
        case 'daily':
          current.setDate(current.getDate() + 1);
          break;
        case 'weekly':
          current.setDate(current.getDate() + 7);
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + 1);
          break;
        case 'yearly':
          current.setFullYear(current.getFullYear() + 1);
          break;
      }
    }

    return points;
  }
}

export const portfolioService = new PortfolioService();






