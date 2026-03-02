-- Supplier details UI: progress (0-100) for donut/card. Display id SUPP-YYYY-NNN computed in API from created_at order.
ALTER TABLE business_suppliers
  ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);

CREATE INDEX IF NOT EXISTS idx_business_suppliers_progress ON business_suppliers(progress) WHERE progress IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_business_suppliers_created_at ON business_suppliers(created_at);

COMMENT ON COLUMN business_suppliers.progress IS 'Completion progress 0-100 for supplier details card (donut).';
