-- Per-user deposit addresses for USDT / USDC on EVM, Tron, and Solana networks.
CREATE TABLE IF NOT EXISTS wallet_deposit_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  suite_context TEXT NOT NULL DEFAULT 'personal' CHECK (suite_context IN ('personal', 'business')),
  asset TEXT NOT NULL CHECK (asset IN ('USDT', 'USDC')),
  network TEXT NOT NULL CHECK (network IN ('ERC20', 'TRC20', 'BEP20', 'SOLANA')),
  address TEXT NOT NULL,
  chain_type TEXT NOT NULL CHECK (chain_type IN ('evm', 'tron', 'solana')),
  encrypted_secret TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, suite_context, asset, network)
);

CREATE INDEX IF NOT EXISTS idx_wallet_deposit_addresses_user_suite
  ON wallet_deposit_addresses (user_id, suite_context);

CREATE INDEX IF NOT EXISTS idx_wallet_deposit_addresses_wallet_id
  ON wallet_deposit_addresses (wallet_id);

COMMENT ON TABLE wallet_deposit_addresses IS 'Custodial deposit addresses: USDT on ERC20/TRC20/BEP20; USDC on BEP20/Solana.';
COMMENT ON COLUMN wallet_deposit_addresses.encrypted_secret IS 'Encrypted private key / seed for custodial sweeps (optional until treasury automation).';
