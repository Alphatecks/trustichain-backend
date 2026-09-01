-- Persist the currency (and original amount) used when the escrow was created.
ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS denomination_currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS denomination_amount DECIMAL(20, 6);

UPDATE escrows
SET denomination_amount = amount_usd
WHERE denomination_amount IS NULL;

ALTER TABLE escrows
  DROP CONSTRAINT IF EXISTS escrows_denomination_currency_check;

ALTER TABLE escrows
  ADD CONSTRAINT escrows_denomination_currency_check
    CHECK (
      denomination_currency IN (
        'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'HKD', 'SGD',
        'INR', 'NGN', 'ZAR', 'BRL', 'MXN', 'AED', 'SAR', 'TRY', 'KRW', 'RLUSD', 'XRP'
      )
    );

COMMENT ON COLUMN escrows.denomination_currency IS 'Currency entered at escrow creation (fiat, RLUSD, USD, or XRP).';
COMMENT ON COLUMN escrows.denomination_amount IS 'Original amount in denomination_currency as entered at creation.';
