-- Add encrypted wallet secret column to wallets table
-- This stores the XRPL wallet secret (seed) encrypted for automated withdrawals
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS encrypted_wallet_secret TEXT;

-- Add comment for clarity
COMMENT ON COLUMN wallets.encrypted_wallet_secret IS 'Encrypted XRPL wallet secret (seed) for automated withdrawals. Stored using AES-256-GCM encryption.';

-- Note: This column should be excluded from RLS policies that allow SELECT
-- Only backend service should access this column




