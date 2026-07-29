-- Stripe-gated escrow: frozen payable amounts and payment method
ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'xrp_wallet'
    CHECK (payment_method IN ('xrp_wallet', 'stripe'));

ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS creation_fee_usd DECIMAL(20, 2);

ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS payable_amount_usd DECIMAL(20, 2);

ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS stripe_funded_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_escrows_payment_method ON escrows(payment_method);

COMMENT ON COLUMN escrows.payment_method IS 'xrp_wallet: funded from payer custodial XRP; stripe: funded via Google Pay / Apple Pay before XRPL creation';
COMMENT ON COLUMN escrows.creation_fee_usd IS 'Platform creation fee frozen at escrow create time (USD)';
COMMENT ON COLUMN escrows.payable_amount_usd IS 'Total Stripe charge: amount_usd + creation_fee_usd';
