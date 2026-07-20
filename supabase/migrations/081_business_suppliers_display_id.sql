-- Dedicated supplier display ID (SUPP-YYYY-NNN) per business, and link supply contracts to supplier rows.

ALTER TABLE business_suppliers
  ADD COLUMN IF NOT EXISTS supplier_display_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_suppliers_business_display_id
  ON business_suppliers (business_id, supplier_display_id)
  WHERE supplier_display_id IS NOT NULL;

-- Backfill existing suppliers with SUPP-YYYY-NNN by created_at order within each business/year.
WITH numbered AS (
  SELECT
    id,
    'SUPP-' || EXTRACT(YEAR FROM created_at)::INT || '-' ||
    LPAD(
      ROW_NUMBER() OVER (
        PARTITION BY business_id, EXTRACT(YEAR FROM created_at)
        ORDER BY created_at ASC
      )::TEXT,
      3,
      '0'
    ) AS display_id
  FROM business_suppliers
  WHERE supplier_display_id IS NULL
)
UPDATE business_suppliers bs
SET supplier_display_id = numbered.display_id
FROM numbered
WHERE bs.id = numbered.id;

ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS business_supplier_id UUID REFERENCES business_suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_display_id TEXT;

CREATE INDEX IF NOT EXISTS idx_escrows_business_supplier_id
  ON escrows (business_supplier_id)
  WHERE business_supplier_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_escrows_contract_display_id
  ON escrows (contract_display_id)
  WHERE contract_display_id IS NOT NULL;

-- Backfill SC-YYYY-NNN contract display ids for existing supply escrows (creator order per year).
WITH numbered_contracts AS (
  SELECT
    id,
    'SC-' || EXTRACT(YEAR FROM created_at)::INT || '-' ||
    LPAD(
      ROW_NUMBER() OVER (
        PARTITION BY user_id, EXTRACT(YEAR FROM created_at)
        ORDER BY created_at ASC
      )::TEXT,
      3,
      '0'
    ) AS display_id
  FROM escrows
  WHERE transaction_type = 'supply'
    AND suite_context = 'business'
    AND contract_display_id IS NULL
)
UPDATE escrows e
SET contract_display_id = numbered_contracts.display_id
FROM numbered_contracts
WHERE e.id = numbered_contracts.id;

COMMENT ON COLUMN business_suppliers.supplier_display_id IS 'Human-readable supplier ID (SUPP-YYYY-NNN), unique per business per year sequence.';
COMMENT ON COLUMN escrows.business_supplier_id IS 'Linked business_suppliers row when contract was created from a saved supplier.';
COMMENT ON COLUMN escrows.contract_display_id IS 'Human-readable supply contract ID (SC-YYYY-NNN).';
