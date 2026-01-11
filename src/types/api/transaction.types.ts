/**
 * Unified TransactionType for all modules
 */

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'escrow_create'
  | 'escrow_release'
  | 'escrow_cancel'
  | 'transfer'
  | 'swap'
  | 'freelance'
  | 'product_purchase'
  | 'real_estate'
  | 'custom';
