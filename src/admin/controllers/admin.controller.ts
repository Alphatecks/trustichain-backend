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
    const result = await adminUserManagementService.getUserById(userId);
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
}

export const adminController = new AdminController();
