-- Convert admin escrow fee settings from fixed USD amounts to percentages by escrow type.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'platform_escrow_fee_settings'
      AND column_name = 'personal_freelancer_fee_usd'
  ) THEN
    ALTER TABLE platform_escrow_fee_settings
      RENAME COLUMN personal_freelancer_fee_usd TO personal_freelancer_fee_percentage;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'platform_escrow_fee_settings'
      AND column_name = 'supplier_fee_usd'
  ) THEN
    ALTER TABLE platform_escrow_fee_settings
      RENAME COLUMN supplier_fee_usd TO supplier_fee_percentage;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'platform_escrow_fee_settings'
      AND column_name = 'payroll_fee_usd'
  ) THEN
    ALTER TABLE platform_escrow_fee_settings
      RENAME COLUMN payroll_fee_usd TO payroll_fee_percentage;
  END IF;
END $$;

ALTER TABLE platform_escrow_fee_settings
  ALTER COLUMN personal_freelancer_fee_percentage TYPE DECIMAL(10, 4) USING personal_freelancer_fee_percentage::DECIMAL(10, 4),
  ALTER COLUMN supplier_fee_percentage TYPE DECIMAL(10, 4) USING supplier_fee_percentage::DECIMAL(10, 4),
  ALTER COLUMN payroll_fee_percentage TYPE DECIMAL(10, 4) USING payroll_fee_percentage::DECIMAL(10, 4),
  ALTER COLUMN personal_freelancer_fee_percentage SET DEFAULT 0,
  ALTER COLUMN supplier_fee_percentage SET DEFAULT 0,
  ALTER COLUMN payroll_fee_percentage SET DEFAULT 0;

COMMENT ON TABLE platform_escrow_fee_settings IS
  'Singleton admin settings row for escrow creation fee percentages by escrow type.';
