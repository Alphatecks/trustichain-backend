-- Frontend-notified multichain deposits (WalletConnect / Reown) for status polling
-- and faster credit than cron-only scanning.

CREATE TABLE IF NOT EXISTS multichain_deposit_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  suite_context TEXT NOT NULL DEFAULT 'personal'
    CHECK (suite_context IN ('personal', 'business')),
  asset TEXT NOT NULL CHECK (asset IN ('USDT', 'USDC')),
  network TEXT NOT NULL CHECK (network IN ('ERC20', 'TRC20', 'BEP20', 'SOLANA')),
  chain_environment TEXT NOT NULL CHECK (chain_environment IN ('testnet', 'mainnet')),
  tx_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'credited', 'failed')),
  amount DECIMAL(20, 6),
  error_message TEXT,
  credit_id UUID REFERENCES multichain_deposit_credits(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, chain_environment, network, tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_multichain_deposit_notifications_user
  ON multichain_deposit_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_multichain_deposit_notifications_tx
  ON multichain_deposit_notifications (tx_hash);
