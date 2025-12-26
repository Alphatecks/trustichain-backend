-- Create dispute category enum
CREATE TYPE dispute_category AS ENUM ('freelancing', 'real_estate', 'product_purchase', 'custom');

-- Create dispute reason type enum
CREATE TYPE dispute_reason_type AS ENUM ('quality_issue', 'delivery_delay', 'payment_dispute');

-- Add new columns to disputes table
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS dispute_category dispute_category,
  ADD COLUMN IF NOT EXISTS dispute_reason_type dispute_reason_type,
  ADD COLUMN IF NOT EXISTS payer_name TEXT,
  ADD COLUMN IF NOT EXISTS payer_email TEXT,
  ADD COLUMN IF NOT EXISTS payer_phone TEXT,
  ADD COLUMN IF NOT EXISTS respondent_name TEXT,
  ADD COLUMN IF NOT EXISTS respondent_email TEXT,
  ADD COLUMN IF NOT EXISTS respondent_phone TEXT,
  ADD COLUMN IF NOT EXISTS resolution_period TEXT,
  ADD COLUMN IF NOT EXISTS expected_resolution_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payer_xrp_wallet_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS respondent_xrp_wallet_address TEXT DEFAULT '';

-- Update existing rows to have default wallet addresses if they're empty
-- This is a safety measure, but ideally all disputes should have wallet addresses
UPDATE disputes
SET payer_xrp_wallet_address = COALESCE(payer_xrp_wallet_address, ''),
    respondent_xrp_wallet_address = COALESCE(respondent_xrp_wallet_address, '')
WHERE payer_xrp_wallet_address IS NULL OR respondent_xrp_wallet_address IS NULL;

-- Make wallet addresses NOT NULL after setting defaults
-- First remove the default, then set NOT NULL
ALTER TABLE disputes
  ALTER COLUMN payer_xrp_wallet_address DROP DEFAULT,
  ALTER COLUMN respondent_xrp_wallet_address DROP DEFAULT;

ALTER TABLE disputes
  ALTER COLUMN payer_xrp_wallet_address SET NOT NULL,
  ALTER COLUMN respondent_xrp_wallet_address SET NOT NULL;

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_disputes_category ON disputes(dispute_category);
CREATE INDEX IF NOT EXISTS idx_disputes_reason_type ON disputes(dispute_reason_type);
CREATE INDEX IF NOT EXISTS idx_disputes_payer_wallet ON disputes(payer_xrp_wallet_address);
CREATE INDEX IF NOT EXISTS idx_disputes_respondent_wallet ON disputes(respondent_xrp_wallet_address);

