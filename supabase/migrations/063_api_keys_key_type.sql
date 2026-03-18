-- Key type for API Keys dashboard tabs: Main Key, Mobile Key, Backend Key.
ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS key_type TEXT NOT NULL DEFAULT 'main'
    CHECK (key_type IN ('main', 'mobile', 'backend'));

COMMENT ON COLUMN api_keys.key_type IS 'main | mobile | backend – for filtering in API Keys list.';
