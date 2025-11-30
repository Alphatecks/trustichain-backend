/**
 * Trustiscore Service
 * Calculates and manages user trust scores
 */

import { supabase, supabaseAdmin } from '../../config/supabase';

interface TrustiscoreFactors {
  completedEscrows: number;
  accountAge: number; // in days
  disputeResolutionRate: number; // 0-1
  transactionVolume: number; // total USD
  onTimeCompletionRate: number; // 0-1
}

export class TrustiscoreService {
  /**
   * Get trustiscore for a user
   */
  async getTrustiscore(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      score: number;
      level: string;
      factors?: TrustiscoreFactors;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get trustiscore from database
      let { data: trustiscore, error } = await adminClient
        .from('trustiscore')
        .select('*')
        .eq('user_id', userId)
        .single();

      // If no trustiscore exists, calculate and create one
      if (error || !trustiscore) {
        const calculated = await this.calculateTrustiscore(userId);
        if (!calculated.success || !calculated.data) {
          return calculated;
        }

        // Create trustiscore record
        const { data: newTrustiscore, error: createError } = await adminClient
          .from('trustiscore')
          .insert({
            user_id: userId,
            score: calculated.data.score,
            level: calculated.data.level,
            factors: calculated.data.factors || {},
          })
          .select()
          .single();

        if (createError || !newTrustiscore) {
          return {
            success: false,
            message: 'Failed to create trustiscore',
            error: 'Failed to create trustiscore',
          };
        }

        trustiscore = newTrustiscore;
      }

      return {
        success: true,
        message: 'Trustiscore retrieved successfully',
        data: {
          score: trustiscore.score,
          level: trustiscore.level,
          factors: trustiscore.factors as TrustiscoreFactors,
        },
      };
    } catch (error) {
      console.error('Error getting trustiscore:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get trustiscore',
        error: error instanceof Error ? error.message : 'Failed to get trustiscore',
      };
    }
  }

  /**
   * Calculate trustiscore based on various factors
   */
  async calculateTrustiscore(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      score: number;
      level: string;
      factors: TrustiscoreFactors;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get user account age
      const { data: user } = await adminClient
        .from('users')
        .select('created_at')
        .eq('id', userId)
        .single();

      const accountAgeDays = user
        ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Get completed escrows count
      const { count: completedEscrows } = await adminClient
        .from('escrows')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed');

      // Get total escrows for completion rate
      const { count: totalEscrows } = await adminClient
        .from('escrows')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .in('status', ['completed', 'cancelled']);

      const onTimeCompletionRate = totalEscrows && totalEscrows > 0
        ? (completedEscrows || 0) / totalEscrows
        : 0;

      // Get disputed escrows
      const { count: disputedEscrows } = await adminClient
        .from('escrows')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'disputed');

      const disputeResolutionRate = totalEscrows && totalEscrows > 0
        ? 1 - ((disputedEscrows || 0) / totalEscrows)
        : 1;

      // Get total transaction volume
      const { data: transactions } = await adminClient
        .from('transactions')
        .select('amount_usd')
        .eq('user_id', userId)
        .eq('status', 'completed');

      const transactionVolume = transactions?.reduce((sum, tx) => sum + parseFloat(tx.amount_usd), 0) || 0;

      // Calculate score (0-100)
      // Factors and weights:
      // - Completed escrows: 30 points max (1 point per escrow, max 30)
      // - Account age: 20 points max (1 point per 30 days, max 20)
      // - Dispute resolution rate: 25 points max (25 * rate)
      // - Transaction volume: 15 points max (1 point per $1000, max 15)
      // - On-time completion: 10 points max (10 * rate)

      const escrowScore = Math.min((completedEscrows || 0) * 1, 30);
      const ageScore = Math.min(Math.floor(accountAgeDays / 30) * 1, 20);
      const disputeScore = disputeResolutionRate * 25;
      const volumeScore = Math.min(Math.floor(transactionVolume / 1000) * 1, 15);
      const completionScore = onTimeCompletionRate * 10;

      const totalScore = Math.round(escrowScore + ageScore + disputeScore + volumeScore + completionScore);
      const finalScore = Math.min(Math.max(totalScore, 0), 100);

      // Determine level
      let level = 'Bronze';
      if (finalScore >= 71) level = 'Platinum';
      else if (finalScore >= 51) level = 'Gold';
      else if (finalScore >= 31) level = 'Silver';

      const factors: TrustiscoreFactors = {
        completedEscrows: completedEscrows || 0,
        accountAge: accountAgeDays,
        disputeResolutionRate,
        transactionVolume,
        onTimeCompletionRate,
      };

      return {
        success: true,
        message: 'Trustiscore calculated successfully',
        data: {
          score: finalScore,
          level,
          factors,
        },
      };
    } catch (error) {
      console.error('Error calculating trustiscore:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to calculate trustiscore',
        error: error instanceof Error ? error.message : 'Failed to calculate trustiscore',
      };
    }
  }

  /**
   * Update trustiscore (recalculate and update)
   */
  async updateTrustiscore(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      score: number;
      level: string;
    };
    error?: string;
  }> {
    try {
      const calculated = await this.calculateTrustiscore(userId);
      if (!calculated.success || !calculated.data) {
        return calculated;
      }

      const adminClient = supabaseAdmin || supabase;

      // Update or insert trustiscore
      const { error } = await adminClient
        .from('trustiscore')
        .upsert({
          user_id: userId,
          score: calculated.data.score,
          level: calculated.data.level,
          factors: calculated.data.factors || {},
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        return {
          success: false,
          message: 'Failed to update trustiscore',
          error: 'Failed to update trustiscore',
        };
      }

      return {
        success: true,
        message: 'Trustiscore updated successfully',
        data: {
          score: calculated.data.score,
          level: calculated.data.level,
        },
      };
    } catch (error) {
      console.error('Error updating trustiscore:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update trustiscore',
        error: error instanceof Error ? error.message : 'Failed to update trustiscore',
      };
    }
  }
}

export const trustiscoreService = new TrustiscoreService();




