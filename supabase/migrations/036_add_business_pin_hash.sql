-- Business Suite: store hashed 6-digit PIN for switching into business suite
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_pin_hash TEXT;

COMMENT ON COLUMN users.business_pin_hash IS 'Scrypt hash of 6-digit business suite PIN; only set for business_suite/enterprise users';
