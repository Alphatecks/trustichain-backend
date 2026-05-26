-- Stripe payment persistence for escrow linkage and webhook idempotency
CREATE TABLE IF NOT EXISTS escrow_payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES escrows(id) ON DELETE CASCADE,
  payer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  counterparty_id UUID REFERENCES users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'stripe',
  intent_type TEXT NOT NULL CHECK (intent_type IN ('payment_intent', 'setup_intent')),
  stripe_intent_id TEXT NOT NULL UNIQUE,
  stripe_client_secret TEXT NOT NULL,
  stripe_customer_id TEXT,
  idempotency_key TEXT NOT NULL,
  amount_usd DECIMAL(20, 2),
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'requires_payment_method',
  retry_count INTEGER NOT NULL DEFAULT 0,
  failure_code TEXT,
  failure_message TEXT,
  fraud_risk_level TEXT,
  fraud_rule_hit BOOLEAN NOT NULL DEFAULT FALSE,
  latest_webhook_event_id TEXT,
  latest_webhook_event_type TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_last_event JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (escrow_id, intent_type, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_escrow_payment_attempts_escrow_id
  ON escrow_payment_attempts(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_payment_attempts_payer_user_id
  ON escrow_payment_attempts(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_escrow_payment_attempts_status
  ON escrow_payment_attempts(status);
CREATE INDEX IF NOT EXISTS idx_escrow_payment_attempts_stripe_intent_id
  ON escrow_payment_attempts(stripe_intent_id);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_intent_id TEXT,
  payment_attempt_id UUID REFERENCES escrow_payment_attempts(id) ON DELETE SET NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_stripe_intent_id
  ON stripe_webhook_events(stripe_intent_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed
  ON stripe_webhook_events(processed, created_at DESC);

ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';

ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS payment_linked_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_escrows_payment_status
  ON escrows(payment_status);

ALTER TABLE escrow_payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own escrow payment attempts"
  ON escrow_payment_attempts
  FOR SELECT
  USING (auth.uid() = payer_user_id OR auth.uid() = counterparty_id);

CREATE POLICY "Service role can manage escrow payment attempts"
  ON escrow_payment_attempts
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage stripe webhook events"
  ON stripe_webhook_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_escrow_payment_attempts_updated_at
  BEFORE UPDATE ON escrow_payment_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
