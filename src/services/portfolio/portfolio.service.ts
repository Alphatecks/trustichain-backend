/**
 * Portfolio Service
 * Handles portfolio performance data aggregation
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import type { TransactionType } from '../../types/api/transaction.types';

export class PortfolioService {
  /**
   * Get portfolio performance data for a specific timeframe
   */
  async getPortfolioPerformance(
    userId: string,
    timeframe: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly'
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      timeframe: string;
      data: Array<{
        period: string;
        value: number;
      }>;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Calculate date range based on timeframe
      const now = new Date();
      const startDate = this.getStartDate(now, timeframe);
      
      // Get portfolio data from database
      const { data: portfolioData, error } = await adminClient
        .from('portfolio_performance')
        .select('period, value_usd')
        .eq('user_id', userId)
        .gte('period', startDate.toISOString().split('T')[0])
        .order('period', { ascending: true });

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch portfolio data',
          error: 'Failed to fetch portfolio data',
        };
      }

      // If no data exists, generate from transactions
      if (!portfolioData || portfolioData.length === 0) {
        const generatedData = await this.generatePortfolioData(userId, timeframe, startDate);
        return {
          success: true,
          message: 'Portfolio performance retrieved successfully',
          data: {
            timeframe,
            data: generatedData,
          },
        };
      }

      // Format data for chart
      const formattedData = portfolioData.map(item => ({
        period: this.formatPeriod(item.period, timeframe),
        value: parseFloat(item.value_usd),
      }));

      return {
        success: true,
        message: 'Portfolio performance retrieved successfully',
        data: {
          timeframe,
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
    startDate: Date
  ): Promise<Array<{ period: string; value: number }>> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get all transactions since start date
      const { data: transactions } = await adminClient
        .from('transactions')
        .select('created_at, amount_usd, type')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .eq('status', 'completed')
        .order('created_at', { ascending: true });

      if (!transactions || transactions.length === 0) {
        // Return empty data points for the timeframe
        return this.generateEmptyDataPoints(startDate, new Date(), timeframe);
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






