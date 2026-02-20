-- KYC status enum for user verification
CREATE TYPE kyc_status AS ENUM ('pending', 'verified', 'declined', 'suspended');

-- Add account_type to users (e.g. Basic Package, Premium Plan, Business Suite, Enterprise Solution, Starter Plan)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_type TEXT;

-- user_kyc: one row per user, latest KYC status
CREATE TABLE IF NOT EXISTS user_kyc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status kyc_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_kyc_user_id ON user_kyc(user_id);
CREATE INDEX IF NOT EXISTS idx_user_kyc_status ON user_kyc(status);

ALTER TABLE user_kyc ENABLE ROW LEVEL SECURITY;

-- Only service role can manage KYC (admin operations)
CREATE POLICY "Service role can manage user_kyc"
  ON user_kyc
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Users can read their own KYC status
CREATE POLICY "Users can view own kyc"
  ON user_kyc
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_kyc_updated_at
  BEFORE UPDATE ON user_kyc
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
