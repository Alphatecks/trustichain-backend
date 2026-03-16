-- Supply contract (supplier) actions: mark delivered, request buyer confirmation
ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS delivery_marked_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS buyer_confirmation_requested_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN escrows.delivery_marked_at IS 'When the supplier marked the contract as delivered (supply escrows).';
COMMENT ON COLUMN escrows.buyer_confirmation_requested_at IS 'When the supplier requested buyer confirmation (supply escrows); used to send email to buyer.';
