/**
 * Business Suite Teams API Types (My Teams)
 */

/** Request body for POST /api/business-suite/teams (create team) */
export interface CreateTeamRequest {
  name: string;
  nextDate?: string; // YYYY-MM-DD
}

/** Request body for POST /api/business-suite/teams/:teamId/members (add team member - full modal) */
export interface AddTeamMemberRequest {
  /** Step 1: Personal details */
  email: string;
  phoneNumber?: string;
  country?: string;
  address?: string;
  gender?: 'Male' | 'Female' | 'Other';
  /** Step 2: Job details */
  jobTitle?: string;
  employmentType?: 'Full time' | 'part time' | 'contract';
  status?: string;
  dateJoined?: string; // YYYY-MM-DD
  currency?: string;
  defaultSalaryType?: string;
  salaryAmount?: number;
  disbursementMode?: 'Auto Release' | 'Manual Release';
  /** Step 3: Payment details */
  accountType?: 'Bank Transfer' | 'Wallet Transfer';
  walletType?: string;
  walletAddress?: string;
  network?: string;
}

export interface BusinessSuiteTeamListItem {
  id: string;
  name: string;
  memberCount: number;
  nextDate: string | null;
  createdAt: string;
}

export interface BusinessSuiteTeamListResponse {
  success: boolean;
  message: string;
  data?: {
    items: BusinessSuiteTeamListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

export interface BusinessSuiteTeamMemberItem {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  addedAt: string;
}

export interface BusinessSuiteTeamDetailResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    name: string;
    nextDate: string | null;
    createdAt: string;
    updatedAt: string;
    members: BusinessSuiteTeamMemberItem[];
  };
  error?: string;
}
