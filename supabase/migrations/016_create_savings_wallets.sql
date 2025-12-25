-- Create savings_wallets table
CREATE TABLE IF NOT EXISTS savings_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount_usd DECIMAL(20, 2),
  color TEXT,
  icon TEXT,
  sort_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_savings_wallets_user_id ON savings_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_wallets_user_id_name ON savings_wallets(user_id, name);

-- Enable Row Level Security
ALTER TABLE savings_wallets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own savings wallets
CREATE POLICY "Users can view own savings wallets"
  ON savings_wallets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own savings wallets
CREATE POLICY "Users can update own savings wallets"
  ON savings_wallets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Allow users to create their own savings wallets
CREATE POLICY "Allow savings wallet creation"
  ON savings_wallets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_savings_wallets_updated_at
  BEFORE UPDATE ON savings_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add optional savings_wallet_id column to transactions table to link activity to a savings wallet
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS savings_wallet_id UUID REFERENCES savings_wallets(id) ON DELETE SET NULL;

-- Index for querying transactions by savings wallet
CREATE INDEX IF NOT EXISTS idx_transactions_savings_wallet_id ON transactions(savings_wallet_id);


