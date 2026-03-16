-- File payroll dispute: one row per dispute filed against a payroll (business suite).
CREATE TABLE IF NOT EXISTS payroll_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payroll_id UUID NOT NULL REFERENCES business_payrolls(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  amount DECIMAL(20, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  description TEXT NOT NULL,
  evidence_urls TEXT[] DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_disputes_user_id ON payroll_disputes(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_disputes_payroll_id ON payroll_disputes(payroll_id);
CREATE INDEX IF NOT EXISTS idx_payroll_disputes_status ON payroll_disputes(status);

CREATE TRIGGER update_payroll_disputes_updated_at
  BEFORE UPDATE ON payroll_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payroll_disputes ENABLE ROW LEVEL SECURITY;

-- Filer must own the payroll (via business)
CREATE POLICY "Users can manage payroll disputes for own payrolls"
  ON payroll_disputes FOR ALL
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

COMMENT ON TABLE payroll_disputes IS 'Disputes filed by business suite users against a specific payroll (Payroll ID, reason, amount, description, optional evidence).';
