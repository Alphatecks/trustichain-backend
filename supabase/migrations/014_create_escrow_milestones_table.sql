-- Create escrow milestones table
-- This table stores individual milestones for milestone-based escrows

CREATE TABLE IF NOT EXISTS escrow_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES escrows(id) ON DELETE CASCADE,
  milestone_order INTEGER NOT NULL, -- Order/sequence of the milestone (1, 2, 3, etc.)
  milestone_details TEXT NOT NULL, -- Description/details of the milestone
  milestone_amount DECIMAL(20, 6) NOT NULL, -- Amount for this milestone in XRP
  milestone_amount_usd DECIMAL(20, 2) NOT NULL, -- Amount for this milestone in USD
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, released
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_escrow_id ON escrow_milestones(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_status ON escrow_milestones(status);
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_order ON escrow_milestones(escrow_id, milestone_order);

-- Enable Row Level Security
ALTER TABLE escrow_milestones ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view milestones for their escrows
CREATE POLICY "Users can view own escrow milestones"
  ON escrow_milestones
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM escrows 
      WHERE escrows.id = escrow_milestones.escrow_id 
      AND (escrows.user_id = auth.uid() OR escrows.counterparty_id = auth.uid())
    )
  );

-- Create policy: Service role can manage milestones
CREATE POLICY "Service role can manage milestones"
  ON escrow_milestones
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_escrow_milestones_updated_at
  BEFORE UPDATE ON escrow_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE escrow_milestones IS 'Stores individual milestones for milestone-based escrows';
COMMENT ON COLUMN escrow_milestones.milestone_order IS 'Order/sequence number of the milestone (1, 2, 3, etc.)';
COMMENT ON COLUMN escrow_milestones.milestone_details IS 'Description or details of what needs to be completed for this milestone';
COMMENT ON COLUMN escrow_milestones.milestone_amount IS 'Amount to be released for this milestone in XRP';
COMMENT ON COLUMN escrow_milestones.milestone_amount_usd IS 'Amount to be released for this milestone in USD';
