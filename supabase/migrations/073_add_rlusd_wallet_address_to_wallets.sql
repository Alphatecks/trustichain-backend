-- Add dedicated RLUSD wallet address and encrypted secret columns.
-- RLUSD is issued on XRPL, but this supports a separate custodial address per user when needed.
ALTER TABLE wallets
ADD COLUMN IF NOT EXISTS rlusd_xrpl_address TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS encrypted_rlusd_wallet_secret TEXT;

COMMENT ON COLUMN wallets.rlusd_xrpl_address IS 'Dedicated XRPL wallet address used for RLUSD token deposits.';
COMMENT ON COLUMN wallets.encrypted_rlusd_wallet_secret IS 'Encrypted seed for dedicated RLUSD wallet address.';
