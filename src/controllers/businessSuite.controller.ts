import { Request, Response } from 'express';
import { businessSuiteService } from '../services/businessSuite/businessSuite.service';
import { businessSuiteDashboardService } from '../services/businessSuite/businessSuiteDashboard.service';
import { businessSuiteTeamsService } from '../services/businessSuite/businessSuiteTeams.service';
import { businessSuitePayrollsService } from '../services/businessSuite/businessSuitePayrolls.service';
import { businessSuiteSuppliersService } from '../services/businessSuite/businessSuiteSuppliers.service';
import { businessSuiteSupplyContractsService } from '../services/businessSuite/businessSuiteSupplyContracts.service';
import { businessSuiteSupplierDisputesService } from '../services/businessSuite/businessSuiteSupplierDisputes.service';
import { businessSuitePayrollDisputesService } from '../services/businessSuite/businessSuitePayrollDisputes.service';
import { businessSuiteKycService } from '../services/businessSuite/businessSuiteKyc.service';
import { businessSuiteApiKeysService } from '../services/businessSuite/businessSuiteApiKeys.service';
import { lookupService } from '../services/lookup/lookup.service';
import { walletService } from '../services/wallet/wallet.service';
import { storageService } from '../services/storage/storage.service';
import { escrowService } from '../services/escrow/escrow.service';
import type { BusinessSuiteActivityListParams, BusinessSuiteActivityStatus, BusinessSuitePortfolioPeriod } from '../types/api/businessSuiteDashboard.types';
import type { CreatePayrollRequest, UpdatePayrollRequest } from '../types/api/businessSuitePayrolls.types';
import type { ListApiKeysQuery } from '../types/api/businessSuiteApiKeys.types';

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
   * Create a new team. POST /api/business-suite/teams
   */
  async createTeam(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteTeamsService.createTeam(userId, req.body || {});
    if (result.success) {
      res.status(201).json(result);
    } else if (result.error === 'Missing name') {
      res.status(400).json(result);
    } else {
      res.status(403).json(result);
    }
  }

  /**
   * Get team members by team name. GET /api/business-suite/teams/members?name=
   */
  async getTeamMembersByName(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const teamName = typeof req.query.name === 'string' ? req.query.name : '';
    const result = await businessSuiteTeamsService.getTeamMembersByTeamName(userId, teamName);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Missing team name') res.status(400).json(result);
    else if (result.error === 'Team not found') res.status(404).json(result);
    else res.status(403).json(result);
  }

  /**
   * Check team member by full name. POST /api/business-suite/teams/members/check (body: { fullName }) or query ?fullName=
   */
  async checkTeamMemberByName(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const fullName =
      (req.body && typeof (req.body as { fullName?: string }).fullName === 'string'
        ? (req.body as { fullName: string }).fullName
        : null) ?? (typeof req.query.fullName === 'string' ? req.query.fullName : '');
    const result = await businessSuiteTeamsService.checkTeamMemberByFullName(userId, fullName);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Missing full name' || result.error === 'User not found') res.status(400).json(result);
    else if (result.error === 'Cannot add self') res.status(403).json(result);
    else res.status(403).json(result);
  }

  /**
   * Add team member (full modal: personal, job, payment). POST /api/business-suite/teams/:teamId/members
   */
  async addTeamMember(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const teamId = req.params.teamId ?? req.params.id;
    if (!teamId) {
      res.status(400).json({ success: false, message: 'Team ID required' });
      return;
    }
    const result = await businessSuiteTeamsService.addTeamMember(userId, teamId, req.body || {});
    if (result.success) {
      res.status(201).json(result);
    } else if (result.error === 'Missing email' || result.error === 'User not found' || result.error === 'Already a member') {
      res.status(400).json(result);
    } else if (result.error === 'Team not found') {
      res.status(404).json(result);
    } else {
      res.status(403).json(result);
    }
  }

  /**
   * Remove team member. DELETE /api/business-suite/teams/:teamId/members/:memberId
   */
  async removeTeamMember(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const teamId = req.params.teamId;
    const memberId = req.params.memberId;
    if (!teamId || !memberId) {
      res.status(400).json({ success: false, message: 'Team ID and member ID are required' });
      return;
    }
    const result = await businessSuiteTeamsService.removeTeamMember(userId, teamId, memberId);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Team not found' || result.error === 'Member not found') res.status(404).json(result);
    else res.status(403).json(result);
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

  /**
   * Supply contracts escrowed to the current business (modal on balance card). Only visible to the counterparty (Business A).
   * GET /api/business-suite/supply-contracts/escrowed-to-me
   */
  /**
   * Supplier contract overview stats (Total supplier, Pending supplier, Total Supplier Amount). GET /api/business-suite/supply-contracts/overview
   */
  async getSupplierContractOverview(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteDashboardService.getSupplierContractOverview(userId);
    if (result.success) res.status(200).json(result);
    else res.status(403).json(result);
  }

  /**
   * API Keys overview stats (Total Active Keys, API Requests, Failed Requests, Avg Latency).
   * GET /api/business-suite/api-keys/overview
   */
  async getApiKeysOverview(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteApiKeysService.getApiKeysOverview(userId);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'No business') res.status(400).json(result);
    else res.status(403).json(result);
  }

  /**
   * Create a new API key (Create New API Key modal). keySecret returned only once.
   * POST /api/business-suite/api-keys
   */
  async createApiKey(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteApiKeysService.createApiKey(userId, req.body || {});
    if (result.success) res.status(201).json(result);
    else if (result.error === 'No business' || result.error === 'Validation') res.status(400).json(result);
    else res.status(403).json(result);
  }

  /**
   * List API keys for dashboard table. Query: type (all|main|mobile|backend), month (YYYY-MM), page, pageSize.
   * GET /api/business-suite/api-keys
   */
  async listApiKeys(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const query: ListApiKeysQuery = {
      type: req.query.type as ListApiKeysQuery['type'],
      month: typeof req.query.month === 'string' ? req.query.month : undefined,
      page: req.query.page != null ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize != null ? Number(req.query.pageSize) : undefined,
    };
    const result = await businessSuiteApiKeysService.listApiKeys(userId, query);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'No business') res.status(400).json(result);
    else res.status(403).json(result);
  }

  /**
   * Single API key detail (no secret). GET /api/business-suite/api-keys/:id
   */
  async getApiKeyDetail(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const keyId = req.params.id;
    if (!keyId) {
      res.status(400).json({ success: false, message: 'API key ID required', error: 'Missing id' });
      return;
    }
    const result = await businessSuiteApiKeysService.getApiKeyDetail(userId, keyId);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else if (result.error === 'No business') res.status(400).json(result);
    else res.status(403).json(result);
  }

  /**
   * Update API key (Details modal: label, permissions, IPs, rotate, disable). PATCH /api/business-suite/api-keys/:id
   */
  async updateApiKey(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const keyId = req.params.id;
    if (!keyId) {
      res.status(400).json({ success: false, message: 'API key ID required', error: 'Missing id' });
      return;
    }
    const result = await businessSuiteApiKeysService.updateApiKey(userId, keyId, req.body || {});
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else if (result.error === 'No business' || result.error === 'Validation') res.status(400).json(result);
    else res.status(403).json(result);
  }

  /**
   * Regenerate API key secret. New secret returned once. POST /api/business-suite/api-keys/:id/regenerate
   */
  async regenerateApiKey(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const keyId = req.params.id;
    if (!keyId) {
      res.status(400).json({ success: false, message: 'API key ID required', error: 'Missing id' });
      return;
    }
    const result = await businessSuiteApiKeysService.regenerateApiKey(userId, keyId);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else if (result.error === 'No business') res.status(400).json(result);
    else res.status(403).json(result);
  }

  /**
   * Delete API key. DELETE /api/business-suite/api-keys/:id
   */
  async deleteApiKey(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const keyId = req.params.id;
    if (!keyId) {
      res.status(400).json({ success: false, message: 'API key ID required', error: 'Missing id' });
      return;
    }
    const result = await businessSuiteApiKeysService.deleteApiKey(userId, keyId);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else if (result.error === 'No business') res.status(400).json(result);
    else res.status(403).json(result);
  }

  /**
   * Supply contracts created by this business (creator view). Use for supply status list with release.
   * GET /api/business-suite/supply-contracts/created-by-me
   */
  async getSupplyContractsCreatedByMe(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteDashboardService.getSupplyContractsCreatedByMe(userId);
    if (result.success) res.status(200).json(result);
    else res.status(403).json(result);
  }

  /**
   * Single supply contract detail for contractor modal (includes contract documents).
   * GET /api/business-suite/supply-contracts/created-by-me/:escrowId
   */
  async getSupplyContractCreatedByMeDetail(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const escrowId = req.params.escrowId;
    if (!escrowId) {
      res.status(400).json({ success: false, message: 'Escrow ID required', error: 'Missing escrowId' });
      return;
    }
    const result = await businessSuiteDashboardService.getSupplyContractCreatedByMeDetail(userId, escrowId);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else res.status(403).json(result);
  }

  async getSupplyContractsEscrowedToMe(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteDashboardService.getSupplyContractsEscrowedToMe(userId);
    if (result.success) res.status(200).json(result);
    else res.status(403).json(result);
  }

  /**
   * Mark supply contract as delivered (supplier). POST /api/business-suite/supply-contracts/escrowed-to-me/:escrowId/mark-delivered
   */
  async markSupplyContractDelivered(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const escrowId = req.params.escrowId;
    if (!escrowId) {
      res.status(400).json({ success: false, message: 'Escrow ID required', error: 'Missing escrowId' });
      return;
    }
    const result = await businessSuiteDashboardService.markSupplyContractDelivered(userId, escrowId);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else res.status(403).json(result);
  }

  /**
   * Request buyer confirmation (supplier). Sends email to buyer. POST .../escrowed-to-me/:escrowId/request-buyer-confirmation
   */
  async requestSupplyContractBuyerConfirmation(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const escrowId = req.params.escrowId;
    if (!escrowId) {
      res.status(400).json({ success: false, message: 'Escrow ID required', error: 'Missing escrowId' });
      return;
    }
    const result = await businessSuiteDashboardService.requestSupplyContractBuyerConfirmation(userId, escrowId);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else res.status(403).json(result);
  }

  /**
   * Upload proof-of-completion document (supplier). POST .../escrowed-to-me/:escrowId/documents/upload-completion
   */
  async uploadSupplierCompletionDocument(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const escrowId = req.params.escrowId;
    const file = req.file;
    if (!escrowId) {
      res.status(400).json({ success: false, message: 'Escrow ID required', error: 'Missing escrowId' });
      return;
    }
    const result = await businessSuiteDashboardService.uploadSupplierCompletionDocument(userId, escrowId, file);
    if (result.success) res.status(201).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else if (result.error === 'Missing file') res.status(400).json(result);
    else res.status(403).json(result);
  }

  /**
   * Single supply contract detail for supplier modal (Escrow contract + terms + documents from contractor).
   * GET /api/business-suite/supply-contracts/escrowed-to-me/:escrowId
   */
  async getSupplyContractEscrowedToMeDetail(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const escrowId = req.params.escrowId;
    if (!escrowId) {
      res.status(400).json({ success: false, message: 'Escrow ID required', error: 'Missing escrowId' });
      return;
    }
    const result = await businessSuiteDashboardService.getSupplyContractEscrowedToMeDetail(userId, escrowId);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else res.status(403).json(result);
  }

  /**
   * Release a supplier contract escrow (locked escrow). Creator (owner) or counterparty can release; manual or on/after release day.
   * POST /api/business-suite/supply-contracts/escrowed-to-me/:escrowId/release
   */
  async releaseSupplyContractEscrow(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const escrowIdParam = req.params.escrowId;
    if (!escrowIdParam) {
      res.status(400).json({ success: false, message: 'Escrow ID required', error: 'Missing escrowId' });
      return;
    }
    const resolvedId = await businessSuiteDashboardService.getResolvedEscrowIdForRelease(escrowIdParam, userId);
    if (!resolvedId) {
      res.status(404).json({ success: false, message: 'Contract not found or access denied', error: 'Not found' });
      return;
    }
    const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;
    const result = await escrowService.releaseEscrow(userId, resolvedId, notes);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Escrow not found or access denied') res.status(404).json(result);
    else if (result.error === 'Escrow is already completed') res.status(400).json(result);
    else if (result.error === 'Cannot release a cancelled escrow') res.status(400).json(result);
    else res.status(400).json(result);
  }

  /**
   * File dispute for suppliers. POST /api/business-suite/supplier-disputes
   */
  async fileSupplierDispute(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteSupplierDisputesService.fileSupplierDispute(userId, req.body || {});
    if (result.success) res.status(201).json(result);
    else if (result.error === 'Missing supplier reference' || result.error === 'Missing reason' || result.error === 'Missing description' || result.error === 'Invalid amount') res.status(400).json(result);
    else if (result.error === 'Supplier not found' || result.error === 'Escrow not found' || result.error === 'Payer wallet not found' || result.error === 'Respondent wallet not found') res.status(404).json(result);
    else res.status(403).json(result);
  }

  /**
   * Create supplier contract (Contract Info + Payment Terms). POST /api/business-suite/supply-contracts
   */
  async createSupplierContract(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteSupplyContractsService.createSupplierContract(userId, req.body || {});
    if (result.success) res.status(201).json(result);
    else if (result.error === 'Supplier not registered') res.status(404).json(result);
    else if (result.error === 'Missing supplier name' || result.error === 'Invalid wallet address' || result.error === 'Invalid payment amount') res.status(400).json(result);
    else res.status(403).json(result);
  }

  /**
   * Set or append contract document URLs for a supply contract (contractor only).
   * PATCH /api/business-suite/supply-contracts/created-by-me/:escrowId/documents
   */
  async updateSupplyContractDocuments(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const escrowId = req.params.escrowId;
    if (!escrowId) {
      res.status(400).json({ success: false, message: 'Escrow ID required', error: 'Missing escrowId' });
      return;
    }
    const result = await businessSuiteSupplyContractsService.updateSupplyContractDocuments(userId, escrowId, req.body || {});
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else res.status(400).json(result);
  }

  /**
   * Upload a contract document (Invoice, Agreement, Delivery Terms) for supply contracts. POST /api/business-suite/supply-contracts/documents/upload
   */
  async uploadSupplyContractDocument(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const access = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!access.allowed) {
      res.status(403).json({ success: false, message: 'Business suite is not enabled for this account', error: access.error });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No file provided. Send multipart form with field "document".' });
      return;
    }
    const result = await storageService.uploadSupplyContractDocument(userId, file);
    if (result.success && result.data) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          fileUrl: result.data.fileUrl,
          fileName: result.data.fileName,
          fileSize: result.data.fileSize,
          fileType: result.data.fileType,
        },
      });
    } else {
      res.status(400).json({ success: false, message: result.message ?? 'Upload failed', error: result.error });
    }
  }

  /**
   * Get a signed URL to view a supply contract document (bucket is private; stored public URL 404s).
   * GET /api/business-suite/supply-contracts/documents/signed-url?url=<encoded-document-url>
   */
  async getSupplyContractDocumentSignedUrl(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const access = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!access.allowed) {
      res.status(403).json({ success: false, message: 'Business suite is not enabled for this account', error: access.error });
      return;
    }
    const rawUrl = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
    if (!rawUrl) {
      res.status(400).json({ success: false, message: 'Query parameter "url" is required', error: 'Missing url' });
      return;
    }
    let decoded = rawUrl;
    try {
      decoded = decodeURIComponent(rawUrl);
    } catch {
      // use rawUrl
    }
    // Allow any URL/path that references our storage bucket (supply docs and other contract docs live there)
    const bucketName = 'dispute-evidence';
    if (!decoded.includes(bucketName) && !decoded.startsWith('supply-contract-docs') && !decoded.includes('supply-completion-docs')) {
      res.status(400).json({ success: false, message: 'Invalid document URL for supply contract', error: 'Invalid url' });
      return;
    }
    const expiresIn = 3600;
    const signedUrl = await storageService.getSignedUrlForSupplyContractDocument(decoded, expiresIn);
    if (!signedUrl) {
      res.status(404).json({ success: false, message: 'Could not generate view link for this document', error: 'Not found' });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Signed URL generated',
      data: { signedUrl, expiresIn },
    });
  }

  /** Create new supplier. POST /api/business-suite/suppliers */
  async createSupplier(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteSuppliersService.createSupplier(userId, req.body || {});
    if (result.success) res.status(201).json(result);
    else if (result.error === 'Supplier not registered') res.status(404).json(result);
    else if (result.error === 'Missing name' || result.error === 'Missing supplier name' || result.error === 'Invalid due date' || result.error === 'Invalid amount') res.status(400).json(result);
    else res.status(403).json(result);
  }

  /** Supplier details list (cards). GET /api/business-suite/suppliers/details */
  async getSupplierDetails(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteSuppliersService.getSupplierDetails(userId);
    if (result.success) res.status(200).json(result);
    else res.status(403).json(result);
  }

  /** Supplier transaction history (table: transactionId, supplierName, amount, status, type). GET /api/business-suite/suppliers/transactions */
  async getSupplierTransactionHistory(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const page = req.query.page != null ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : undefined;
    const month = req.query.month as string | undefined;
    const status = req.query.status as string | undefined;
    const result = await businessSuiteSuppliersService.getSupplierTransactionHistory(userId, {
      page,
      pageSize,
      month,
      status,
    });
    if (result.success) res.status(200).json(result);
    else res.status(403).json(result);
  }

  /** Check if supplier (business) name is registered. POST /api/business-suite/suppliers/check */
  async checkSupplierRegistered(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const name = (req.body && (req.body as { name?: string }).name) ?? (req.query.name as string) ?? '';
    const result = await businessSuiteSuppliersService.checkSupplierRegistered(userId, name);
    if (!result.success) res.status(403).json(result);
    else res.status(200).json(result);
  }

  /**
   * Check if the business account has a business email. GET /api/business-suite/business-email/status
   */
  async getBusinessEmailStatus(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteService.getBusinessEmailStatus(userId);
    if (result.success) res.status(200).json(result);
    else res.status(500).json(result);
  }

  /**
   * Set or update business contact email. PATCH /api/business-suite/business-email (body: { businessEmail })
   */
  async setBusinessEmail(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const businessEmail = (req.body?.businessEmail ?? req.body?.business_email ?? req.query.businessEmail ?? req.query.business_email) as string | undefined;
    const result = await businessSuiteService.setBusinessEmail(userId, businessEmail ?? '');
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Missing business email' || result.error === 'Invalid email') res.status(400).json(result);
    else if (result.error === 'No business') res.status(403).json(result);
    else res.status(400).json(result);
  }

  /**
   * Get company (business) name for the account with the given email.
   * GET /api/business-suite/company-name?email=
   */
  async getCompanyNameByEmail(req: Request, res: Response): Promise<void> {
    const email = (req.query.email as string) ?? (req.body?.email as string) ?? '';
    const result = await lookupService.getBusinessNameByEmail(email);
    if (!result.success) {
      res.status(400).json({ success: false, message: result.message, error: result.error });
      return;
    }
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  }

  /** Get business suite KYC (uses business_suite_kyc table). GET /api/business-suite/kyc */
  async getKyc(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteKycService.getKyc(userId);
    if (result.success) res.status(200).json(result);
    else res.status(403).json(result);
  }

  /** Submit/update business suite KYC verification. POST /api/business-suite/kyc */
  async submitKyc(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuiteKycService.submitKyc(userId, req.body || {});
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Missing companyName') res.status(400).json(result);
    else res.status(403).json(result);
  }

  /** Upload company logo for KYC (image only). POST /api/business-suite/kyc/logo, multipart field: logo */
  async uploadKycLogo(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const status = await businessSuiteService.getBusinessStatus(userId);
    if (status === 'In review') {
      res.status(403).json({ success: false, message: 'Account is under review; access is temporarily suspended.' });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No file provided. Send multipart form with field "logo".' });
      return;
    }
    const result = await storageService.uploadCompanyLogo(userId, file);
    if (result.success && result.data?.fileUrl) {
      res.status(200).json({ success: true, data: { companyLogoUrl: result.data.fileUrl } });
    } else {
      res.status(400).json({ success: false, message: result.message ?? 'Upload failed' });
    }
  }

  /** Upload KYC document: logo (image) or identity/address/enhanced-due-diligence (PDF/image). POST /kyc/documents/:type, multipart field: document */
  async uploadKycDocument(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const status = await businessSuiteService.getBusinessStatus(userId);
    if (status === 'In review') {
      res.status(403).json({ success: false, message: 'Account is under review; access is temporarily suspended.' });
      return;
    }
    const type = req.params.type as string;
    const allowed = ['logo', 'identity', 'address', 'enhanced-due-diligence'];
    if (!type || !allowed.includes(type)) {
      res.status(400).json({ success: false, message: 'Invalid type. Use: logo, identity, address, or enhanced-due-diligence.' });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No file provided. Send multipart form with field "document".' });
      return;
    }
    if (type === 'logo') {
      const result = await storageService.uploadCompanyLogo(userId, file);
      if (result.success && result.data?.fileUrl) {
        res.status(200).json({ success: true, data: { companyLogoUrl: result.data.fileUrl } });
      } else {
        res.status(400).json({ success: false, message: result.message ?? 'Upload failed' });
      }
      return;
    }
    const docType = type === 'enhanced-due-diligence' ? 'enhanced_due_diligence' : (type as 'identity' | 'address');
    const result = await storageService.uploadBusinessKycDocument(userId, file, docType);
    if (result.success && result.data?.fileUrl) {
      const key =
        type === 'identity'
          ? 'identityVerificationDocumentUrl'
          : type === 'address'
            ? 'addressVerificationDocumentUrl'
            : 'enhancedDueDiligenceDocumentUrl';
      res.status(200).json({ success: true, data: { [key]: result.data.fileUrl } });
    } else {
      res.status(400).json({ success: false, message: result.message ?? 'Upload failed' });
    }
  }

  /** Create payroll. POST /api/business-suite/payrolls */
  async createPayroll(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuitePayrollsService.createPayroll(userId, req.body as CreatePayrollRequest);
    if (result.success) res.status(201).json(result);
    else res.status(400).json(result);
  }

  /** List payrolls. GET /api/business-suite/payrolls */
  async listPayrolls(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const page = Math.max(1, req.query.page != null ? Number(req.query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, req.query.pageSize != null ? Number(req.query.pageSize) : 20));
    const result = await businessSuitePayrollsService.listPayrolls(userId, page, pageSize);
    if (result.success) res.status(200).json(result);
    else res.status(403).json(result);
  }

  /** Payroll summary (total payroll, team members, escrowed). GET /api/business-suite/payrolls/summary */
  async getPayrollSummary(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuitePayrollsService.getSummary(userId);
    if (result.success) res.status(200).json(result);
    else res.status(403).json(result);
  }

  /** Transaction history. GET /api/business-suite/payrolls/transactions */
  async getPayrollTransactions(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const page = Math.max(1, req.query.page != null ? Number(req.query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, req.query.pageSize != null ? Number(req.query.pageSize) : 20));
    const month = req.query.month as string | undefined;
    const result = await businessSuitePayrollsService.getTransactions(userId, page, pageSize, month);
    if (result.success) res.status(200).json(result);
    else res.status(403).json(result);
  }

  /** Single transaction detail. GET /api/business-suite/payrolls/transactions/:id */
  async getPayrollTransactionDetail(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const itemId = req.params.id;
    if (!itemId) { res.status(400).json({ success: false, message: 'Transaction ID required' }); return; }
    const result = await businessSuitePayrollsService.getTransactionDetail(userId, itemId);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else res.status(403).json(result);
  }

  /** Payroll detail (View). GET /api/business-suite/payrolls/:id */
  async getPayrollDetail(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const payrollId = req.params.id;
    if (!payrollId) { res.status(400).json({ success: false, message: 'Payroll ID required' }); return; }
    const result = await businessSuitePayrollsService.getPayrollDetail(userId, payrollId);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else res.status(403).json(result);
  }

  /** Update payroll (freeze auto-release, name, release date). PATCH /api/business-suite/payrolls/:id */
  async updatePayroll(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const payrollId = req.params.id;
    if (!payrollId) { res.status(400).json({ success: false, message: 'Payroll ID required' }); return; }
    const result = await businessSuitePayrollsService.updatePayroll(userId, payrollId, req.body as UpdatePayrollRequest);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Not found') res.status(404).json(result);
    else res.status(400).json(result);
  }

  /** Release payroll now. POST /api/business-suite/payrolls/:id/release */
  async releasePayroll(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const payrollId = req.params.id;
    if (!payrollId) { res.status(400).json({ success: false, message: 'Payroll ID required' }); return; }
    const result = await businessSuitePayrollsService.releasePayroll(userId, payrollId);
    if (result.success) res.status(200).json(result);
    else if (result.error === 'Payroll not found') res.status(404).json(result);
    else res.status(400).json(result);
  }

  /** File payroll dispute. POST /api/business-suite/payroll-disputes */
  async filePayrollDispute(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const result = await businessSuitePayrollDisputesService.filePayrollDispute(userId, (req.body || {}) as import('../types/api/businessSuitePayrolls.types').FilePayrollDisputeRequest);
    if (result.success) res.status(201).json(result);
    else if (result.error === 'Payroll not found' || result.error === 'Access denied') res.status(404).json(result);
    else res.status(400).json(result);
  }

  /** Upload payroll dispute evidence file. POST /api/business-suite/payroll-disputes/evidence/upload. Multipart field: document. Returns { fileUrl, fileName } for evidence array. */
  async uploadPayrollDisputeEvidence(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const access = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!access.allowed) {
      res.status(403).json({ success: false, message: access.error ?? 'Business suite required', error: access.error });
      return;
    }
    const file = req.file;
    if (!file || !file.buffer) {
      res.status(400).json({ success: false, message: 'No file provided. Send multipart form with field "document".', error: 'Missing file' });
      return;
    }
    const result = await storageService.uploadPayrollDisputeEvidence(userId, file);
    if (result.success && result.data) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          fileUrl: result.data.fileUrl,
          fileName: result.data.fileName,
          fileSize: result.data.fileSize,
          fileType: result.data.fileType,
        },
      });
    } else {
      res.status(400).json({ success: false, message: result.message ?? 'Upload failed', error: result.error });
    }
  }

  /** Business suite wallet balance (separate XRP wallet). GET /api/business-suite/wallet/balance */
  async getWalletBalance(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const status = await businessSuiteService.getBusinessStatus(userId);
    if (status === 'In review') {
      res.status(403).json({ success: false, message: 'Account is under review; you cannot create or use a wallet until review is complete.', error: 'Account under review' });
      return;
    }
    const access = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!access.allowed) {
      res.status(403).json({ success: false, message: 'Business suite is not enabled for this account', error: access.error ?? 'Not business suite' });
      return;
    }
    const result = await walletService.getBalance(userId, 'business');
    if (result.success && result.data) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: { balance: result.data.balance },
        xrplAddress: result.xrpl_address ?? '',
      });
    } else {
      res.status(200).json({
        success: false,
        message: result.message,
        error: result.error ?? 'Failed to fetch balance',
      });
    }
  }

  /** Connect XRPL wallet to business suite (separate from personal). POST /api/business-suite/wallet/connect */
  async connectWallet(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const status = await businessSuiteService.getBusinessStatus(userId);
    if (status === 'In review') {
      res.status(403).json({ success: false, message: 'Account is under review; you cannot create or use a wallet until review is complete.', error: 'Account under review' });
      return;
    }
    const access = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!access.allowed) {
      res.status(403).json({ success: false, message: 'Business suite is not enabled for this account', error: access.error ?? 'Not business suite' });
      return;
    }
    const result = await walletService.connectWallet(userId, req.body || {}, 'business');
    if (result.success) res.status(200).json(result);
    else res.status(400).json(result);
  }

  /** Disconnect business suite XRPL wallet. POST /api/business-suite/wallet/disconnect */
  async disconnectWallet(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const status = await businessSuiteService.getBusinessStatus(userId);
    if (status === 'In review') {
      res.status(403).json({ success: false, message: 'Account is under review; you cannot create or use a wallet until review is complete.', error: 'Account under review' });
      return;
    }
    const access = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!access.allowed) {
      res.status(403).json({ success: false, message: 'Business suite is not enabled for this account', error: access.error ?? 'Not business suite' });
      return;
    }
    const result = await walletService.disconnectWallet(userId, 'business');
    if (result.success) res.status(200).json(result);
    else res.status(400).json(result);
  }

  /** Create custodial wallet for business suite (same as personal create). POST /api/business-suite/wallet/create */
  async createWallet(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const status = await businessSuiteService.getBusinessStatus(userId);
    if (status === 'In review') {
      res.status(403).json({ success: false, message: 'Account is under review; you cannot create or use a wallet until review is complete.', error: 'Account under review' });
      return;
    }
    const access = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!access.allowed) {
      res.status(403).json({ success: false, message: 'Business suite is not enabled for this account', error: access.error ?? 'Not business suite' });
      return;
    }
    const result = await walletService.createWallet(userId, 'business');
    if (result.success && result.data) {
      res.status(200).json({ success: true, message: result.message, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.message, error: result.error || 'Failed to create wallet' });
    }
  }

  /** Create XUMM payload to connect XRPL wallet to business suite (same flow as personal, but for business wallet). POST /api/business-suite/wallet/connect/xumm */
  async connectWalletViaXUMM(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const status = await businessSuiteService.getBusinessStatus(userId);
    if (status === 'In review') {
      res.status(403).json({ success: false, message: 'Account is under review; you cannot create or use a wallet until review is complete.', error: 'Account under review' });
      return;
    }
    const access = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!access.allowed) {
      res.status(403).json({ success: false, message: 'Business suite is not enabled for this account', error: access.error ?? 'Not business suite' });
      return;
    }
    const result = await walletService.connectWalletViaXUMM(userId, 'business');
    if (result.success) res.status(200).json(result);
    else res.status(400).json(result);
  }

  /** Check XUMM connection status and connect business wallet when signed. GET /api/business-suite/wallet/connect/xumm/status?xummUuid=... */
  async checkXUMMConnectionStatus(req: Request, res: Response): Promise<void> {
    const userId = req.userId!;
    const status = await businessSuiteService.getBusinessStatus(userId);
    if (status === 'In review') {
      res.status(403).json({ success: false, message: 'Account is under review; you cannot create or use a wallet until review is complete.', error: 'Account under review' });
      return;
    }
    const access = await businessSuiteService.ensureBusinessSuiteAccess(userId);
    if (!access.allowed) {
      res.status(403).json({ success: false, message: 'Business suite is not enabled for this account', error: access.error ?? 'Not business suite' });
      return;
    }
    const xummUuid = req.query.xummUuid as string;
    if (!xummUuid) {
      res.status(400).json({ success: false, message: 'xummUuid is required', error: 'Missing xummUuid' });
      return;
    }
    const result = await walletService.checkXUMMConnectionStatus(userId, xummUuid, 'business');
    if (result.success) res.status(200).json(result);
    else res.status(400).json(result);
  }
}

export const businessSuiteController = new BusinessSuiteController();
