-- Replace duration-based savings plans with target date
ALTER TABLE savings_wallets
  ADD COLUMN IF NOT EXISTS target_date DATE;

-- Backfill target date from existing duration where possible (from wallet creation month)
UPDATE savings_wallets
SET target_date = (
  date_trunc('month', COALESCE(created_at, now()))
  + (duration_months::text || ' months')::interval
)::date
WHERE target_date IS NULL
  AND duration_months IS NOT NULL;

-- Remove duration constraints/column after migration to target date
ALTER TABLE savings_wallets
  DROP CONSTRAINT IF EXISTS savings_wallets_duration_months_positive;

ALTER TABLE savings_wallets
  DROP COLUMN IF EXISTS duration_months;
