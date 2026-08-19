-- User display currency preference (frontend fiat conversion; default USD)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_display_currency_check;

ALTER TABLE users
  ADD CONSTRAINT users_display_currency_check
  CHECK (
    display_currency IN (
      'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'HKD', 'SGD',
      'INR', 'NGN', 'ZAR', 'BRL', 'MXN', 'AED', 'SAR', 'TRY', 'KRW', 'RLUSD'
    )
  );
