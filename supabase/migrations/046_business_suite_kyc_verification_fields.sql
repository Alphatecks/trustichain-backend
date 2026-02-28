-- Business suite KYC verification payload from front end
ALTER TABLE business_suite_kyc
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS business_description TEXT,
  ADD COLUMN IF NOT EXISTS company_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS default_escrow_fee_rate TEXT,
  ADD COLUMN IF NOT EXISTS auto_release_period TEXT,
  ADD COLUMN IF NOT EXISTS approval_workflow TEXT,
  ADD COLUMN IF NOT EXISTS arbitration_type TEXT,
  ADD COLUMN IF NOT EXISTS transaction_limits TEXT,
  ADD COLUMN IF NOT EXISTS identity_verification_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS address_verification_required BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS enhanced_due_diligence BOOLEAN DEFAULT false;

COMMENT ON COLUMN business_suite_kyc.approval_workflow IS 'single | dual | multi';
COMMENT ON COLUMN business_suite_kyc.arbitration_type IS 'binding | non-binding | mediation';
