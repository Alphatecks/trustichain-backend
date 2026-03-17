-- Extend api_keys for Create API Key modal: environment, permission, IP whitelist, expiry, rotation, service scopes.
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'production'
    CHECK (environment IN ('development', 'staging', 'production')),
  ADD COLUMN IF NOT EXISTS permission TEXT NOT NULL DEFAULT 'read'
    CHECK (permission IN ('read', 'write', 'admin')),
  ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rotate_automatically BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS service_scopes TEXT[] DEFAULT NULL;

COMMENT ON COLUMN api_keys.environment IS 'development | staging | production';
COMMENT ON COLUMN api_keys.permission IS 'read | write | admin';
COMMENT ON COLUMN api_keys.allowed_ips IS 'IP whitelist: single IPs or CIDR (e.g. 192.168.1.1, 10.0.0.0/24). NULL = no restriction.';
COMMENT ON COLUMN api_keys.expires_at IS 'Key invalid after this time. NULL = no expiry.';
COMMENT ON COLUMN api_keys.rotate_automatically IS 'Whether to auto-rotate this key (future use).';
COMMENT ON COLUMN api_keys.service_scopes IS 'TrustiChain services this key can access: payroll, escrow, supplier, transfer. NULL = all.';
