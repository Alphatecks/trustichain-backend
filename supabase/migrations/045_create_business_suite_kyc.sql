-- Business Suite KYC: separate table for business/enterprise account verification
-- One row per business suite user (user_id with account_type business_suite or enterprise)
CREATE TABLE IF NOT EXISTS business_suite_kyc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Not started' CHECK (status IN ('Not started', 'Pending', 'In review', 'Verified', 'Rejected')),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Optional detail (mirror user_kyc for documents/ID)
  linked_id_type TEXT,
  card_number TEXT,
  wallet_address TEXT,
  document_live_selfie_url TEXT,
  document_front_url TEXT,
  document_back_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_business_suite_kyc_user_id ON business_suite_kyc(user_id);
CREATE INDEX IF NOT EXISTS idx_business_suite_kyc_status ON business_suite_kyc(status);

CREATE TRIGGER update_business_suite_kyc_updated_at
  BEFORE UPDATE ON business_suite_kyc
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE business_suite_kyc ENABLE ROW LEVEL SECURITY;

-- Business suite user can read/update own KYC (submit documents, see status)
CREATE POLICY "Business suite users can view own kyc"
  ON business_suite_kyc FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Business suite users can insert own kyc"
  ON business_suite_kyc FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Business suite users can update own kyc"
  ON business_suite_kyc FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (admin review)
CREATE POLICY "Service role can manage business_suite_kyc"
  ON business_suite_kyc FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE business_suite_kyc IS 'KYC verification for business suite / enterprise accounts; separate from user_kyc (personal).';
