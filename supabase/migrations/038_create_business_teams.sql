-- Business Suite: My Teams (e.g. payroll teams with members and next date)
CREATE TABLE IF NOT EXISTS business_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  next_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_teams_user_id ON business_teams(user_id);

CREATE TABLE IF NOT EXISTS business_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES business_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_business_team_members_team_id ON business_team_members(team_id);

CREATE TRIGGER update_business_teams_updated_at
  BEFORE UPDATE ON business_teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE business_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_team_members ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own teams
CREATE POLICY "Business team owners can manage own teams"
  ON business_teams FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Owners can manage members of their teams (via team ownership)
CREATE POLICY "Business team owners can manage members"
  ON business_team_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM business_teams bt WHERE bt.id = team_id AND bt.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM business_teams bt WHERE bt.id = team_id AND bt.user_id = auth.uid())
  );
