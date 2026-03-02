-- Tie payrolls, teams, and suppliers to the registered business (businesses.id) instead of user_id only.
-- Ensures a businesses row exists for every user who has payrolls/teams/suppliers, then adds business_id and RLS.

-- 1) Ensure businesses row exists for every user_id that appears in payrolls, teams, or suppliers
INSERT INTO businesses (owner_user_id, status, created_at, updated_at)
SELECT DISTINCT u.id, 'Not started', NOW(), NOW()
FROM (
  SELECT user_id AS id FROM business_payrolls
  UNION
  SELECT user_id FROM business_teams
  UNION
  SELECT user_id FROM business_suppliers
) u
WHERE NOT EXISTS (SELECT 1 FROM businesses b WHERE b.owner_user_id = u.id)
ON CONFLICT (owner_user_id) DO NOTHING;

-- 2) Add business_id to business_payrolls
ALTER TABLE business_payrolls
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

UPDATE business_payrolls bp
SET business_id = (SELECT id FROM businesses WHERE owner_user_id = bp.user_id LIMIT 1)
WHERE bp.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_payrolls_business_id ON business_payrolls(business_id);

ALTER TABLE business_payrolls ALTER COLUMN business_id SET NOT NULL;

-- RLS: access via business ownership
DROP POLICY IF EXISTS "Business payroll owners can manage own payrolls" ON business_payrolls;
CREATE POLICY "Business payroll owners can manage own payrolls"
  ON business_payrolls FOR ALL
  USING ((SELECT owner_user_id FROM businesses WHERE id = business_id) = auth.uid())
  WITH CHECK ((SELECT owner_user_id FROM businesses WHERE id = business_id) = auth.uid());

DROP POLICY IF EXISTS "Business payroll owners can manage payroll items" ON business_payroll_items;
CREATE POLICY "Business payroll owners can manage payroll items"
  ON business_payroll_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM business_payrolls bp
      JOIN businesses b ON b.id = bp.business_id
      WHERE bp.id = payroll_id AND b.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_payrolls bp
      JOIN businesses b ON b.id = bp.business_id
      WHERE bp.id = payroll_id AND b.owner_user_id = auth.uid()
    )
  );

-- 3) Add business_id to business_teams
ALTER TABLE business_teams
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

UPDATE business_teams bt
SET business_id = (SELECT id FROM businesses WHERE owner_user_id = bt.user_id LIMIT 1)
WHERE bt.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_teams_business_id ON business_teams(business_id);

ALTER TABLE business_teams ALTER COLUMN business_id SET NOT NULL;

DROP POLICY IF EXISTS "Business team owners can manage own teams" ON business_teams;
CREATE POLICY "Business team owners can manage own teams"
  ON business_teams FOR ALL
  USING ((SELECT owner_user_id FROM businesses WHERE id = business_id) = auth.uid())
  WITH CHECK ((SELECT owner_user_id FROM businesses WHERE id = business_id) = auth.uid());

DROP POLICY IF EXISTS "Business team owners can manage members" ON business_team_members;
CREATE POLICY "Business team owners can manage members"
  ON business_team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM business_teams bt
      JOIN businesses b ON b.id = bt.business_id
      WHERE bt.id = team_id AND b.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_teams bt
      JOIN businesses b ON b.id = bt.business_id
      WHERE bt.id = team_id AND b.owner_user_id = auth.uid()
    )
  );

-- 4) Add business_id to business_suppliers
ALTER TABLE business_suppliers
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;

UPDATE business_suppliers bs
SET business_id = (SELECT id FROM businesses WHERE owner_user_id = bs.user_id LIMIT 1)
WHERE bs.business_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_business_suppliers_business_id ON business_suppliers(business_id);

ALTER TABLE business_suppliers ALTER COLUMN business_id SET NOT NULL;

DROP POLICY IF EXISTS "Business users can manage own suppliers" ON business_suppliers;
CREATE POLICY "Business users can manage own suppliers"
  ON business_suppliers FOR ALL
  USING ((SELECT owner_user_id FROM businesses WHERE id = business_id) = auth.uid())
  WITH CHECK ((SELECT owner_user_id FROM businesses WHERE id = business_id) = auth.uid());

COMMENT ON COLUMN business_payrolls.business_id IS 'Registered business (businesses.id); payroll is scoped to this business.';
COMMENT ON COLUMN business_teams.business_id IS 'Registered business (businesses.id); team is scoped to this business.';
COMMENT ON COLUMN business_suppliers.business_id IS 'Registered business (businesses.id); supplier is scoped to this business.';
