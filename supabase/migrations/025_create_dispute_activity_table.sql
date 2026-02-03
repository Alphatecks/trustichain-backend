-- Create dispute_activity table to track user viewing activity on dispute pages
-- This allows the backend to determine if a user is still on the dispute page

CREATE TABLE IF NOT EXISTS dispute_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_dispute_activity_dispute_id ON dispute_activity(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_activity_user_id ON dispute_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_dispute_activity_last_viewed_at ON dispute_activity(last_viewed_at);
CREATE INDEX IF NOT EXISTS idx_dispute_activity_is_active ON dispute_activity(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dispute_activity_unique ON dispute_activity(dispute_id, user_id);

-- Enable Row Level Security
ALTER TABLE dispute_activity ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own activity records
CREATE POLICY "Users can view own dispute activity"
  ON dispute_activity
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert/update their own activity
CREATE POLICY "Users can manage own dispute activity"
  ON dispute_activity
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can manage all activity
CREATE POLICY "Service role can manage dispute activity"
  ON dispute_activity
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_dispute_activity_updated_at
  BEFORE UPDATE ON dispute_activity
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE dispute_activity IS 'Tracks user viewing activity on dispute pages. Used to determine if a user is still on the dispute page.';
COMMENT ON COLUMN dispute_activity.last_viewed_at IS 'Last time the user viewed/refreshed the dispute page';
COMMENT ON COLUMN dispute_activity.is_active IS 'Whether the user is currently considered active on the dispute page (based on recent activity)';
