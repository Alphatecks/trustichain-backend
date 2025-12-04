-- Add expected release date field for time-based escrows
-- This field is specifically for time-based release type escrows

ALTER TABLE escrows 
ADD COLUMN IF NOT EXISTS expected_release_date TIMESTAMP WITH TIME ZONE;

-- Add index for expected release date filtering
CREATE INDEX IF NOT EXISTS idx_escrows_expected_release_date ON escrows(expected_release_date);

-- Add comment explaining the purpose of this field
COMMENT ON COLUMN escrows.expected_release_date IS 'Expected release date for time-based escrows. Used when release_type is "Time based"';

