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

/** Wallet row for User Details > Wallet Details */
export interface UserDetailWalletItem {
  id: string;
  walletName: string;
  walletType: 'savings' | 'xrp';
  amountUsd: number;
  date: string;
  /** XRPL address for xrp wallet type; undefined for savings */
  walletAddress?: string;
}

/** KYC section for User Details */
export interface UserDetailKyc {
  status: UserManagementKycStatus;
  linkedIdType?: string;
  cardNumber?: string;
  walletAddress?: string;
  documents?: {
    liveSelfie?: string;
    front?: string;
    back?: string;
  };
  submittedAt?: string;
  reviewedAt?: string;
}

/** Escrow row for User Details > Escrow Details */
export interface UserDetailEscrowItem {
  id: string;
  escrowIdNo: string;
  partiesInvolved: string;
  amountUsd: number;
  status: string;
  createdAt: string;
}

/** Transaction row for User Details > Transaction type */
export interface UserDetailTransactionItem {
  id: string;
  type: string;
  typeLabel: string;
  description: string;
  amountUsd?: number;
  createdAt: string;
  createdAtAgo: string;
}

/** Dispute row for User Details > API Integrations / Disputes */
export interface UserDetailDisputeItem {
  id: string;
  caseId: string;
  name?: string;
  partiesInvolved: string;
  status: string;
  date: string;
}

export interface UserManagementDetailData {
  /** User ID (same as userId) */
  id: string;
  userId: string;
  name: string;
  email: string;
  profilePictureUrl?: string;
  accountType?: string;
  kycStatus: UserManagementKycStatus;
  /** User's primary XRPL wallet address from wallets table */
  walletAddress?: string;
  nationality?: string;
  country?: string;
  dateOfBirth?: string;
  accountCreatedDate: string;
  totalVolume: number;
  escrowCreatedCount: number;
  savingsAccountCount: number;
  lastActivityTimestamp: string | null;
  lastActivityAgo?: string;
  updatedAt?: string;
  kycSubmittedAt?: string;
  kycReviewedAt?: string;
  /** Wallet Details: main wallet + savings wallets */
  walletDetails: {
    total: number;
    items: UserDetailWalletItem[];
    page: number;
    pageSize: number;
  };
  /** User KYC: linked ID, documents */
  userKyc: UserDetailKyc;
  /** Escrow Details */
  escrowDetails: {
    total: number;
    items: UserDetailEscrowItem[];
    page: number;
    pageSize: number;
  };
  /** Transaction type list */
  transactionHistory: {
    total: number;
    items: UserDetailTransactionItem[];
  };
  /** Disputes (API Integrations / Active Disputes) */
  disputes: {
    total: number;
    items: UserDetailDisputeItem[];
  };
}

export interface UserManagementDetailResponse {
  success: boolean;
  message: string;
  data?: UserManagementDetailData;
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
