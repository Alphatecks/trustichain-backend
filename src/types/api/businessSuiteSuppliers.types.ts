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
