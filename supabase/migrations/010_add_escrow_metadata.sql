-- Add new metadata fields to escrows table
-- This migration adds transaction_type, industry, progress, and escrow_sequence fields

-- Add transaction_type column (NOT NULL, but we'll set default for existing rows first)
ALTER TABLE escrows 
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);

-- Set default value for existing rows
UPDATE escrows 
SET transaction_type = 'custom' 
WHERE transaction_type IS NULL;

-- Now make it NOT NULL
ALTER TABLE escrows 
ALTER COLUMN transaction_type SET NOT NULL,
ALTER COLUMN transaction_type SET DEFAULT 'custom';

-- Add industry column (flexible string, contextual to transaction_type)
ALTER TABLE escrows 
ADD COLUMN IF NOT EXISTS industry VARCHAR(100);

-- Add comment explaining industry relationship to transaction_type
COMMENT ON COLUMN escrows.industry IS 'Industry field should be relevant to the transaction_type selected. Examples: Freelance (Technology, Design, Writing, Marketing), Product purchase (Electronics, Fashion, Home & Garden), Real estate (Residential, Commercial, Land), Custom (any industry)';

-- Add progress column (percentage 0-100, default 0)
ALTER TABLE escrows 
ADD COLUMN IF NOT EXISTS progress DECIMAL(5, 2) DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);

-- Add escrow_sequence column for formatted ID generation
ALTER TABLE escrows 
ADD COLUMN IF NOT EXISTS escrow_sequence INTEGER;

-- Create sequence number for existing escrows and new ones
-- First, set sequence numbers based on creation order within each year
WITH numbered_escrows AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM created_at) 
      ORDER BY created_at ASC
    ) as seq
  FROM escrows
  WHERE escrow_sequence IS NULL
)
UPDATE escrows e
SET escrow_sequence = n.seq
FROM numbered_escrows n
WHERE e.id = n.id;

-- Create a sequence for generating new escrow sequence numbers
-- We'll use this in application code to generate sequential IDs per year
CREATE SEQUENCE IF NOT EXISTS escrow_sequence_counter;

-- Create indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_escrows_transaction_type ON escrows(transaction_type);
CREATE INDEX IF NOT EXISTS idx_escrows_industry ON escrows(industry);
CREATE INDEX IF NOT EXISTS idx_escrows_progress ON escrows(progress);

-- Create a composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_escrows_type_industry_status ON escrows(transaction_type, industry, status);

-- Function to generate formatted escrow ID: #ESC-YYYY-XXX
-- This will be used in application code, but we can reference it here for documentation
-- Format: #ESC-YYYY-XXX where YYYY is year and XXX is 3-digit sequence number

-- Note: The actual formatting will be done in application code (TypeScript)
-- This is just a helper function that can be used if needed in SQL queries
CREATE OR REPLACE FUNCTION format_escrow_id(escrow_year INTEGER, escrow_seq INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN '#' || 'ESC-' || escrow_year::TEXT || '-' || LPAD(escrow_seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add cancel_reason column for storing cancellation reason
ALTER TABLE escrows 
ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
