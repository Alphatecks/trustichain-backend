-- Create dispute_evidence table
CREATE TABLE IF NOT EXISTS dispute_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute_id ON dispute_evidence(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_uploaded_by ON dispute_evidence(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_uploaded_at ON dispute_evidence(uploaded_at);

-- Enable Row Level Security
ALTER TABLE dispute_evidence ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view evidence for disputes they are involved in
CREATE POLICY "Users can view own dispute evidence"
  ON dispute_evidence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM disputes
      WHERE disputes.id = dispute_evidence.dispute_id
      AND (auth.uid() = disputes.initiator_user_id OR auth.uid() = disputes.respondent_user_id)
    )
  );

-- Policy: Users can insert evidence for disputes they are involved in
CREATE POLICY "Users can insert own dispute evidence"
  ON dispute_evidence
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM disputes
      WHERE disputes.id = dispute_evidence.dispute_id
      AND (auth.uid() = disputes.initiator_user_id OR auth.uid() = disputes.respondent_user_id)
    )
    AND auth.uid() = uploaded_by_user_id
  );

-- Policy: Service role can manage all evidence
CREATE POLICY "Service role can manage dispute evidence"
  ON dispute_evidence
  FOR ALL
  USING (true)
  WITH CHECK (true);

