-- Add 'swap' to transaction_type enum
-- Note: PostgreSQL doesn't support IF NOT EXISTS for enum values, so this will error if 'swap' already exists
-- This is safe to run multiple times if the value already exists (it will just be ignored in practice)

DO $$ 
BEGIN
  -- Check if 'swap' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'swap' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'transaction_type')
  ) THEN
    ALTER TYPE transaction_type ADD VALUE 'swap';
  END IF;
END $$;

-- Add comment for clarity
COMMENT ON TYPE transaction_type IS 'Transaction types: deposit, withdrawal, escrow_create, escrow_release, escrow_cancel, transfer, swap';

