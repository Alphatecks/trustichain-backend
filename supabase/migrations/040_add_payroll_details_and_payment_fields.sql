-- Add payroll details (Step 1) and payment details (Step 3) fields from Add new payroll UI
ALTER TABLE business_payrolls
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS company_email TEXT,
  ADD COLUMN IF NOT EXISTS payroll_cycle TEXT,
  ADD COLUMN IF NOT EXISTS cycle_date DATE,
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS company_description TEXT,
  ADD COLUMN IF NOT EXISTS default_salary_type TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS enable_allowances BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN business_payrolls.payroll_cycle IS 'Weekly, Bi-weekly, Other';
