import { Request, Response } from 'express';
import {
  DashboardDisplayCurrencyResponse,
  DashboardSummaryResponse,
} from '../types/api/dashboard.types';
import { walletService } from '../services/wallet/wallet.service';
import { escrowService } from '../services/escrow/escrow.service';
import { trustiscoreService } from '../services/trustiscore/trustiscore.service';
import { userService } from '../services/user/user.service';
import { SUPPORTED_DISPLAY_CURRENCIES } from '../types/api/currency.types';

export class DashboardController {
  /**
   * Get dashboard summary (aggregates all dashboard data)
   * GET /api/dashboard/summary
   */
  async getDashboardSummary(req: Request, res: Response<DashboardSummaryResponse>): Promise<void> {
    try {
      const userId = req.userId!; // Set by auth middleware

      // Fetch all dashboard data in parallel
      const [balanceResult, activeEscrowsResult, totalEscrowedResult, trustiscoreResult, displayCurrency] =
        await Promise.all([
        walletService.getBalance(userId),
        escrowService.getActiveEscrows(userId),
        escrowService.getTotalEscrowed(userId),
        trustiscoreService.getTrustiscore(userId),
        userService.getDisplayCurrency(userId),
      ]);

      // Check for errors
      if (!balanceResult.success || !activeEscrowsResult.success || !totalEscrowedResult.success || !trustiscoreResult.success) {
        res.status(500).json({
          success: false,
          message: 'Failed to fetch dashboard data',
          error: 'Data fetch error',
        });
        return;
      }

      const balance = balanceResult.data!.balance;
      // Wallet-scoped lock: initiator escrows on this (personal) wallet only.
      // Do not use getActiveEscrows here — that mixes business-suite and counterparty deals.
      const lockedAmount = Math.max(0, Number(balance.lockedUsd) || 0);
      const grossUsd =
        balance.grossUsd ??
        parseFloat((balance.usd + lockedAmount).toFixed(2));
      const netUsd = Math.max(0, parseFloat((grossUsd - lockedAmount).toFixed(2)));

      res.status(200).json({
        success: true,
        message: 'Dashboard summary retrieved successfully',
        data: {
          balance: {
            ...balance,
            grossUsd,
            lockedUsd: lockedAmount,
            totalUsd: grossUsd,
            availableUsd: netUsd,
            usd: grossUsd,
          },
          addresses: balanceResult.data!.addresses,
          activeEscrows: {
            count: activeEscrowsResult.data!.count,
            lockedAmount,
          },
          trustiscore: {
            score: trustiscoreResult.data!.score,
            level: trustiscoreResult.data!.level,
          },
          totalEscrowed: totalEscrowedResult.data!.totalEscrowed,
          displayCurrency,
        },
      });
    } catch (error) {
      console.error('Error in getDashboardSummary:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Get saved display currency for portfolio graph / dashboard fiat display.
   * GET /api/dashboard/display-currency
   */
  async getDisplayCurrency(
    req: Request,
    res: Response<DashboardDisplayCurrencyResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const displayCurrency = await userService.getDisplayCurrency(userId);
      res.status(200).json({
        success: true,
        message: 'Display currency retrieved successfully',
        data: { displayCurrency },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * Persist dashboard currency selection (portfolio graph + fiat display).
   * PATCH /api/dashboard/display-currency
   */
  async updateDisplayCurrency(
    req: Request,
    res: Response<DashboardDisplayCurrencyResponse>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const body = req.body ?? {};
      const result = await userService.updateUserPreferences(userId, body);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Display currency saved successfully',
          data: { displayCurrency: result.data!.displayCurrency },
        });
        return;
      }

      res.status(400).json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  /**
   * List supported display currency codes for the dashboard selector.
   * GET /api/dashboard/display-currencies
   */
  async listDisplayCurrencies(_req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        message: 'Supported display currencies retrieved successfully',
        data: {
          currencies: [...SUPPORTED_DISPLAY_CURRENCIES],
          defaultCurrency: 'USD',
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }
}

export const dashboardController = new DashboardController();






