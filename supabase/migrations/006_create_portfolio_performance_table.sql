-- Create portfolio_performance table
CREATE TABLE IF NOT EXISTS portfolio_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period DATE NOT NULL,
  value_usd DECIMAL(20, 2) NOT NULL,
  value_xrp DECIMAL(20, 6) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, period)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_portfolio_user_id ON portfolio_performance(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_period ON portfolio_performance(period);
CREATE INDEX IF NOT EXISTS idx_portfolio_user_period ON portfolio_performance(user_id, period);

-- Enable Row Level Security
ALTER TABLE portfolio_performance ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view their own portfolio data
CREATE POLICY "Users can view own portfolio"
  ON portfolio_performance
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Service role can insert/update portfolio data
CREATE POLICY "Service role can manage portfolio"
  ON portfolio_performance
  FOR ALL
  USING (true)
  WITH CHECK (true);




