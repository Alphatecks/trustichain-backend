-- One global supplier ID per registered business (BSUP-YYYY-NNNNN), used platform-wide when creating supply contracts.

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS global_supplier_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_global_supplier_id_unique
  ON businesses (global_supplier_id)
  WHERE global_supplier_id IS NOT NULL;

-- Link saved buyer contacts to the supplier business entity.
ALTER TABLE business_suppliers
  ADD COLUMN IF NOT EXISTS supplier_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_business_suppliers_supplier_business_id
  ON business_suppliers (supplier_business_id)
  WHERE supplier_business_id IS NOT NULL;

-- Supply contract → supplier business entity (counterparty's registered business).
ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS supplier_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_escrows_supplier_business_id
  ON escrows (supplier_business_id)
  WHERE supplier_business_id IS NOT NULL;

-- Backfill global supplier IDs for verified businesses (platform-wide sequence per year).
WITH numbered AS (
  SELECT
    id,
    'BSUP-' || EXTRACT(YEAR FROM COALESCE(reviewed_at, created_at))::INT || '-' ||
    LPAD(
      ROW_NUMBER() OVER (
        PARTITION BY EXTRACT(YEAR FROM COALESCE(reviewed_at, created_at))
        ORDER BY COALESCE(reviewed_at, created_at) ASC
      )::TEXT,
      5,
      '0'
    ) AS display_id
  FROM businesses
  WHERE status = 'Verified'
    AND global_supplier_id IS NULL
)
UPDATE businesses b
SET global_supplier_id = numbered.display_id
FROM numbered
WHERE b.id = numbered.id;

COMMENT ON COLUMN businesses.global_supplier_id IS 'Platform-wide supplier ID (BSUP-YYYY-NNNNN). Any business uses this to create supply contracts with this registered business.';
COMMENT ON COLUMN business_suppliers.supplier_business_id IS 'Registered supplier business (businesses.id) this contact refers to.';
COMMENT ON COLUMN escrows.supplier_business_id IS 'Registered supplier business on a supply contract (businesses.id of counterparty).';
