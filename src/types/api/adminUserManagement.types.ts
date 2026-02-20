/**
 * Admin User Management API Types
 * Stats, user list (with filters/pagination), user detail, KYC status update (single + batch).
 */

export type UserManagementKycStatus = 'verified' | 'pending' | 'declined' | 'suspended';

export interface UserManagementStats {
  totalUsers: number;
  totalUsersChangePercent?: number;
  verifiedUsers: number;
  verifiedUsersChangePercent?: number;
  personalSuiteUsers: number;
  personalSuiteUsersChangePercent?: number;
  businessSuiteUsers: number;
  businessSuiteUsersChangePercent?: number;
}

export interface UserManagementStatsResponse {
  success: boolean;
  message: string;
  data?: UserManagementStats;
  error?: string;
}

export interface UserManagementListItem {
  id: string;
  name: string;
  email: string;
  kycStatus: UserManagementKycStatus;
  totalVolume: number;
  escrowCreatedCount: number;
  savingsAccountCount: number;
  accountCreatedDate: string;
  lastActivityTimestamp: string | null;
  lastActivityAgo?: string;
  accountType?: string;
}

export interface UserManagementListResponse {
  success: boolean;
  message: string;
  data?: {
    totalPages: number;
    currentPage: number;
    totalUsers: number;
    pageSize: number;
    users: UserManagementListItem[];
  };
  error?: string;
}

export interface UserManagementDetailResponse {
  success: boolean;
  message: string;
  data?: UserManagementListItem & {
    country?: string;
    updatedAt?: string;
    kycSubmittedAt?: string;
    kycReviewedAt?: string;
  };
  error?: string;
}

export interface UserManagementUpdateKycBody {
  status: UserManagementKycStatus;
}

export interface UserManagementUpdateKycResponse {
  success: boolean;
  message: string;
  data?: { kycStatus: UserManagementKycStatus };
  error?: string;
}

export interface UserManagementBatchKycBody {
  userIds: string[];
  status: UserManagementKycStatus;
}

export interface UserManagementBatchKycResponse {
  success: boolean;
  message: string;
  data?: {
    updated: number;
    failed: number;
    kycStatus: UserManagementKycStatus;
  };
  error?: string;
}
