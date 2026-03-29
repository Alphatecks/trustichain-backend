-- Add optional savings plan duration (in months)
ALTER TABLE savings_wallets
  ADD COLUMN IF NOT EXISTS duration_months INTEGER;

-- Enforce positive values when provided
ALTER TABLE savings_wallets
  DROP CONSTRAINT IF EXISTS savings_wallets_duration_months_positive;

ALTER TABLE savings_wallets
  ADD CONSTRAINT savings_wallets_duration_months_positive
  CHECK (duration_months IS NULL OR duration_months > 0);
