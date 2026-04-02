-- Admin-configurable escrow creation fees (USD) by escrow type

CREATE TABLE IF NOT EXISTS platform_escrow_fee_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  personal_freelancer_fee_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,
  supplier_fee_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,
  payroll_fee_usd DECIMAL(20, 2) NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_escrow_fee_settings (
  id,
  personal_freelancer_fee_usd,
  supplier_fee_usd,
  payroll_fee_usd
)
VALUES ('default', 0, 0, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE platform_escrow_fee_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage platform_escrow_fee_settings"
  ON platform_escrow_fee_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE platform_escrow_fee_settings IS
  'Singleton admin settings row for escrow creation fees in USD by type.';
