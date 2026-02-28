-- Profiles for business team members (personal, job, payment details from Add team member modal)
CREATE TABLE IF NOT EXISTS business_team_member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES business_team_members(id) ON DELETE CASCADE,
  -- Personal (Step 1)
  phone_number TEXT,
  country TEXT,
  address TEXT,
  gender TEXT,
  -- Job (Step 2)
  job_title TEXT,
  employment_type TEXT,
  status TEXT,
  date_joined DATE,
  currency TEXT,
  default_salary_type TEXT,
  salary_amount DECIMAL(20, 2),
  disbursement_mode TEXT,
  -- Payment (Step 3)
  account_type TEXT,
  wallet_type TEXT,
  wallet_address TEXT,
  network TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_member_id)
);

CREATE INDEX IF NOT EXISTS idx_business_team_member_profiles_team_member_id ON business_team_member_profiles(team_member_id);

CREATE TRIGGER update_business_team_member_profiles_updated_at
  BEFORE UPDATE ON business_team_member_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE business_team_member_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business team owners can manage member profiles"
  ON business_team_member_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM business_team_members m
      JOIN business_teams t ON t.id = m.team_id
      WHERE m.id = team_member_id AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_team_members m
      JOIN business_teams t ON t.id = m.team_id
      WHERE m.id = team_member_id AND t.user_id = auth.uid()
    )
  );
