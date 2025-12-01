-- Add contact information fields to escrows table
-- This migration adds email, name, and phone fields for both payer and counterparty

-- Add payer contact information columns
ALTER TABLE escrows 
ADD COLUMN IF NOT EXISTS payer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS payer_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS payer_phone VARCHAR(50);

-- Add counterparty contact information columns
ALTER TABLE escrows 
ADD COLUMN IF NOT EXISTS counterparty_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS counterparty_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS counterparty_phone VARCHAR(50);

-- Add indexes for email lookups (optional, useful for filtering/searching)
CREATE INDEX IF NOT EXISTS idx_escrows_payer_email ON escrows(payer_email);
CREATE INDEX IF NOT EXISTS idx_escrows_counterparty_email ON escrows(counterparty_email);

-- Add comments explaining the purpose of these fields
COMMENT ON COLUMN escrows.payer_email IS 'Optional email of the payer (escrow initiator)';
COMMENT ON COLUMN escrows.payer_name IS 'Optional name of the payer (escrow initiator)';
COMMENT ON COLUMN escrows.payer_phone IS 'Optional phone number of the payer (escrow initiator)';
COMMENT ON COLUMN escrows.counterparty_email IS 'Optional email of the counterparty';
COMMENT ON COLUMN escrows.counterparty_name IS 'Optional name of the counterparty';
COMMENT ON COLUMN escrows.counterparty_phone IS 'Optional phone number of the counterparty';
