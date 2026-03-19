-- Update Webhook URL modal: store the URL where TrustiChain will send webhooks (must be publicly reachable HTTPS).
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS webhook_url TEXT DEFAULT NULL;

COMMENT ON COLUMN businesses.webhook_url IS 'Webhook URL for this business; TrustiChain sends events here. Must be publicly reachable HTTPS.';
