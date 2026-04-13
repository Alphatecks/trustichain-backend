-- Add RLUSD balance column to wallets table
ALTER TABLE wallets
ADD COLUMN IF NOT EXISTS balance_rlusd DECIMAL(20, 6) DEFAULT 0.000000;

COMMENT ON COLUMN wallets.balance_rlusd IS 'RLUSD balance (Ripple USD token on XRPL)';
