/**
 * Escrow Service
 * Handles escrow operations and statistics
 */

import { supabase, supabaseAdmin } from '../../config/supabase';
import { CreateEscrowRequest, Escrow } from '../../types/api/escrow.types';
import { xrplEscrowService } from '../../xrpl/escrow/xrpl-escrow.service';
import { exchangeService } from '../exchange/exchange.service';

export class EscrowService {
  /**
   * Get active escrows count and locked amount for a user
   */
  async getActiveEscrows(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      count: number;
      lockedAmount: number;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get active escrows (pending or active status)
      const { data: escrows, error } = await adminClient
        .from('escrows')
        .select('amount_usd')
        .eq('user_id', userId)
        .in('status', ['pending', 'active']);

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch active escrows',
          error: 'Failed to fetch active escrows',
        };
      }

      const count = escrows?.length || 0;
      const lockedAmount = escrows?.reduce((sum, escrow) => sum + parseFloat(escrow.amount_usd), 0) || 0;

      return {
        success: true,
        message: 'Active escrows retrieved successfully',
        data: {
          count,
          lockedAmount: parseFloat(lockedAmount.toFixed(2)),
        },
      };
    } catch (error) {
      console.error('Error getting active escrows:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get active escrows',
        error: error instanceof Error ? error.message : 'Failed to get active escrows',
      };
    }
  }

  /**
   * Get total escrowed amount (all time, all statuses)
   */
  async getTotalEscrowed(userId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      totalEscrowed: number;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get all escrows for user
      const { data: escrows, error } = await adminClient
        .from('escrows')
        .select('amount_usd')
        .eq('user_id', userId);

      if (error) {
        return {
          success: false,
          message: 'Failed to fetch escrows',
          error: 'Failed to fetch escrows',
        };
      }

      const totalEscrowed = escrows?.reduce((sum, escrow) => sum + parseFloat(escrow.amount_usd), 0) || 0;

      return {
        success: true,
        message: 'Total escrowed retrieved successfully',
        data: {
          totalEscrowed: parseFloat(totalEscrowed.toFixed(2)),
        },
      };
    } catch (error) {
      console.error('Error getting total escrowed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get total escrowed',
        error: error instanceof Error ? error.message : 'Failed to get total escrowed',
      };
    }
  }

  /**
   * Create a new escrow
   */
  async createEscrow(userId: string, request: CreateEscrowRequest): Promise<{
    success: boolean;
    message: string;
    data?: {
      escrowId: string;
      amount: {
        usd: number;
        xrp: number;
      };
      status: string;
      xrplEscrowId?: string;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get user's wallet
      const { data: wallet } = await adminClient
        .from('wallets')
        .select('xrpl_address')
        .eq('user_id', userId)
        .single();

      if (!wallet) {
        return {
          success: false,
          message: 'Wallet not found. Please create a wallet first.',
          error: 'Wallet not found. Please create a wallet first.',
        };
      }

      // Get counterparty wallet
      const { data: counterpartyWallet } = await adminClient
        .from('wallets')
        .select('xrpl_address')
        .eq('user_id', request.counterpartyId)
        .single();

      if (!counterpartyWallet) {
        return {
          success: false,
          message: 'Counterparty wallet not found',
          error: 'Counterparty wallet not found',
        };
      }

      // Convert amount to XRP if needed
      let amountXrp = request.amount;
      let amountUsd = request.amount;

      if (request.currency === 'USD') {
        const exchangeRates = await exchangeService.getLiveExchangeRates();
        const usdRate = exchangeRates.data?.rates.find(r => r.currency === 'USD')?.rate || 0.5430;
        amountXrp = request.amount / usdRate;
      } else {
        const exchangeRates = await exchangeService.getLiveExchangeRates();
        const usdRate = exchangeRates.data?.rates.find(r => r.currency === 'USD')?.rate || 0.5430;
        amountUsd = request.amount * usdRate;
      }

      // Create escrow on XRPL
      const xrplTxHash = await xrplEscrowService.createEscrow({
        fromAddress: wallet.xrpl_address,
        toAddress: counterpartyWallet.xrpl_address,
        amountXrp,
      });

      // Create escrow record in database
      const { data: escrow, error: escrowError } = await adminClient
        .from('escrows')
        .insert({
          user_id: userId,
          counterparty_id: request.counterpartyId,
          amount_xrp: amountXrp,
          amount_usd: amountUsd,
          status: 'pending',
          xrpl_escrow_id: xrplTxHash,
          description: request.description,
        })
        .select()
        .single();

      if (escrowError || !escrow) {
        return {
          success: false,
          message: 'Failed to create escrow',
          error: 'Failed to create escrow',
        };
      }

      // Create transaction record
      await adminClient
        .from('transactions')
        .insert({
          user_id: userId,
          type: 'escrow_create',
          amount_xrp: amountXrp,
          amount_usd: amountUsd,
          xrpl_tx_hash: xrplTxHash,
          status: 'completed',
          escrow_id: escrow.id,
          description: `Escrow created: ${request.description || 'No description'}`,
        });

      return {
        success: true,
        message: 'Escrow created successfully',
        data: {
          escrowId: escrow.id,
          amount: {
            usd: parseFloat(amountUsd.toFixed(2)),
            xrp: parseFloat(amountXrp.toFixed(6)),
          },
          status: escrow.status,
          xrplEscrowId: xrplTxHash,
        },
      };
    } catch (error) {
      console.error('Error creating escrow:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create escrow',
        error: error instanceof Error ? error.message : 'Failed to create escrow',
      };
    }
  }

  /**
   * Get escrow list for a user
   */
  async getEscrowList(userId: string, limit: number = 50, offset: number = 0): Promise<{
    success: boolean;
    message: string;
    data?: {
      escrows: Escrow[];
      total: number;
    };
    error?: string;
  }> {
    try {
      const adminClient = supabaseAdmin || supabase;

      // Get escrows where user is initiator or counterparty
      const { data: escrows, error: escrowError } = await adminClient
        .from('escrows')
        .select('*')
        .or(`user_id.eq.${userId},counterparty_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Get counterparty names separately
      const counterpartyIds = [...new Set((escrows || [])
        .map(e => e.counterparty_id)
        .filter((id): id is string => id !== null))];

      let counterpartyMap: Record<string, string> = {};
      if (counterpartyIds.length > 0) {
        const { data: counterparties } = await adminClient
          .from('users')
          .select('id, full_name')
          .in('id', counterpartyIds);

        counterpartyMap = (counterparties || []).reduce((acc, user) => {
          acc[user.id] = user.full_name;
          return acc;
        }, {} as Record<string, string>);
      }

      // Get total count
      const { count } = await adminClient
        .from('escrows')
        .select('*', { count: 'exact', head: true })
        .or(`user_id.eq.${userId},counterparty_id.eq.${userId}`);

      if (escrowError) {
        return {
          success: false,
          message: 'Failed to fetch escrows',
          error: 'Failed to fetch escrows',
        };
      }

      const formattedEscrows: Escrow[] = (escrows || []).map(escrow => ({
        id: escrow.id,
        counterpartyId: escrow.counterparty_id || '',
        counterpartyName: escrow.counterparty_id ? counterpartyMap[escrow.counterparty_id] : undefined,
        amount: {
          usd: parseFloat(escrow.amount_usd),
          xrp: parseFloat(escrow.amount_xrp),
        },
        status: escrow.status,
        description: escrow.description || undefined,
        xrplEscrowId: escrow.xrpl_escrow_id || undefined,
        createdAt: escrow.created_at,
        updatedAt: escrow.updated_at,
        completedAt: escrow.completed_at || undefined,
      }));

      return {
        success: true,
        message: 'Escrows retrieved successfully',
        data: {
          escrows: formattedEscrows,
          total: count || 0,
        },
      };
    } catch (error) {
      console.error('Error getting escrow list:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get escrow list',
        error: error instanceof Error ? error.message : 'Failed to get escrow list',
      };
    }
  }
}

export const escrowService = new EscrowService();


