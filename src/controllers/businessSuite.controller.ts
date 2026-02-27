import { Request, Response } from 'express';
import { businessSuiteService } from '../services/businessSuite/businessSuite.service';
import { businessSuiteDashboardService } from '../services/businessSuite/businessSuiteDashboard.service';
import { businessSuiteTeamsService } from '../services/businessSuite/businessSuiteTeams.service';
import type { BusinessSuiteActivityListParams, BusinessSuiteActivityStatus, BusinessSuitePortfolioPeriod } from '../types/api/businessSuiteDashboard.types';

export class BusinessSuiteController {
  /**
   * Verify 6-digit business suite PIN (when switching from personal to business).
   * POST /api/business-suite/verify-pin
   */
  async verifyPin(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const pin = req.body?.pin;
    if (typeof pin !== 'string') {
      res.status(400).json({ success: false, message: 'PIN is required (string)' });
      return;
    }
    const result = await businessSuiteService.verifyPin(userId, pin.trim());
    if (result.success) {
      res.status(200).json(result);
    } else if (result.error === 'PIN not set') {
      res.status(400).json(result);
    } else if (result.error === 'Invalid PIN' || result.error === 'Invalid format') {
      res.status(401).json(result);
    } else {
      res.status(403).json(result);
    }
  }

  /**
   * Set or update 6-digit business suite PIN.
   * POST /api/business-suite/set-pin
   */
  async setPin(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const pin = req.body?.pin;
    if (typeof pin !== 'string') {
      res.status(400).json({ success: false, message: 'PIN is required (string)' });
      return;
    }
    const result = await businessSuiteService.setPin(userId, pin.trim());
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  }

  /**
   * Get PIN status: isBusinessSuite and pinSet (for UI to show set vs verify).
   * GET /api/business-suite/pin-status
   */
  async getPinStatus(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteService.getPinStatus(userId);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  }

  /**
   * Business suite dashboard summary (balance, escrows, trustiscore, payrolls, suppliers, completed this month).
   * GET /api/business-suite/dashboard/summary
   */
  async getDashboardSummary(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteDashboardService.getDashboardSummary(userId);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(403).json(result);
    }
  }

  /**
   * Business suite activity list (paginated escrows created by this user).
   * GET /api/business-suite/dashboard/activity
   */
  async getActivityList(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const status = req.query.status as BusinessSuiteActivityStatus | undefined;
    const page = req.query.page != null ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : undefined;
    const sortBy = req.query.sortBy as 'created_at' | 'updated_at' | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    const params: BusinessSuiteActivityListParams = { status, page, pageSize, sortBy, sortOrder };
    const result = await businessSuiteDashboardService.getActivityList(userId, params);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(403).json(result);
    }
  }

  /**
   * Portfolio chart: Subscription and Payroll by period (monthly, weekly, quarterly, yearly).
   * GET /api/business-suite/dashboard/portfolio
   */
  async getPortfolioChart(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const period = (req.query.period as BusinessSuitePortfolioPeriod) || 'monthly';
    const validPeriods: BusinessSuitePortfolioPeriod[] = ['weekly', 'monthly', 'quarterly', 'yearly'];
    const periodParam = validPeriods.includes(period) ? period : 'monthly';
    const year = req.query.year != null ? Number(req.query.year) : undefined;
    const result = await businessSuiteDashboardService.getPortfolioChart(userId, periodParam, year);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(403).json(result);
    }
  }

  /**
   * My Teams list (paginated). GET /api/business-suite/teams
   */
  async getTeamList(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const page = Math.max(1, req.query.page != null ? Number(req.query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, req.query.pageSize != null ? Number(req.query.pageSize) : 10));
    const result = await businessSuiteTeamsService.getTeamList(userId, page, pageSize);
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(403).json(result);
    }
  }

  /**
   * Single team detail with members (View). GET /api/business-suite/teams/:id
   */
  async getTeamDetail(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const teamId = req.params.id;
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team ID required' });
      return;
    }
    const result = await businessSuiteTeamsService.getTeamDetail(userId, teamId);
    if (result.success) {
      res.status(200).json(result);
    } else if (result.error === 'Team not found') {
      res.status(404).json(result);
    } else {
      res.status(403).json(result);
    }
  }

  /**
   * Upcoming Supply list (business escrows pending/active with due date). GET /api/business-suite/dashboard/upcoming-supply
   */
  async getUpcomingSupply(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const page = Math.max(1, req.query.page != null ? Number(req.query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, req.query.pageSize != null ? Number(req.query.pageSize) : 10));
    const result = await businessSuiteDashboardService.getUpcomingSupply(userId, page, pageSize);
    if (result.success) res.status(200).json(result);
    else res.status(403).json(result);
  }

  /**
   * Subscription list (business escrows type=subscription, next payment date). GET /api/business-suite/dashboard/subscription
   */
  async getSubscriptionList(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const page = Math.max(1, req.query.page != null ? Number(req.query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, req.query.pageSize != null ? Number(req.query.pageSize) : 10));
    const result = await businessSuiteDashboardService.getSubscriptionList(userId, page, pageSize);
    if (result.success) res.status(200).json(result);
    else res.status(403).json(result);
  }
}

export const businessSuiteController = new BusinessSuiteController();
