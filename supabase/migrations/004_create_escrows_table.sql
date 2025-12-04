-- Create escrow status enum type
CREATE TYPE escrow_status AS ENUM ('pending', 'active', 'completed', 'cancelled', 'disputed');

-- Create escrows table
CREATE TABLE IF NOT EXISTS escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  counterparty_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount_xrp DECIMAL(20, 6) NOT NULL,
  amount_usd DECIMAL(20, 2) NOT NULL,
  status escrow_status DEFAULT 'pending',
  xrpl_escrow_id TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_escrows_user_id ON escrows(user_id);
CREATE INDEX IF NOT EXISTS idx_escrows_counterparty_id ON escrows(counterparty_id);
CREATE INDEX IF NOT EXISTS idx_escrows_status ON escrows(status);
CREATE INDEX IF NOT EXISTS idx_escrows_created_at ON escrows(created_at);
CREATE INDEX IF NOT EXISTS idx_escrows_xrpl_escrow_id ON escrows(xrpl_escrow_id);

-- Enable Row Level Security
ALTER TABLE escrows ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view their own escrows (as initiator or counterparty)
CREATE POLICY "Users can view own escrows"
  ON escrows
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = counterparty_id);

-- Create policy: Users can create escrows
CREATE POLICY "Users can create escrows"
  ON escrows
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own escrows
CREATE POLICY "Users can update own escrows"
  ON escrows
  FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = counterparty_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_escrows_updated_at
  BEFORE UPDATE ON escrows
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();






