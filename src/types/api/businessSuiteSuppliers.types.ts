/**
 * Business Suite Suppliers API Types
 */

/** Single card in Supplier details UI: escrow id, contract id, linked supplier id, progress donut, status/due date, amount */
export interface SupplierDetailItem {
  id: string;
  /** Supply contract display ID (SC-YYYY-NNN) */
  contractId: string;
  /** Saved supplier display ID (SUPP-YYYY-NNN) when contract is linked to a supplier row */
  supplierDisplayId?: string | null;
  /** @deprecated Use contractId — legacy alias kept for backward compatibility */
  supplierId: string;
  progressPercentage: number;
  statusDetail: string;
  amount: number;
  dueDate: string | null;
}

export interface SupplierDetailsResponse {
  success: boolean;
  message: string;
  data?: {
    items: SupplierDetailItem[];
  };
  error?: string;
}

/** Saved supplier row for GET /api/business-suite/suppliers */
export interface SupplierListItem {
  id: string;
  supplierDisplayId: string;
  /** Platform-wide ID of the linked supplier business (BSUP-YYYY-NNNNN), when known */
  globalSupplierId?: string | null;
  name: string;
  walletAddress: string | null;
  country: string | null;
  kycStatus: string | null;
  contractType: string | null;
  tags: string[] | null;
  createdAt: string;
}

export interface ListSuppliersResponse {
  success: boolean;
  message: string;
  data?: {
    items: SupplierListItem[];
  };
  error?: string;
}

/** Single row for Supplier transaction history table: transactionId, supplierName, amount (XRP + USD), status, type */
export interface SupplierTransactionListItem {
  id: string;
  transactionId: string;
  supplierName: string;
  amountXrp: number | null;
  amountUsd: number;
  status: string;
  type: 'Received' | 'Sent';
  createdAt: string;
}

export interface SupplierTransactionHistoryParams {
  page?: number;
  pageSize?: number;
  month?: string;
  status?: string;
}

export interface SupplierTransactionHistoryResponse {
  success: boolean;
  message: string;
  data?: {
    items: SupplierTransactionListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

/** Verified business option from GET /api/business-suite/suppliers/autocomplete */
export interface SupplierAutocompleteItem {
  businessId: string;
  companyName: string;
  /** Present when the business is verified and has a global supplier ID */
  globalSupplierId?: string | null;
}

export interface MySupplierIdResponse {
  success: boolean;
  message: string;
  data?: {
    globalSupplierId: string;
  };
  error?: string;
}

export interface GlobalSupplierLookupResponse {
  success: boolean;
  message: string;
  data?: {
    globalSupplierId: string;
    companyName: string;
    walletAddress: string | null;
    status: string;
  };
  error?: string;
}

export interface SupplierAutocompleteResponse {
  success: boolean;
  message: string;
  data?: {
    items: SupplierAutocompleteItem[];
  };
  error?: string;
}
