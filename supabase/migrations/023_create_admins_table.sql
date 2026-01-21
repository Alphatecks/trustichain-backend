-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);

-- Enable Row Level Security
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Create policy: Only service role can manage admins
-- Regular users cannot see or modify admin records
CREATE POLICY "Service role can manage admins"
  ON admins
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policy: Admins can view their own record
CREATE POLICY "Admins can view own record"
  ON admins
  FOR SELECT
  USING (auth.uid() = id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_admins_updated_at
  BEFORE UPDATE ON admins
  FOR EACH ROW
  EXECUTE FUNCTION update_admins_updated_at();

-- Insert default admin user (you should change the password after first login)
-- Note: You need to create the user in auth.users first, then insert into admins table
-- Example SQL to create admin user (run this manually after creating the auth user):
-- INSERT INTO admins (id, email, full_name, is_active)
-- VALUES (
--   '<user-id-from-auth-users>',
--   'admin@trustichain.com',
--   'Admin User',
--   true
-- );
