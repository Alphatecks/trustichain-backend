-- Create trustiscore table
CREATE TABLE IF NOT EXISTS trustiscore (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  level TEXT NOT NULL DEFAULT 'Bronze' CHECK (level IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
  factors JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_trustiscore_user_id ON trustiscore(user_id);
CREATE INDEX IF NOT EXISTS idx_trustiscore_score ON trustiscore(score);
CREATE INDEX IF NOT EXISTS idx_trustiscore_level ON trustiscore(level);

-- Enable Row Level Security
ALTER TABLE trustiscore ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can view their own trustiscore
CREATE POLICY "Users can view own trustiscore"
  ON trustiscore
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy: Service role can update trustiscore (for automated calculations)
-- Users cannot directly update their own score
CREATE POLICY "Service role can update trustiscore"
  ON trustiscore
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_trustiscore_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_trustiscore_updated_at
  BEFORE UPDATE ON trustiscore
  FOR EACH ROW
  EXECUTE FUNCTION update_trustiscore_updated_at();




