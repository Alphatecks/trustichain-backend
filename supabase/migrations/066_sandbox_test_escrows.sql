-- Test escrows created via Sandbox "Test Escrow > Create" (Testing Tools).
CREATE TABLE IF NOT EXISTS sandbox_test_escrows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  amount_usd DECIMAL(20, 2),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_test_escrows_business_id ON sandbox_test_escrows(business_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_test_escrows_created_at ON sandbox_test_escrows(created_at);

COMMENT ON TABLE sandbox_test_escrows IS 'Test escrows created in Sandbox Testing Tools for Copy reference.';
