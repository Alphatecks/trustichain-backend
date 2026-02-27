/**
 * Business Suite Teams API Types (My Teams)
 */

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
