import { Request, Response } from 'express';
import { adminService } from '../services/admin.service';
import { adminDashboardService } from '../services/adminDashboard.service';
import { adminUserManagementService } from '../services/adminUserManagement.service';
import { AdminLoginRequest, AdminLoginResponse, AdminLogoutResponse } from '../../types/api/admin.types';
import type {
  AdminOverviewResponse,
  AdminEscrowInsightResponse,
  AdminDisputeResolutionResponse,
  AdminLiveTransactionsFeedResponse,
  AdminUserOverviewResponse,
  AdminKycListResponse,
  AdminKycDetailResponse,
  AdminKycApproveResponse,
  AdminSearchResponse,
  AdminAlertsResponse,
  AdminBusinessListResponse,
} from '../../types/api/adminDashboard.types';
import type {
  UserManagementStatsResponse,
  UserManagementListResponse,
  UserManagementDetailResponse,
  UserManagementUpdateKycResponse,
  UserManagementBatchKycResponse,
} from '../../types/api/adminUserManagement.types';
import type {
  AdminEscrowManagementStatsResponse,
  AdminEscrowListResponse,
  AdminEscrowDetailResponse,
  AdminEscrowUpdateStatusResponse,
  AdminEscrowFeesBalanceResponse,
  AdminEscrowFeesWithdrawResponse,
} from '../../types/api/adminEscrowManagement.types';
import type {
  AdminBusinessManagementOverviewResponse,
  AdminBusinessActivityListResponse,
  AdminBusinessActivityDetailResponse,
} from '../../types/api/adminBusinessManagement.types';
import type {
  AdminTransactionOverviewResponse,
  AdminTransactionListResponse,
  AdminTransactionDetailResponse,
} from '../../types/api/adminTransactionManagement.types';
import type {
  AdminDisputeMetricsResponse,
  AdminDisputeAlertsResponse,
  AdminDisputeListResponse,
  AdminDisputeDetailResponse,
  AdminDisputeDetailScreenResponse,
  AdminAssignMediatorResponse,
  AdminDisputeEvidenceListResponse,
  AdminDisputeTimelineListResponse,
  AdminDisputeVerdictResponse,
  AdminDisputeAssessmentResponse,
  AdminDisputeMessagesResponse,
} from '../../types/api/adminDisputeResolution.types';
import type {
  AdminSettingsProfileResponse,
  AdminNotificationSettingsResponse,
  AdminSendPushResponse,
} from '../../types/api/adminSettings.types';
import { adminEscrowManagementService } from '../services/adminEscrowManagement.service';
import { adminBusinessManagementService } from '../services/adminBusinessManagement.service';
import { adminTransactionManagementService } from '../services/adminTransactionManagement.service';
import { adminDisputeResolutionService } from '../services/adminDisputeResolution.service';
import { adminSettingsService } from '../services/adminSettings.service';

export class AdminController {
  /**
   * Login an admin
   * POST /api/admin/login
   */
  async login(req: Request, res: Response<AdminLoginResponse>): Promise<void> {
    try {
      const loginData: AdminLoginRequest = req.body;
      const result = await adminService.login(loginData);

      if (result.success) {
        res.status(200).json(result);
      } else {
        // Return 401 for authentication failures
        res.status(401).json(result);
      }
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
   * Logout an admin
   * POST /api/admin/logout
   */
  async logout(req: Request, res: Response<AdminLogoutResponse>): Promise<void> {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'Authorization token required',
          error: 'Unauthorized',
        });
        return;
      }

      const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix
      const result = await adminService.logout(accessToken);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: 'Internal server error',
      });
    }
  }

  // --- Dashboard (admin only) ---

  async getOverview(_req: Request, res: Response<AdminOverviewResponse>): Promise<void> {
    const result = await adminDashboardService.getOverview();
    res.status(result.success ? 200 : 500).json(result);
  }

  async getEscrowInsight(req: Request, res: Response<AdminEscrowInsightResponse>): Promise<void> {
    const period = (req.query.period as string) || 'last_month';
    const result = await adminDashboardService.getEscrowInsight(period);
    res.status(result.success ? 200 : 500).json(result);
  }

  async getDisputeResolution(req: Request, res: Response<AdminDisputeResolutionResponse>): Promise<void> {
    const period = (req.query.period as string) || 'last_6_months';
    const result = await adminDashboardService.getDisputeResolution(period);
    res.status(result.success ? 200 : 500).json(result);
  }

  async getLiveTransactionsFeed(req: Request, res: Response<AdminLiveTransactionsFeedResponse>): Promise<void> {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const result = await adminDashboardService.getLiveTransactionsFeed(limit);
    res.status(result.success ? 200 : 500).json(result);
  }

  async getUserOverview(req: Request, res: Response<AdminUserOverviewResponse>): Promise<void> {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const result = await adminDashboardService.getUserOverview(limit, offset);
    res.status(result.success ? 200 : 500).json(result);
  }

  async getKycList(_req: Request, res: Response<AdminKycListResponse>): Promise<void> {
    const result = await adminDashboardService.getKycList();
    res.status(result.success ? 200 : 500).json(result);
  }

  async getBusinesses(req: Request, res: Response<AdminBusinessListResponse>): Promise<void> {
    const page = req.query.page != null ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : undefined;
    const status = (req.query.status as string) || undefined;
    const result = await adminDashboardService.getBusinesses({ page, pageSize, status });
    res.status(result.success ? 200 : 500).json(result);
  }

  async updateBusinessKycStatus(req: Request, res: Response): Promise<void> {
    const businessId = req.params.businessId as string;
    const status = req.body?.status as string;
    const adminId = req.admin?.id;
    if (!businessId || !status || !adminId) {
      res.status(400).json({
        success: false,
        message: 'businessId, status, and admin auth required',
        error: 'Bad request',
      });
      return;
    }
    const allowed = ['In review', 'Verified', 'Rejected'];
    if (!allowed.includes(status)) {
      res.status(400).json({
        success: false,
        message: `status must be one of: ${allowed.join(', ')}`,
        error: 'Bad request',
      });
      return;
    }
    const result = await adminDashboardService.updateBusinessKycStatus(
      businessId,
      status as 'In review' | 'Verified' | 'Rejected',
      adminId
    );
    res.status(result.success ? 200 : 404).json(result);
  }

  async getKycDetail(req: Request, res: Response<AdminKycDetailResponse>): Promise<void> {
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ success: false, message: 'userId required', error: 'Bad request' });
      return;
    }
    const result = await adminDashboardService.getKycDetail(userId);
    res.status(result.success ? 200 : 404).json(result);
  }

  async approveKyc(req: Request, res: Response<AdminKycApproveResponse>): Promise<void> {
    const userId = req.body?.userId as string;
    const status = req.body?.status as 'verified' | 'declined' | 'suspended';
    const adminId = req.admin?.id;
    if (!userId || !status || !adminId) {
      res.status(400).json({
        success: false,
        message: 'userId, status, and admin auth required',
        error: 'Bad request',
      });
      return;
    }
    if (!['verified', 'declined', 'suspended'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'status must be verified, declined, or suspended',
        error: 'Bad request',
      });
      return;
    }
    const result = await adminDashboardService.approveKyc(userId, status, adminId);
    res.status(result.success ? 200 : 400).json(result);
  }

  async approveBusinessSuiteKyc(req: Request, res: Response): Promise<void> {
    const userId = req.body?.userId as string;
    const status = req.body?.status as string;
    const adminId = req.admin?.id;
    if (!userId || !status || !adminId) {
      res.status(400).json({
        success: false,
        message: 'userId, status, and admin auth required',
        error: 'Bad request',
      });
      return;
    }
    const allowed = ['In review', 'Verified', 'Rejected'];
    if (!allowed.includes(status)) {
      res.status(400).json({
        success: false,
        message: `status must be one of: ${allowed.join(', ')}`,
        error: 'Bad request',
      });
      return;
    }
    const result = await adminDashboardService.approveBusinessSuiteKyc(userId, status as 'In review' | 'Verified' | 'Rejected', adminId);
    res.status(result.success ? 200 : 400).json(result);
  }

  async search(req: Request, res: Response<AdminSearchResponse>): Promise<void> {
    const q = (req.query.q as string) || '';
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const result = await adminDashboardService.search(q, limit);
    res.status(result.success ? 200 : 500).json(result);
  }

  async getAlerts(_req: Request, res: Response<AdminAlertsResponse>): Promise<void> {
    const result = await adminDashboardService.getAlerts();
    res.status(result.success ? 200 : 500).json(result);
  }

  // --- User Management (admin only) ---

  async getUserManagementStats(_req: Request, res: Response<UserManagementStatsResponse>): Promise<void> {
    const result = await adminUserManagementService.getStats();
    res.status(result.success ? 200 : 500).json(result);
  }

  async getUserManagementUsers(req: Request, res: Response<UserManagementListResponse>): Promise<void> {
    const searchQuery = req.query.searchQuery as string | undefined;
    const accountType = req.query.accountType as 'personal' | 'business_suite' | undefined;
    const kycStatus = req.query.kycStatus as import('../../types/api/adminUserManagement.types').UserManagementKycStatus | undefined;
    const page = req.query.page != null ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : undefined;
    const sortBy = req.query.sortBy as string | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    const result = await adminUserManagementService.getUsers({
      searchQuery,
      accountType,
      kycStatus,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });
    res.status(result.success ? 200 : 500).json(result);
  }

  async getUserManagementUserById(req: Request, res: Response<UserManagementDetailResponse>): Promise<void> {
    const userId = req.params.userId;
    if (!userId) {
      res.status(400).json({ success: false, message: 'userId required', error: 'Bad request' });
      return;
    }
    const walletPage = req.query.walletPage != null ? Number(req.query.walletPage) : undefined;
    const walletPageSize = req.query.walletPageSize != null ? Number(req.query.walletPageSize) : undefined;
    const escrowPage = req.query.escrowPage != null ? Number(req.query.escrowPage) : undefined;
    const escrowPageSize = req.query.escrowPageSize != null ? Number(req.query.escrowPageSize) : undefined;
    const transactionLimit = req.query.transactionLimit != null ? Number(req.query.transactionLimit) : undefined;
    const disputeLimit = req.query.disputeLimit != null ? Number(req.query.disputeLimit) : undefined;
    const result = await adminUserManagementService.getUserById(userId, {
      walletPage,
      walletPageSize,
      escrowPage,
      escrowPageSize,
      transactionLimit,
      disputeLimit,
    });
    res.status(result.success ? 200 : 404).json(result);
  }

  async updateUserKycStatus(req: Request, res: Response<UserManagementUpdateKycResponse>): Promise<void> {
    const userId = req.params.userId;
    const status = req.body?.status as import('../../types/api/adminUserManagement.types').UserManagementKycStatus | undefined;
    const adminId = req.admin?.id;
    if (!userId || !status || !adminId) {
      res.status(400).json({
        success: false,
        message: 'userId, status, and admin auth required',
        error: 'Bad request',
      });
      return;
    }
    const validStatuses = ['verified', 'pending', 'declined', 'suspended'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'status must be one of: verified, pending, declined, suspended',
        error: 'Bad request',
      });
      return;
    }
    const result = await adminUserManagementService.updateUserKycStatus(userId, status, adminId);
    res.status(result.success ? 200 : 400).json(result);
  }

  async batchUpdateUserKycStatus(req: Request, res: Response<UserManagementBatchKycResponse>): Promise<void> {
    const userIds = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
    const status = req.body?.status as import('../../types/api/adminUserManagement.types').UserManagementKycStatus | undefined;
    const adminId = req.admin?.id;
    if (!adminId || !status) {
      res.status(400).json({
        success: false,
        message: 'userIds, status, and admin auth required',
        error: 'Bad request',
      });
      return;
    }
    const validStatuses = ['verified', 'pending', 'declined', 'suspended'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: 'status must be one of: verified, pending, declined, suspended',
        error: 'Bad request',
      });
      return;
    }
    const result = await adminUserManagementService.batchUpdateKycStatus(userIds, status, adminId);
    res.status(result.success ? 200 : 400).json(result);
  }

  // --- Escrow Management (admin only) ---

  async getEscrowManagementStats(_req: Request, res: Response<AdminEscrowManagementStatsResponse>): Promise<void> {
    const result = await adminEscrowManagementService.getStats();
    res.status(result.success ? 200 : 500).json(result);
  }

  async getEscrowManagementList(req: Request, res: Response<AdminEscrowListResponse>): Promise<void> {
    const search = req.query.search as string | undefined;
    const status = req.query.status as import('../../types/api/adminEscrowManagement.types').AdminEscrowStatus | undefined;
    const page = req.query.page != null ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : undefined;
    const sortBy = req.query.sortBy as 'created_at' | 'amount_usd' | 'status' | 'updated_at' | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    const result = await adminEscrowManagementService.getEscrowList({
      search,
      status,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });
    res.status(result.success ? 200 : 500).json(result);
  }

  async getEscrowManagementDetail(req: Request, res: Response<AdminEscrowDetailResponse>): Promise<void> {
    const idOrRef = req.params.idOrRef;
    if (!idOrRef) {
      res.status(400).json({ success: false, message: 'Escrow id required', error: 'Bad request' });
      return;
    }
    const result = await adminEscrowManagementService.getEscrowDetail(idOrRef);
    res.status(result.success ? 200 : 404).json(result);
  }

  async updateEscrowManagementStatus(req: Request, res: Response<AdminEscrowUpdateStatusResponse>): Promise<void> {
    const idOrRef = req.params.idOrRef;
    const status = req.body?.status as import('../../types/api/adminEscrowManagement.types').AdminEscrowStatus | undefined;
    if (!idOrRef || !status) {
      res.status(400).json({
        success: false,
        message: 'Escrow id and status required',
        error: 'Bad request',
      });
      return;
    }
    const validStatuses = ['pending', 'active', 'completed', 'cancelled', 'disputed'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `status must be one of: ${validStatuses.join(', ')}`,
        error: 'Bad request',
      });
      return;
    }
    const result = await adminEscrowManagementService.updateEscrowStatus(idOrRef, status);
    res.status(result.success ? 200 : result.error === 'Not found' ? 404 : 400).json(result);
  }

  async getEscrowFeesBalance(_req: Request, res: Response<AdminEscrowFeesBalanceResponse>): Promise<void> {
    const result = await adminEscrowManagementService.getEscrowFeesBalance();
    res.status(result.success ? 200 : 500).json(result);
  }

  async withdrawEscrowFees(req: Request, res: Response<AdminEscrowFeesWithdrawResponse>): Promise<void> {
    const body = req.body as { amountUsd?: number; destinationXrplAddress?: string };
    const amountUsd = body?.amountUsd != null ? Number(body.amountUsd) : NaN;
    const destinationXrplAddress = typeof body?.destinationXrplAddress === 'string' ? body.destinationXrplAddress : '';
    const adminId = req.admin?.id;
    if (!Number.isFinite(amountUsd) || !destinationXrplAddress) {
      res.status(400).json({
        success: false,
        message: 'amountUsd and destinationXrplAddress are required',
        error: 'Bad request',
      });
      return;
    }
    const result = await adminEscrowManagementService.withdrawEscrowFees(amountUsd, destinationXrplAddress, adminId);
    res.status(result.success ? 200 : 400).json(result);
  }

  // --- Business Management (admin only) ---

  async getBusinessManagementOverview(_req: Request, res: Response<AdminBusinessManagementOverviewResponse>): Promise<void> {
    const result = await adminBusinessManagementService.getOverview();
    res.status(result.success ? 200 : 500).json(result);
  }

  async getBusinessManagementActivities(req: Request, res: Response<AdminBusinessActivityListResponse>): Promise<void> {
    const search = req.query.search as string | undefined;
    const status = req.query.status as import('../../types/api/adminBusinessManagement.types').AdminBusinessActivityStatus | undefined;
    const page = req.query.page != null ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : undefined;
    const sortBy = req.query.sortBy as 'created_at' | 'updated_at' | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    const result = await adminBusinessManagementService.getActivities({
      search,
      status,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });
    res.status(result.success ? 200 : 500).json(result);
  }

  async getBusinessManagementActivityDetail(req: Request, res: Response<AdminBusinessActivityDetailResponse>): Promise<void> {
    const idOrRef = req.params.idOrRef;
    if (!idOrRef) {
      res.status(400).json({ success: false, message: 'Activity id required', error: 'Bad request' });
      return;
    }
    const result = await adminBusinessManagementService.getActivityDetail(idOrRef);
    res.status(result.success ? 200 : 404).json(result);
  }

  // --- Transaction Management (admin only) ---

  async getTransactionManagementOverview(_req: Request, res: Response<AdminTransactionOverviewResponse>): Promise<void> {
    const result = await adminTransactionManagementService.getOverview();
    res.status(result.success ? 200 : 500).json(result);
  }

  async getTransactionManagementList(req: Request, res: Response<AdminTransactionListResponse>): Promise<void> {
    const search = req.query.search as string | undefined;
    const accountType = req.query.accountType as 'personal' | 'business_suite' | undefined;
    const status = req.query.status as import('../../types/api/adminTransactionManagement.types').AdminTransactionStatus | undefined;
    const type = req.query.type as import('../../types/api/adminTransactionManagement.types').AdminTransactionType | undefined;
    const page = req.query.page != null ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : undefined;
    const sortBy = req.query.sortBy as 'created_at' | 'amount_usd' | 'status' | 'type' | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    const result = await adminTransactionManagementService.getTransactionList({
      search,
      accountType,
      status,
      type,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });
    res.status(result.success ? 200 : 500).json(result);
  }

  async getTransactionManagementDetail(req: Request, res: Response<AdminTransactionDetailResponse>): Promise<void> {
    const transactionId = req.params.transactionId;
    if (!transactionId) {
      res.status(400).json({ success: false, message: 'Transaction id required', error: 'Bad request' });
      return;
    }
    const result = await adminTransactionManagementService.getTransactionDetail(transactionId);
    res.status(result.success ? 200 : 404).json(result);
  }

  // --- Dispute Resolution (admin only) ---

  async getDisputeResolutionMetrics(_req: Request, res: Response<AdminDisputeMetricsResponse>): Promise<void> {
    const result = await adminDisputeResolutionService.getMetrics();
    res.status(result.success ? 200 : 500).json(result);
  }

  async getDisputeResolutionAlerts(req: Request, res: Response<AdminDisputeAlertsResponse>): Promise<void> {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const result = await adminDisputeResolutionService.getAlerts(limit);
    res.status(result.success ? 200 : 500).json(result);
  }

  async getDisputeResolutionList(req: Request, res: Response<AdminDisputeListResponse>): Promise<void> {
    const search = req.query.search as string | undefined;
    const status = req.query.status as import('../../types/api/adminDisputeResolution.types').AdminDisputeStatus | undefined;
    const page = req.query.page != null ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize != null ? Number(req.query.pageSize) : undefined;
    const sortBy = req.query.sortBy as 'opened_at' | 'resolved_at' | 'status' | 'amount_usd' | undefined;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;
    const result = await adminDisputeResolutionService.getDisputeList({
      search,
      status,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });
    res.status(result.success ? 200 : 500).json(result);
  }

  async getDisputeResolutionDetail(req: Request, res: Response<AdminDisputeDetailResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    if (!idOrCaseId) {
      res.status(400).json({ success: false, message: 'Dispute id or case id required', error: 'Bad request' });
      return;
    }
    const result = await adminDisputeResolutionService.getDisputeDetail(idOrCaseId);
    res.status(result.success ? 200 : 404).json(result);
  }

  // --- Dispute Chat Details Screen (admin only) ---

  async getDisputeDetailScreen(req: Request, res: Response<AdminDisputeDetailScreenResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    if (!idOrCaseId) {
      res.status(400).json({ success: false, message: 'Dispute id or case id required', error: 'Bad request' });
      return;
    }
    const result = await adminDisputeResolutionService.getDisputeDetailScreen(idOrCaseId);
    res.status(result.success ? 200 : 404).json(result);
  }

  async assignDisputeMediator(req: Request, res: Response<AdminAssignMediatorResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    const mediatorUserId = req.body?.mediatorUserId as string;
    if (!idOrCaseId || !mediatorUserId) {
      res.status(400).json({ success: false, message: 'Dispute id and mediatorUserId required', error: 'Bad request' });
      return;
    }
    const result = await adminDisputeResolutionService.assignMediator(idOrCaseId, mediatorUserId);
    res.status(result.success ? 200 : 404).json(result);
  }

  async getDisputeEvidence(req: Request, res: Response<AdminDisputeEvidenceListResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    if (!idOrCaseId) {
      res.status(400).json({ success: false, message: 'Dispute id required', error: 'Bad request' });
      return;
    }
    const result = await adminDisputeResolutionService.getEvidence(idOrCaseId);
    res.status(result.success ? 200 : 404).json(result);
  }

  async addDisputeEvidence(req: Request, res: Response<AdminDisputeEvidenceListResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    const body = req.body as { title?: string; description?: string; evidenceType?: string; fileUrl: string; fileName: string; fileType: string; fileSize: number };
    if (!idOrCaseId || !body?.fileUrl || !body?.fileName || body.fileType == null || body.fileSize == null) {
      res.status(400).json({ success: false, message: 'Dispute id and fileUrl, fileName, fileType, fileSize required', error: 'Bad request' });
      return;
    }
    const adminId = req.admin?.id;
    const result = await adminDisputeResolutionService.addEvidence(idOrCaseId, {
      title: body.title || 'Evidence',
      description: body.description,
      evidenceType: body.evidenceType,
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      fileType: body.fileType,
      fileSize: Number(body.fileSize),
    }, adminId);
    res.status(result.success ? 200 : 404).json(result);
  }

  async updateDisputeEvidence(req: Request, res: Response<AdminDisputeEvidenceListResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    const evidenceId = req.params.evidenceId;
    const body = req.body as { verified?: boolean; title?: string; description?: string };
    if (!idOrCaseId || !evidenceId) {
      res.status(400).json({ success: false, message: 'Dispute id and evidence id required', error: 'Bad request' });
      return;
    }
    const result = await adminDisputeResolutionService.updateEvidence(idOrCaseId, evidenceId, body);
    res.status(result.success ? 200 : 404).json(result);
  }

  async getDisputeTimeline(req: Request, res: Response<AdminDisputeTimelineListResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    if (!idOrCaseId) {
      res.status(400).json({ success: false, message: 'Dispute id required', error: 'Bad request' });
      return;
    }
    const result = await adminDisputeResolutionService.getTimeline(idOrCaseId);
    res.status(result.success ? 200 : 404).json(result);
  }

  async createDisputeTimelineEvent(req: Request, res: Response<AdminDisputeTimelineListResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    const body = req.body as { eventType: string; title: string; description?: string };
    if (!idOrCaseId || !body?.eventType || !body?.title) {
      res.status(400).json({ success: false, message: 'Dispute id, eventType, and title required', error: 'Bad request' });
      return;
    }
    const adminId = req.admin?.id;
    const result = await adminDisputeResolutionService.createTimelineEvent(idOrCaseId, body, adminId);
    res.status(result.success ? 200 : 404).json(result);
  }

  async getDisputeVerdict(req: Request, res: Response<AdminDisputeVerdictResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    if (!idOrCaseId) {
      res.status(400).json({ success: false, message: 'Dispute id required', error: 'Bad request' });
      return;
    }
    const result = await adminDisputeResolutionService.getVerdict(idOrCaseId);
    res.status(result.success ? 200 : 404).json(result);
  }

  async submitDisputeVerdict(req: Request, res: Response<AdminDisputeVerdictResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    const body = req.body as { finalVerdict: string; decisionSummary?: string; decisionOutcome?: string };
    if (!idOrCaseId || !body?.finalVerdict) {
      res.status(400).json({ success: false, message: 'Dispute id and finalVerdict required', error: 'Bad request' });
      return;
    }
    const result = await adminDisputeResolutionService.submitVerdict(idOrCaseId, body);
    res.status(result.success ? 200 : 404).json(result);
  }

  async getDisputePreliminaryAssessment(req: Request, res: Response<AdminDisputeAssessmentResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    if (!idOrCaseId) {
      res.status(400).json({ success: false, message: 'Dispute id required', error: 'Bad request' });
      return;
    }
    const result = await adminDisputeResolutionService.getPreliminaryAssessment(idOrCaseId);
    res.status(result.success ? 200 : 404).json(result);
  }

  async upsertDisputePreliminaryAssessment(req: Request, res: Response<AdminDisputeAssessmentResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    const body = req.body as { title?: string; summary?: string; findings: Array<{ findingText: string; findingType?: string; orderIndex?: number }> };
    const adminId = req.admin?.id;
    if (!idOrCaseId || !adminId) {
      res.status(400).json({ success: false, message: 'Dispute id and admin auth required', error: 'Bad request' });
      return;
    }
    if (!Array.isArray(body?.findings)) {
      res.status(400).json({ success: false, message: 'findings array required', error: 'Bad request' });
      return;
    }
    const result = await adminDisputeResolutionService.upsertPreliminaryAssessment(idOrCaseId, body, adminId);
    res.status(result.success ? 200 : 404).json(result);
  }

  async getDisputeMessages(req: Request, res: Response<AdminDisputeMessagesResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    if (!idOrCaseId) {
      res.status(400).json({ success: false, message: 'Dispute id required', error: 'Bad request' });
      return;
    }
    const result = await adminDisputeResolutionService.getMessages(idOrCaseId, limit);
    res.status(result.success ? 200 : 404).json(result);
  }

  async sendDisputeMessage(req: Request, res: Response<AdminDisputeMessagesResponse>): Promise<void> {
    const idOrCaseId = req.params.idOrCaseId;
    const body = req.body as { messageText: string; senderRole?: 'admin' | 'mediator' };
    const adminId = req.admin?.id;
    if (!idOrCaseId || !adminId) {
      res.status(400).json({ success: false, message: 'Dispute id and admin auth required', error: 'Bad request' });
      return;
    }
    if (!body?.messageText || typeof body.messageText !== 'string') {
      res.status(400).json({ success: false, message: 'messageText required', error: 'Bad request' });
      return;
    }
    const result = await adminDisputeResolutionService.sendMessage(idOrCaseId, { messageText: body.messageText, senderRole: body.senderRole });
    res.status(result.success ? 200 : 404).json(result);
  }

  // --- Admin Settings ---

  async getSettingsProfile(req: Request, res: Response<AdminSettingsProfileResponse>): Promise<void> {
    const adminId = req.admin?.id;
    if (!adminId) {
      res.status(401).json({ success: false, message: 'Admin auth required', error: 'Unauthorized' });
      return;
    }
    const result = await adminSettingsService.getProfile(adminId);
    res.status(result.success ? 200 : 404).json(result);
  }

  async updateSettingsProfile(req: Request, res: Response<AdminSettingsProfileResponse>): Promise<void> {
    const adminId = req.admin?.id;
    if (!adminId) {
      res.status(401).json({ success: false, message: 'Admin auth required', error: 'Unauthorized' });
      return;
    }
    const body = req.body as { fullName?: string; email?: string };
    const result = await adminSettingsService.updateProfile(adminId, body);
    res.status(result.success ? 200 : 400).json(result);
  }

  async updateSettingsProfilePhoto(req: Request, res: Response<AdminSettingsProfileResponse>): Promise<void> {
    const adminId = req.admin?.id;
    if (!adminId) {
      res.status(401).json({ success: false, message: 'Admin auth required', error: 'Unauthorized' });
      return;
    }
    const body = req.body as { avatarUrl?: string };
    if (!body?.avatarUrl || typeof body.avatarUrl !== 'string') {
      res.status(400).json({ success: false, message: 'avatarUrl required', error: 'Bad request' });
      return;
    }
    const result = await adminSettingsService.updateProfilePhoto(adminId, body.avatarUrl);
    res.status(result.success ? 200 : 400).json(result);
  }

  async removeSettingsProfilePhoto(req: Request, res: Response<AdminSettingsProfileResponse>): Promise<void> {
    const adminId = req.admin?.id;
    if (!adminId) {
      res.status(401).json({ success: false, message: 'Admin auth required', error: 'Unauthorized' });
      return;
    }
    const result = await adminSettingsService.removeProfilePhoto(adminId);
    res.status(result.success ? 200 : 400).json(result);
  }

  async getSettingsNotifications(req: Request, res: Response<AdminNotificationSettingsResponse>): Promise<void> {
    const adminId = req.admin?.id;
    if (!adminId) {
      res.status(401).json({ success: false, message: 'Admin auth required', error: 'Unauthorized' });
      return;
    }
    const result = await adminSettingsService.getNotificationSettings(adminId);
    res.status(result.success ? 200 : 404).json(result);
  }

  async updateSettingsNotifications(req: Request, res: Response<AdminNotificationSettingsResponse>): Promise<void> {
    const adminId = req.admin?.id;
    if (!adminId) {
      res.status(401).json({ success: false, message: 'Admin auth required', error: 'Unauthorized' });
      return;
    }
    const body = req.body as { emailNotifications?: boolean; pushNotifications?: boolean };
    const result = await adminSettingsService.updateNotificationSettings(adminId, body);
    res.status(result.success ? 200 : 400).json(result);
  }

  async sendPushNotification(req: Request, res: Response<AdminSendPushResponse>): Promise<void> {
    const body = req.body as { title?: string; message?: string; sendTo?: string };
    if (!body?.title || !body?.message) {
      res.status(400).json({ success: false, message: 'title and message required', error: 'Bad request' });
      return;
    }
    if (body.sendTo !== undefined && body.sendTo !== 'all') {
      res.status(400).json({ success: false, message: 'sendTo must be "all"', error: 'Bad request' });
      return;
    }
    const result = await adminSettingsService.sendPushNotification(body.title, body.message, 'all');
    res.status(result.success ? 200 : 400).json(result);
  }
}

export const adminController = new AdminController();
