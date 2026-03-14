-- Business contact email (required for some flows; fallback to owner user email if not set)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS business_email TEXT;

COMMENT ON COLUMN businesses.business_email IS 'Business contact email. When null/empty, owner user email is used. Can be set via PATCH /api/business-suite/business-email.';

CREATE INDEX IF NOT EXISTS idx_businesses_business_email ON businesses(business_email) WHERE business_email IS NOT NULL;
