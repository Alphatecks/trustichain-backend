-- Business suite has a separate XRP wallet (and balance) from personal suite.
-- One row per (user_id, suite_context); xrpl_address remains unique per row.
ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS suite_context TEXT DEFAULT 'personal';

UPDATE wallets SET suite_context = 'personal' WHERE suite_context IS NULL;
ALTER TABLE wallets ALTER COLUMN suite_context SET NOT NULL;
ALTER TABLE wallets ALTER COLUMN suite_context SET DEFAULT 'personal';

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_user_id_suite_context
  ON wallets(user_id, suite_context);

COMMENT ON COLUMN wallets.suite_context IS 'personal (default) or business; business suite uses a separate wallet/address';
