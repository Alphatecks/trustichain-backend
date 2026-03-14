/**
 * Business Suite Suppliers API Types
 */

/** Single card in Supplier details UI: id, display id, progress donut, status/due date, amount */
export interface SupplierDetailItem {
  id: string;
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
