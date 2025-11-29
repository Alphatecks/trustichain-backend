-- Create transaction type enum
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'escrow_create', 'escrow_release', 'escrow_cancel', 'transfer');

-- Create transaction status enum
CREATE TYPE transaction_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount_xrp DECIMAL(20, 6) NOT NULL,
  amount_usd DECIMAL(20, 2) NOT NULL,
  xrpl_tx_hash TEXT,
  status transaction_status DEFAULT 'pending',
  escrow_id UUID REFERENCES escrows(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_xrpl_tx_hash ON transactions(xrpl_tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_escrow_id ON transactions(escrow_id);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Service role can insert/update transactions
CREATE POLICY "Service role can manage transactions"
  ON transactions
  FOR ALL
  USING (true)
  WITH CHECK (true);


