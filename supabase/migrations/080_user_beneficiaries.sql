-- Saved beneficiaries (Trustitag contacts) for quick P2P sends.
CREATE TABLE IF NOT EXISTS user_beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  beneficiary_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trustitag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_beneficiaries_not_self CHECK (user_id <> beneficiary_user_id),
  UNIQUE (user_id, beneficiary_user_id),
  UNIQUE (user_id, trustitag)
);

CREATE INDEX IF NOT EXISTS idx_user_beneficiaries_user_id ON user_beneficiaries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_beneficiaries_trustitag ON user_beneficiaries(trustitag);

CREATE TRIGGER update_user_beneficiaries_updated_at
  BEFORE UPDATE ON user_beneficiaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE user_beneficiaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own beneficiaries"
  ON user_beneficiaries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE user_beneficiaries IS 'Saved Trustitag contacts for authenticated users';
COMMENT ON COLUMN user_beneficiaries.trustitag IS 'Normalized lowercase beneficiary handle at time of save';
