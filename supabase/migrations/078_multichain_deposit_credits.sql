-- Track credited multichain stablecoin deposits (idempotent).
CREATE TABLE IF NOT EXISTS multichain_deposit_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  suite_context TEXT NOT NULL DEFAULT 'personal' CHECK (suite_context IN ('personal', 'business')),
  asset TEXT NOT NULL CHECK (asset IN ('USDT', 'USDC')),
  network TEXT NOT NULL CHECK (network IN ('ERC20', 'TRC20', 'BEP20', 'SOLANA')),
  chain_environment TEXT NOT NULL CHECK (chain_environment IN ('testnet', 'mainnet')),
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL DEFAULT 0,
  amount DECIMAL(20, 6) NOT NULL,
  from_address TEXT,
  to_address TEXT NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_environment, network, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_multichain_deposit_credits_user
  ON multichain_deposit_credits (user_id, created_at DESC);

-- Per deposit-address scan cursor (EVM block number, etc.)
CREATE TABLE IF NOT EXISTS multichain_deposit_scan_cursors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_address_id UUID NOT NULL REFERENCES wallet_deposit_addresses(id) ON DELETE CASCADE,
  cursor_key TEXT NOT NULL DEFAULT 'default',
  cursor_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (deposit_address_id, cursor_key)
);
