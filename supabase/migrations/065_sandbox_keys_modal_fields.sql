-- Create New Sandbox Key modal: environment name, purpose, auto-generate, IP allowlist, permissions, status.
ALTER TABLE sandbox_keys
  ADD COLUMN IF NOT EXISTS environment_name TEXT,
  ADD COLUMN IF NOT EXISTS environment_purpose TEXT,
  ADD COLUMN IF NOT EXISTS auto_generate_keys BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN sandbox_keys.environment_name IS 'Environment name (e.g. Angelo Group).';
COMMENT ON COLUMN sandbox_keys.environment_purpose IS 'Purpose/category from dropdown.';
COMMENT ON COLUMN sandbox_keys.auto_generate_keys IS 'Auto-generate sandbox API keys toggle.';
COMMENT ON COLUMN sandbox_keys.allowed_ips IS 'IP allowlist; NULL = no restriction.';
COMMENT ON COLUMN sandbox_keys.permissions IS 'Selected permissions: cancel_escrow, create_escrow, release_escrow, create_wallet, read_wallet, transaction_logs, webhook_test_events.';
COMMENT ON COLUMN sandbox_keys.is_active IS 'Key status: active or inactive.';
