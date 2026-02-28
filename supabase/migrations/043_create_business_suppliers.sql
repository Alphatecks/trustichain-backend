-- Business Suite: Create New Supplier (name, due date, amount)
CREATE TABLE IF NOT EXISTS business_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  due_date DATE NOT NULL,
  amount_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_suppliers_user_id ON business_suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_business_suppliers_due_date ON business_suppliers(due_date);

CREATE TRIGGER update_business_suppliers_updated_at
  BEFORE UPDATE ON business_suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE business_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business users can manage own suppliers"
  ON business_suppliers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
