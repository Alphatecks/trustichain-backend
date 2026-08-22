-- Allow authenticated users to read admin-configured escrow fee percentages (read-only).

CREATE POLICY "Authenticated users can read platform_escrow_fee_settings"
  ON platform_escrow_fee_settings
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "Authenticated users can read platform_escrow_fee_settings"
  ON platform_escrow_fee_settings IS
  'Escrow creation UI reads fee percentages configured by admin.';
