-- Create dispute_messages table for dispute chat functionality
-- This allows parties and mediators to communicate within a dispute

CREATE TABLE IF NOT EXISTS dispute_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  sender_role VARCHAR(50), -- 'initiator', 'respondent', 'mediator', 'admin'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_dispute_messages_dispute_id ON dispute_messages(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_sender_user_id ON dispute_messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_dispute_messages_created_at ON dispute_messages(dispute_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view messages for disputes they're involved in
CREATE POLICY "Users can view messages for own disputes"
  ON dispute_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_messages.dispute_id
      AND (d.initiator_user_id = auth.uid() OR d.respondent_user_id = auth.uid() OR d.mediator_user_id = auth.uid())
    )
  );

-- Policy: Users can send messages for disputes they're involved in
CREATE POLICY "Users can send messages for own disputes"
  ON dispute_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_messages.dispute_id
      AND (d.initiator_user_id = auth.uid() OR d.respondent_user_id = auth.uid() OR d.mediator_user_id = auth.uid())
    )
    AND sender_user_id = auth.uid()
  );

-- Policy: Service role can manage all messages
CREATE POLICY "Service role can manage messages"
  ON dispute_messages
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_dispute_messages_updated_at
  BEFORE UPDATE ON dispute_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE dispute_messages IS 'Chat messages for dispute resolution communication';
COMMENT ON COLUMN dispute_messages.sender_role IS 'Role of the sender: initiator, respondent, mediator, admin';
COMMENT ON COLUMN dispute_messages.message_text IS 'The actual message content';
