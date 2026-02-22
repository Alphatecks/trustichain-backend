-- Extend admins for Settings: profile photo and notification preferences
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN admins.avatar_url IS 'Admin profile photo URL (set by frontend after upload to storage).';
COMMENT ON COLUMN admins.email_notifications_enabled IS 'Whether admin receives email updates for disputes and account activity.';
COMMENT ON COLUMN admins.push_notifications_enabled IS 'Whether admin receives browser and in-app push notifications.';
