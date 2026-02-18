-- Store FCM (Firebase Cloud Messaging) device tokens for push notifications
CREATE TABLE IF NOT EXISTS user_fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  device_id TEXT,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_user_id ON user_fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_fcm_tokens_fcm_token ON user_fcm_tokens(fcm_token);

ALTER TABLE user_fcm_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own FCM tokens
CREATE POLICY "Users can view own fcm tokens"
  ON user_fcm_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fcm tokens"
  ON user_fcm_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fcm tokens"
  ON user_fcm_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fcm tokens"
  ON user_fcm_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_fcm_tokens_updated_at
  BEFORE UPDATE ON user_fcm_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
