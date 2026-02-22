-- Platform escrow fee balance (10% of each escrow credited here) and admin withdrawals

-- Singleton balance row: id = 'default'
CREATE TABLE IF NOT EXISTS platform_escrow_fee_balance (
  id TEXT PRIMARY KEY DEFAULT 'default',
  balance_xrp DECIMAL(20, 6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_escrow_fee_balance (id, balance_xrp, updated_at)
VALUES ('default', 0, NOW())
ON CONFLICT (id) DO NOTHING;

-- Withdrawal history
CREATE TABLE IF NOT EXISTS escrow_fee_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_xrp DECIMAL(20, 6) NOT NULL,
  destination_xrpl_address TEXT NOT NULL,
  xrpl_tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  withdrawn_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_fee_withdrawals_status ON escrow_fee_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_escrow_fee_withdrawals_created_at ON escrow_fee_withdrawals(created_at DESC);

ALTER TABLE escrow_fee_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage escrow_fee_withdrawals"
  ON escrow_fee_withdrawals
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Atomic credit: add to balance and return new balance
CREATE OR REPLACE FUNCTION credit_escrow_fee(amount_xrp DECIMAL)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance DECIMAL(20, 6);
BEGIN
  UPDATE platform_escrow_fee_balance
  SET balance_xrp = balance_xrp + amount_xrp,
      updated_at = NOW()
  WHERE id = 'default';
  SELECT balance_xrp INTO new_balance FROM platform_escrow_fee_balance WHERE id = 'default';
  RETURN new_balance;
END;
$$;

ALTER TABLE platform_escrow_fee_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage platform_escrow_fee_balance"
  ON platform_escrow_fee_balance
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_escrow_fee_withdrawals_updated_at
  BEFORE UPDATE ON escrow_fee_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE platform_escrow_fee_balance IS 'Singleton row: platform balance of escrow fees (10% XRP per escrow creation).';
COMMENT ON TABLE escrow_fee_withdrawals IS 'Admin withdrawals of escrow fees to XRPL addresses.';
