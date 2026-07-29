-- Stripe wallet funding (Google Pay / Apple Pay) persistence and idempotency
CREATE TABLE IF NOT EXISTS wallet_funding_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  suite_context TEXT NOT NULL DEFAULT 'personal' CHECK (suite_context IN ('personal', 'business')),
  provider TEXT NOT NULL DEFAULT 'stripe',
  stripe_intent_id TEXT NOT NULL UNIQUE,
  stripe_client_secret TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  amount_usd DECIMAL(20, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  balance_asset TEXT NOT NULL DEFAULT 'USDC' CHECK (balance_asset IN ('USDT', 'USDC')),
  status TEXT NOT NULL DEFAULT 'requires_payment_method',
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  credited_at TIMESTAMP WITH TIME ZONE,
  failure_code TEXT,
  failure_message TEXT,
  latest_webhook_event_id TEXT,
  latest_webhook_event_type TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_last_event JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_wallet_funding_attempts_user_id
  ON wallet_funding_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_funding_attempts_wallet_id
  ON wallet_funding_attempts(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_funding_attempts_status
  ON wallet_funding_attempts(status);
CREATE INDEX IF NOT EXISTS idx_wallet_funding_attempts_stripe_intent_id
  ON wallet_funding_attempts(stripe_intent_id);

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS wallet_funding_attempt_id UUID REFERENCES wallet_funding_attempts(id) ON DELETE SET NULL;

ALTER TABLE wallet_funding_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet funding attempts"
  ON wallet_funding_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage wallet funding attempts"
  ON wallet_funding_attempts
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_wallet_funding_attempts_updated_at
  BEFORE UPDATE ON wallet_funding_attempts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
