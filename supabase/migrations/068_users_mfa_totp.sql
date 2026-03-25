-- TOTP (Google Authenticator) MFA for app users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS mfa_pending_secret_encrypted TEXT;

COMMENT ON COLUMN users.mfa_enabled IS 'Whether TOTP MFA is active for this account';
COMMENT ON COLUMN users.mfa_secret_encrypted IS 'AES-GCM encrypted Base32 TOTP secret (when mfa_enabled)';
COMMENT ON COLUMN users.mfa_pending_secret_encrypted IS 'Encrypted pending secret during enrollment before verify';
