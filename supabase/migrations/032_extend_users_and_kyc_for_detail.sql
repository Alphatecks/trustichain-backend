-- Extend users for User Details screen: profile picture, date of birth, nationality display
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Extend user_kyc for KYC detail: linked ID type, card number, wallet address, document URLs
ALTER TABLE user_kyc
  ADD COLUMN IF NOT EXISTS linked_id_type TEXT,
  ADD COLUMN IF NOT EXISTS card_number TEXT,
  ADD COLUMN IF NOT EXISTS wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS document_live_selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS document_front_url TEXT,
  ADD COLUMN IF NOT EXISTS document_back_url TEXT;
