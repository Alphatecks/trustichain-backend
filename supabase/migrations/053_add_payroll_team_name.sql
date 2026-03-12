-- Payroll Step 1 UI: store team name so payroll is associated with a team (members loaded by team name in Step 2)
ALTER TABLE business_payrolls
  ADD COLUMN IF NOT EXISTS team_name TEXT;

COMMENT ON COLUMN business_payrolls.team_name IS 'Team name from Add Payroll Step 1; used to load members in Step 2';
