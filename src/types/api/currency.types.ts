/**
 * Supported fiat display currencies for user preferences and FX rates.
 * RLUSD is the product currency (≈ 1 USD); other codes are fiat for display conversion.
 */

export const SUPPORTED_DISPLAY_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'CHF',
  'CNY',
  'HKD',
  'SGD',
  'INR',
  'NGN',
  'ZAR',
  'BRL',
  'MXN',
  'AED',
  'SAR',
  'TRY',
  'KRW',
  'RLUSD',
] as const;

export type DisplayCurrency = (typeof SUPPORTED_DISPLAY_CURRENCIES)[number];

/** Fiat codes returned by GET /api/exchange/rates (excludes RLUSD base). */
export const FIAT_EXCHANGE_CURRENCIES = SUPPORTED_DISPLAY_CURRENCIES.filter(
  (c) => c !== 'RLUSD' && c !== 'USD'
);

/**
 * Rate direction for GET /api/exchange/rates:
 * each rate is units of `currency` per 1 USD (same as 1 RLUSD).
 * Example: EUR 0.92 → 1 USD ≈ 0.92 EUR; NGN 1580 → 1 USD ≈ 1580 NGN.
 */
export type ExchangeQuoteDirection = 'unitsPerUsd';

export const EXCHANGE_QUOTE_DIRECTION: ExchangeQuoteDirection = 'unitsPerUsd';
