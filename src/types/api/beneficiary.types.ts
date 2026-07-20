/**
 * Beneficiary (saved Trustitag contact) API types
 */

export interface BeneficiaryItem {
  id: string;
  trustitag: string;
  fullName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface GetBeneficiariesResponse {
  success: boolean;
  message: string;
  data?: BeneficiaryItem[];
  error?: string;
}

export interface RemoveBeneficiaryResponse {
  success: boolean;
  message: string;
  data?: {
    id: string;
    trustitag: string;
  };
  error?: string;
}
