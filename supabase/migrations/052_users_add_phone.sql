-- Add phone to users for team member check and profile display
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
COMMENT ON COLUMN users.phone IS 'User phone number; used for team member lookup and display.';
