-- Create dispute status enum
CREATE TYPE dispute_status AS ENUM ('pending', 'active', 'resolved', 'cancelled');

-- Create disputes table
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL,
  escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE,
  initiator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  respondent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_xrp DECIMAL(20, 6) NOT NULL,
  amount_usd DECIMAL(20, 2) NOT NULL,
  status dispute_status NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL,
  description TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique index on case_id for human-readable IDs
CREATE UNIQUE INDEX IF NOT EXISTS idx_disputes_case_id ON disputes(case_id);

-- Useful indexes for queries
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_opened_at ON disputes(opened_at);
CREATE INDEX IF NOT EXISTS idx_disputes_escrow_id ON disputes(escrow_id);
CREATE INDEX IF NOT EXISTS idx_disputes_initiator_user_id ON disputes(initiator_user_id);
CREATE INDEX IF NOT EXISTS idx_disputes_respondent_user_id ON disputes(respondent_user_id);

-- Enable Row Level Security
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view disputes where they are a party (initiator or respondent)
CREATE POLICY "Users can view own disputes"
  ON disputes
  FOR SELECT
  USING (auth.uid() = initiator_user_id OR auth.uid() = respondent_user_id);

-- Policy: Service role can manage disputes
CREATE POLICY "Service role can manage disputes"
  ON disputes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


