-- Add USDT and USDC balance columns to wallets table
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS balance_usdt DECIMAL(20, 6) DEFAULT 0.000000,
ADD COLUMN IF NOT EXISTS balance_usdc DECIMAL(20, 6) DEFAULT 0.000000;

-- Add comments for clarity
COMMENT ON COLUMN wallets.balance_usdt IS 'USDT balance (XRPL token)';
COMMENT ON COLUMN wallets.balance_usdc IS 'USDC balance (XRPL token)';
