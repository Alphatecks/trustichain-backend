-- Add supplier modal fields: wallet address, country, KYC status, contract type, tags
ALTER TABLE business_suppliers
  ADD COLUMN IF NOT EXISTS wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS kyc_status TEXT,
  ADD COLUMN IF NOT EXISTS contract_type TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Allow due_date and amount_usd to be null for Add supplier flow (no amount/due)
ALTER TABLE business_suppliers ALTER COLUMN due_date DROP NOT NULL;
ALTER TABLE business_suppliers ALTER COLUMN amount_usd DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_suppliers_wallet_address ON business_suppliers(wallet_address) WHERE wallet_address IS NOT NULL;
