/**
 * Business Suite Dashboard API Types
 */

export interface BusinessSuiteDashboardSummaryData {
  balance: {
    xrp: number;
    usdt: number;
    usdc: number;
    usd: number;
  };
  activeEscrows: {
    count: number;
    lockedAmount: number;
  };
  trustiscore: {
    score: number;
    level: string;
  };
  totalEscrowed: number;
  payrollsCreated: number;
  suppliers: number;
  completedThisMonth: number;
}

export interface BusinessSuiteDashboardSummaryResponse {
  success: boolean;
  message: string;
  data?: BusinessSuiteDashboardSummaryData;
  error?: string;
}

export type BusinessSuiteActivityStatus = 'In progress' | 'Completed' | 'Pending';

export interface BusinessSuiteActivityListItem {
  id: string;
  activityId: string;
  description: {
    name: string;
    address: string;
  };
  status: BusinessSuiteActivityStatus;
  date: string;
  createdAt: string;
  amountUsd?: number;
}

export interface BusinessSuiteActivityListParams {
  status?: BusinessSuiteActivityStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'created_at' | 'updated_at';
  sortOrder?: 'asc' | 'desc';
}

export interface BusinessSuiteActivityListResponse {
  success: boolean;
  message: string;
  data?: {
    items: BusinessSuiteActivityListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

/** Portfolio chart: Subscription and Payroll by period (monthly/weekly/quarterly/yearly) */
export type BusinessSuitePortfolioPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface BusinessSuitePortfolioDataPoint {
  period: string;
  subscriptionUsd: number;
  payrollUsd: number;
  subscriptionPercent: number;
  payrollPercent: number;
}

export interface BusinessSuitePortfolioChartResponse {
  success: boolean;
  message: string;
  data?: {
    period: BusinessSuitePortfolioPeriod;
    year?: number;
    data: BusinessSuitePortfolioDataPoint[];
  };
  error?: string;
}
