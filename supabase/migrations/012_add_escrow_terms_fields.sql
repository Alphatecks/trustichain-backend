-- Add escrow terms and release fields (Step 2/3)
-- This migration adds release type, expected completion date, dispute resolution period, and release conditions

-- Add release type column
ALTER TABLE escrows 
ADD COLUMN IF NOT EXISTS release_type VARCHAR(50);

-- Add expected completion date column
ALTER TABLE escrows 
ADD COLUMN IF NOT EXISTS expected_completion_date TIMESTAMP WITH TIME ZONE;

-- Add dispute resolution period column
ALTER TABLE escrows 
ADD COLUMN IF NOT EXISTS dispute_resolution_period VARCHAR(50);

-- Add release conditions column (text area for detailed conditions)
ALTER TABLE escrows 
ADD COLUMN IF NOT EXISTS release_conditions TEXT;

-- Add index for release type filtering
CREATE INDEX IF NOT EXISTS idx_escrows_release_type ON escrows(release_type);

-- Add index for expected completion date filtering
CREATE INDEX IF NOT EXISTS idx_escrows_expected_completion_date ON escrows(expected_completion_date);

-- Add comments explaining the purpose of these fields
COMMENT ON COLUMN escrows.release_type IS 'Release mechanism type: Manual Release, Time based, or Milestones';
COMMENT ON COLUMN escrows.expected_completion_date IS 'Expected date when the escrow should be completed';
COMMENT ON COLUMN escrows.dispute_resolution_period IS 'Period for dispute resolution (e.g., "7 days", "14 days")';
COMMENT ON COLUMN escrows.release_conditions IS 'Detailed conditions for releasing the escrow funds';

