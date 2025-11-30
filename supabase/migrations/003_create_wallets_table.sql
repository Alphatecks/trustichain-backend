-- Create wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  xrpl_address TEXT NOT NULL UNIQUE,
  balance_xrp DECIMAL(20, 6) DEFAULT 0.000000,
  balance_usd DECIMAL(20, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_xrpl_address ON wallets(xrpl_address);

-- Enable Row Level Security
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view their own wallet
CREATE POLICY "Users can view own wallet"
  ON wallets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Users can update their own wallet
CREATE POLICY "Users can update own wallet"
  ON wallets
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy: Allow inserts during wallet creation
CREATE POLICY "Allow wallet creation"
  ON wallets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();




