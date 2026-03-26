-- Unique Trustitag per user for P2P XRP by handle (stored lowercase).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS trustitag TEXT;

COMMENT ON COLUMN users.trustitag IS 'Unique handle for sending XRP to registered users; lowercase [a-z0-9_], typically tc_ + random hex';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_trustitag_unique
  ON users (trustitag)
  WHERE trustitag IS NOT NULL;
