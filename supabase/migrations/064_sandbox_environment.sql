-- Sandbox Environment (Developers Tool): keys, locked balance, transactions, errors, test wallets.

-- Sandbox API keys (separate from production api_keys).
CREATE TABLE IF NOT EXISTS sandbox_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_keys_business_id ON sandbox_keys(business_id);

CREATE TRIGGER update_sandbox_keys_updated_at
  BEFORE UPDATE ON sandbox_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Locked balance per business (USD) for sandbox stats card.
CREATE TABLE IF NOT EXISTS sandbox_balances (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  locked_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_sandbox_balances_updated_at
  BEFORE UPDATE ON sandbox_balances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sandbox transactions (for "Sandbox Transactions" count and trend).
CREATE TABLE IF NOT EXISTS sandbox_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount_usd DECIMAL(20, 2),
  transaction_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_transactions_business_id ON sandbox_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_transactions_created_at ON sandbox_transactions(created_at);

-- Sandbox errors (for "Errors (24h)" card).
CREATE TABLE IF NOT EXISTS sandbox_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_errors_business_id ON sandbox_errors(business_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_errors_created_at ON sandbox_errors(created_at);

-- Test wallets (for "Test Wallets" card).
CREATE TABLE IF NOT EXISTS test_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_test_wallets_business_id ON test_wallets(business_id);
CREATE INDEX IF NOT EXISTS idx_test_wallets_created_at ON test_wallets(created_at);

COMMENT ON TABLE sandbox_keys IS 'Sandbox API keys for Developers Tool sandbox environment.';
COMMENT ON TABLE sandbox_balances IS 'Locked USD per business for sandbox stats.';
COMMENT ON TABLE sandbox_transactions IS 'Sandbox transaction log for stats (count this month, trend).';
COMMENT ON TABLE sandbox_errors IS 'Sandbox errors for Errors (24h) card.';
COMMENT ON TABLE test_wallets IS 'Test wallets created in sandbox (count this month).';
