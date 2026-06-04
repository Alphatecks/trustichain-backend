-- Store the amount and currency entered when filing a dispute (mirrors CreateDisputeRequest)
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS dispute_amount DECIMAL(20, 6),
  ADD COLUMN IF NOT EXISTS dispute_currency TEXT;

ALTER TABLE disputes
  DROP CONSTRAINT IF EXISTS disputes_dispute_currency_check;

ALTER TABLE disputes
  ADD CONSTRAINT disputes_dispute_currency_check
  CHECK (dispute_currency IS NULL OR dispute_currency IN ('USD', 'XRP'));

COMMENT ON COLUMN disputes.dispute_amount IS 'Amount in dispute as entered at filing time';
COMMENT ON COLUMN disputes.dispute_currency IS 'Currency of dispute_amount: USD or XRP';
