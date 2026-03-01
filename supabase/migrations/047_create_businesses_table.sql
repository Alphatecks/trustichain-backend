-- Businesses: separate table for verified business entities (not stored on users).
-- One row per business; owner_user_id links to the user who owns the business.
-- Business KYC submission/approval flows write here; users table stays for personal accounts only.
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Not started' CHECK (status IN ('Not started', 'Pending', 'In review', 'Verified', 'Rejected')),
  company_name TEXT,
  business_description TEXT,
  company_logo_url TEXT,
  default_escrow_fee_rate TEXT,
  auto_release_period TEXT,
  approval_workflow TEXT,
  arbitration_type TEXT,
  transaction_limits TEXT,
  identity_verification_required BOOLEAN DEFAULT false,
  address_verification_required BOOLEAN DEFAULT false,
  enhanced_due_diligence BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_user_id)
);

CREATE INDEX IF NOT EXISTS idx_businesses_owner_user_id ON businesses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_businesses_status ON businesses(status);

CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own business"
  ON businesses FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert own business"
  ON businesses FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update own business"
  ON businesses FOR UPDATE
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Service role can manage businesses"
  ON businesses FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE businesses IS 'Business entities; one per owner. Business KYC is stored here, not on users.';

-- Backfill from existing business_suite_kyc rows
INSERT INTO businesses (
  owner_user_id, status, company_name, business_description, company_logo_url,
  default_escrow_fee_rate, auto_release_period, approval_workflow, arbitration_type, transaction_limits,
  identity_verification_required, address_verification_required, enhanced_due_diligence,
  submitted_at, reviewed_at, reviewed_by, created_at, updated_at
)
SELECT
  user_id, status, company_name, business_description, company_logo_url,
  default_escrow_fee_rate, auto_release_period, approval_workflow, arbitration_type, transaction_limits,
  COALESCE(identity_verification_required, false), COALESCE(address_verification_required, false), COALESCE(enhanced_due_diligence, false),
  submitted_at, reviewed_at, reviewed_by, created_at, updated_at
FROM business_suite_kyc
ON CONFLICT (owner_user_id) DO NOTHING;
