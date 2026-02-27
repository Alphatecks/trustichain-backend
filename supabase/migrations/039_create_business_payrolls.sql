-- Business Suite: Payrolls (batches with release date, freeze auto-release, and items)
CREATE TABLE IF NOT EXISTS business_payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  release_date DATE,
  freeze_auto_release BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'released', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_payrolls_user_id ON business_payrolls(user_id);
CREATE INDEX IF NOT EXISTS idx_business_payrolls_status ON business_payrolls(status);
CREATE INDEX IF NOT EXISTS idx_business_payrolls_release_date ON business_payrolls(release_date);

CREATE TABLE IF NOT EXISTS business_payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES business_payrolls(id) ON DELETE CASCADE,
  counterparty_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_usd DECIMAL(20, 2) NOT NULL,
  amount_xrp DECIMAL(20, 6),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'failed')),
  due_date DATE,
  escrow_id UUID REFERENCES escrows(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(payroll_id, counterparty_id)
);

CREATE INDEX IF NOT EXISTS idx_business_payroll_items_payroll_id ON business_payroll_items(payroll_id);
CREATE INDEX IF NOT EXISTS idx_business_payroll_items_escrow_id ON business_payroll_items(escrow_id);

CREATE TRIGGER update_business_payrolls_updated_at
  BEFORE UPDATE ON business_payrolls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE business_payrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_payroll_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business payroll owners can manage own payrolls"
  ON business_payrolls FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Business payroll owners can manage payroll items"
  ON business_payroll_items FOR ALL
  USING (
    EXISTS (SELECT 1 FROM business_payrolls bp WHERE bp.id = payroll_id AND bp.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM business_payrolls bp WHERE bp.id = payroll_id AND bp.user_id = auth.uid())
  );
