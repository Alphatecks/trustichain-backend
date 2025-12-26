-- Add 'wallet_swap' to notification_type enum
DO $$ 
BEGIN
  -- Check if 'wallet_swap' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'wallet_swap' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'wallet_swap';
  END IF;
END $$;

-- Add comment for clarity
COMMENT ON TYPE notification_type IS 'Notification types: wallet_deposit, wallet_withdrawal, wallet_swap, escrow_created, escrow_completed, escrow_cancelled, dispute_opened, dispute_resolved, generic';

