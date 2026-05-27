-- Separate deposit addresses per testnet vs mainnet (MULTICHAIN_NETWORK env).
ALTER TABLE wallet_deposit_addresses
ADD COLUMN IF NOT EXISTS chain_environment TEXT NOT NULL DEFAULT 'mainnet'
  CHECK (chain_environment IN ('testnet', 'mainnet'));

ALTER TABLE wallet_deposit_addresses
DROP CONSTRAINT IF EXISTS wallet_deposit_addresses_user_id_suite_context_asset_network_key;

ALTER TABLE wallet_deposit_addresses
ADD CONSTRAINT wallet_deposit_addresses_user_asset_network_env_key
  UNIQUE (user_id, suite_context, asset, network, chain_environment);

COMMENT ON COLUMN wallet_deposit_addresses.chain_environment IS 'Matches MULTICHAIN_NETWORK: testnet or mainnet.';
