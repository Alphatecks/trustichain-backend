-- Supplier transaction history: payments to/from suppliers (not payroll).
-- API GET /api/business-suite/suppliers/transactions reads only from this table.
CREATE TABLE IF NOT EXISTS business_supplier_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES business_suppliers(id) ON DELETE CASCADE,
  amount_xrp DECIMAL(20, 6),
  amount_usd DECIMAL(20, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Successful',
  type TEXT NOT NULL DEFAULT 'Received' CHECK (type IN ('Received', 'Sent')),
  escrow_id UUID REFERENCES escrows(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_supplier_transactions_business_id ON business_supplier_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_business_supplier_transactions_supplier_id ON business_supplier_transactions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_business_supplier_transactions_created_at ON business_supplier_transactions(created_at DESC);

ALTER TABLE business_supplier_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owners can manage own supplier transactions"
  ON business_supplier_transactions FOR ALL
  USING ((SELECT owner_user_id FROM businesses WHERE id = business_id) = auth.uid())
  WITH CHECK ((SELECT owner_user_id FROM businesses WHERE id = business_id) = auth.uid());

COMMENT ON TABLE business_supplier_transactions IS 'Supplier transaction history for Business Suite; populated when recording supplier payments (not payroll).';
