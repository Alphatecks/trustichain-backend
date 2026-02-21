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
} from '../../types/api/adminEscrowManagement.types';
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
} from '../../types/api/adminDisputeResolution.types';
import { adminEscrowManagementService } from '../services/adminEscrowManagement.service';
import { adminTransactionManagementService } from '../services/adminTransactionManagement.service';
import { adminDisputeResolutionService } from '../services/adminDisputeResolution.service';

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
}

export const adminController = new AdminController();
