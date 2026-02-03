-- Create dispute_timeline_events table for tracking dispute resolution timeline
-- This tracks all events in the dispute resolution process chronologically

CREATE TABLE IF NOT EXISTS dispute_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- e.g., 'dispute_filed', 'mediator_assigned', 'evidence_submitted', 'mediation_session_started', 'custom'
  title TEXT NOT NULL, -- Display title (e.g., "Dispute Filed", "Mediator Assigned")
  description TEXT, -- Optional detailed description
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for system-generated events
  is_system_event BOOLEAN DEFAULT false, -- true for automatic system events, false for manual entries
  metadata JSONB, -- Additional event data (flexible structure)
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When the event occurred
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_dispute_timeline_events_dispute_id ON dispute_timeline_events(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_timeline_events_event_type ON dispute_timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_dispute_timeline_events_event_timestamp ON dispute_timeline_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_dispute_timeline_events_created_by ON dispute_timeline_events(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_dispute_timeline_events_is_system ON dispute_timeline_events(is_system_event);

-- Composite index for common query pattern (dispute + timestamp order)
CREATE INDEX IF NOT EXISTS idx_dispute_timeline_events_dispute_timestamp ON dispute_timeline_events(dispute_id, event_timestamp DESC);

-- Enable Row Level Security
ALTER TABLE dispute_timeline_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view timeline events for disputes they're involved in
CREATE POLICY "Users can view timeline events for own disputes"
  ON dispute_timeline_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_timeline_events.dispute_id
      AND (d.initiator_user_id = auth.uid() OR d.respondent_user_id = auth.uid())
    )
  );

-- Policy: Users can create timeline events for disputes they're involved in (manual entries)
CREATE POLICY "Users can create timeline events for own disputes"
  ON dispute_timeline_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_timeline_events.dispute_id
      AND (d.initiator_user_id = auth.uid() OR d.respondent_user_id = auth.uid())
    )
    AND is_system_event = false -- Users can only create manual events, not system events
  );

-- Policy: Service role can manage all timeline events (for system-generated events)
CREATE POLICY "Service role can manage timeline events"
  ON dispute_timeline_events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_dispute_timeline_events_updated_at
  BEFORE UPDATE ON dispute_timeline_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE dispute_timeline_events IS 'Tracks chronological events in the dispute resolution timeline';
COMMENT ON COLUMN dispute_timeline_events.event_type IS 'Type of event: dispute_filed, mediator_assigned, evidence_submitted, mediation_session_started, mediation_session_ended, assessment_created, assessment_published, dispute_resolved, dispute_cancelled, custom, etc.';
COMMENT ON COLUMN dispute_timeline_events.title IS 'Display title for the event (e.g., "Dispute Filed", "Mediator Assigned")';
COMMENT ON COLUMN dispute_timeline_events.is_system_event IS 'true for automatic system-generated events, false for manual user/admin entries';
COMMENT ON COLUMN dispute_timeline_events.metadata IS 'Additional event data stored as JSON (e.g., mediator name, evidence count, session duration)';
COMMENT ON COLUMN dispute_timeline_events.event_timestamp IS 'When the event actually occurred (can be different from created_at for historical entries)';
