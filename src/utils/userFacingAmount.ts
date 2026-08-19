/**
 * User-facing amounts are denominated in RLUSD (Ripple USD stablecoin).
 * RLUSD is pegged 1:1 to USD for display and portfolio value.
 */

export type UserFacingCurrency = 'RLUSD';

export interface UserFacingAmount {
  rlusd: number;
  usd: number;
  currency: UserFacingCurrency;
  /** Legacy XRPL settlement amount; omitted from user-facing totals */
  xrp?: number;
}

export function toUserFacingAmount(usd: number, xrp?: number): UserFacingAmount {
  const roundedUsd = parseFloat(Number(usd).toFixed(2));
  const result: UserFacingAmount = {
    rlusd: roundedUsd,
    usd: roundedUsd,
    currency: 'RLUSD',
  };
  if (xrp != null && Number.isFinite(Number(xrp))) {
    result.xrp = parseFloat(Number(xrp).toFixed(6));
  }
  return result;
}
