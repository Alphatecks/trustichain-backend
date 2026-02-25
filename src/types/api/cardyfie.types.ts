/**
 * Cardyfie API types (sandbox/production)
 * Docs: https://docs.cardyfie.co/
 */

export type CardyfieCardStatus = 'PROCESSING' | 'ENABLED' | 'FREEZE' | 'CLOSED';
export type CardyfieCardProvider = 'visa' | 'mastercard';
export type CardyfieCardType = 'universal' | 'platinum';

/** Issue card request */
export interface CardyfieIssueCardRequest {
  customer_ulid: string;
  card_name: string;
  card_currency: string;
  card_type: CardyfieCardType;
  card_provider: CardyfieCardProvider;
  reference_id?: string;
  meta?: { user_id?: string };
}

/** Virtual card (issue, deposit, details responses) */
export interface CardyfieCard {
  id: number;
  ulid: string;
  card_name: string;
  card_balance: string | number;
  card_currency_code: string;
  card_type: CardyfieCardType;
  card_provider: CardyfieCardProvider;
  card_exp_time: string;
  masked_pan: string;
  address: string;
  status: CardyfieCardStatus;
  env?: string;
  created_at: string;
  meta?: { user_id?: string };
  reference_id?: string;
  cvv?: string;
  real_pan?: string;
  api_credential_id?: number;
  [key: string]: unknown;
}

/** Create customer request (full KYC body per docs) */
export interface CardyfieCreateCustomerRequest {
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  id_type: 'passport' | 'nid' | 'bvn';
  id_number: string;
  id_front_image: string;
  user_image: string;
  house_number: string;
  address_line_1: string;
  city: string;
  zip_code: string;
  country: string;
  state?: string;
  id_back_image?: string;
  reference_id?: string;
  meta?: { user_id?: string };
}

/** Customer response */
export interface CardyfieCustomer {
  ulid: string;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string;
  id_type: string;
  id_number: string;
  id_front_image: string | null;
  id_back_image: string | null;
  user_image: string;
  house_number: string;
  address_line_1: string;
  city: string;
  state: string | null;
  zip_code: string;
  country: string;
  status: string;
  created_at: string;
  reference_id?: string;
  meta?: { user_id?: string };
  env?: string;
  [key: string]: unknown;
}

/** Deposit/Withdraw request body */
export interface CardyfieAmountRequest {
  amount: number;
}

/** Transaction (from GET /card/transactions) */
export interface CardyfieTransaction {
  ulid: string;
  trx_type: string;
  trx_id: string;
  card_currency: string;
  enter_amount: string;
  created_at: string;
  amount_type: string;
  status: string;
  [key: string]: unknown;
}

/** Currency from GET /card/currencies */
export interface CardyfieCurrency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  country_name: string;
}

export interface CardyfieCurrencyItem {
  id: number;
  provider_id: number;
  currency_id: number;
  status: string;
  created_at: string;
  currency: CardyfieCurrency;
}

/** Paginated cards from GET /card/get-all */
export interface CardyfiePaginatedCards {
  current_page: number;
  data: CardyfieCard[];
  first_page_url: string;
  from: number;
  last_page: number;
  last_page_url: string;
  links: Array<{ url: string | null; label: string; active: boolean }>;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number;
  total: number;
}
