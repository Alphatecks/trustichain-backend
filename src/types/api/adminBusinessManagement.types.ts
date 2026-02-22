/**
 * Admin Business Management API Types
 * Overview stats and business activities (escrows) for the Business Management dashboard.
 */

export interface AdminBusinessManagementOverview {
  payrollsCreated: number;
  payrollsCreatedChangePercent?: number;
  suppliers: number;
  suppliersChangePercent?: number;
  apiIntegrated: number;
  averageResTimeHours: number;
  averageResTimeLabel: string;
}

export interface AdminBusinessManagementOverviewResponse {
  success: boolean;
  message: string;
  data?: AdminBusinessManagementOverview;
  error?: string;
}

export type AdminBusinessActivityStatus = 'In progress' | 'Completed' | 'Pending';

export interface AdminBusinessActivityListItem {
  id: string;
  activityId: string;
  description: {
    name: string;
    address: string;
  };
  status: AdminBusinessActivityStatus;
  date: string;
  createdAt: string;
}

export interface AdminBusinessActivityListParams {
  search?: string;
  status?: AdminBusinessActivityStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

export interface AdminBusinessActivityListResponse {
  success: boolean;
  message: string;
  data?: {
    items: AdminBusinessActivityListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

export interface AdminBusinessActivityDetailResponse {
  success: boolean;
  message: string;
  data?: AdminBusinessActivityDetail;
  error?: string;
}

export interface AdminBusinessActivityDetail {
  id: string;
  activityId: string;
  description: { name: string; address: string };
  status: AdminBusinessActivityStatus;
  date: string;
  party1: { id: string; name: string; email?: string };
  party2: { id: string | null; name: string; email?: string } | null;
  amountUsd: number;
  amountXrp: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  transactionType?: string;
  industry?: string;
}
