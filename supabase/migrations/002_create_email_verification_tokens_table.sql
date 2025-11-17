-- Create email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on token for faster lookups
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user_id ON email_verification_tokens(user_id);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_verification_tokens_expires_at ON email_verification_tokens(expires_at);

-- Enable Row Level Security
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy: Service role can manage all tokens
CREATE POLICY "Service role can manage verification tokens"
  ON email_verification_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_verification_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_verification_tokens_updated_at
  BEFORE UPDATE ON email_verification_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_verification_tokens_updated_at();

