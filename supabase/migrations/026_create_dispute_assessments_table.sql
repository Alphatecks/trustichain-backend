-- Create dispute_assessments table for preliminary assessments and key findings
-- This allows admins/mediators to create and manage dispute assessments

CREATE TABLE IF NOT EXISTS dispute_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id UUID NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_type VARCHAR(50) NOT NULL DEFAULT 'preliminary', -- 'preliminary', 'final', 'review'
  title TEXT NOT NULL DEFAULT 'Preliminary Assessment',
  summary TEXT, -- Overall summary of the assessment
  status VARCHAR(50) NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'archived'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Create dispute_assessment_findings table for key findings
CREATE TABLE IF NOT EXISTS dispute_assessment_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES dispute_assessments(id) ON DELETE CASCADE,
  finding_text TEXT NOT NULL, -- The actual finding text (e.g., "Initial project brief contains conflicting style requirements")
  finding_type VARCHAR(50), -- Optional: 'positive', 'negative', 'neutral', 'observation'
  order_index INTEGER NOT NULL DEFAULT 0, -- For ordering findings
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_dispute_assessments_dispute_id ON dispute_assessments(dispute_id);
CREATE INDEX IF NOT EXISTS idx_dispute_assessments_created_by ON dispute_assessments(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_dispute_assessments_status ON dispute_assessments(status);
CREATE INDEX IF NOT EXISTS idx_dispute_assessments_type ON dispute_assessments(assessment_type);
CREATE INDEX IF NOT EXISTS idx_dispute_assessment_findings_assessment_id ON dispute_assessment_findings(assessment_id);
CREATE INDEX IF NOT EXISTS idx_dispute_assessment_findings_order ON dispute_assessment_findings(assessment_id, order_index);

-- Enable Row Level Security
ALTER TABLE dispute_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_assessment_findings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view assessments for disputes they're involved in
CREATE POLICY "Users can view assessments for own disputes"
  ON dispute_assessments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM disputes d
      WHERE d.id = dispute_assessments.dispute_id
      AND (d.initiator_user_id = auth.uid() OR d.respondent_user_id = auth.uid())
    )
  );

-- Policy: Service role and admins can manage all assessments
CREATE POLICY "Service role can manage assessments"
  ON dispute_assessments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy: Users can view findings for assessments they can view
CREATE POLICY "Users can view findings for accessible assessments"
  ON dispute_assessment_findings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM dispute_assessments da
      JOIN disputes d ON d.id = da.dispute_id
      WHERE da.id = dispute_assessment_findings.assessment_id
      AND (d.initiator_user_id = auth.uid() OR d.respondent_user_id = auth.uid())
    )
  );

-- Policy: Service role can manage all findings
CREATE POLICY "Service role can manage findings"
  ON dispute_assessment_findings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger to automatically update updated_at
CREATE TRIGGER update_dispute_assessments_updated_at
  BEFORE UPDATE ON dispute_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dispute_assessment_findings_updated_at
  BEFORE UPDATE ON dispute_assessment_findings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE dispute_assessments IS 'Stores preliminary and final assessments for disputes, created by admins/mediators';
COMMENT ON TABLE dispute_assessment_findings IS 'Stores key findings for each assessment';
COMMENT ON COLUMN dispute_assessments.assessment_type IS 'Type of assessment: preliminary, final, or review';
COMMENT ON COLUMN dispute_assessments.status IS 'Status: draft (being created), published (visible to parties), archived';
COMMENT ON COLUMN dispute_assessment_findings.finding_text IS 'The actual finding text displayed in the assessment';
COMMENT ON COLUMN dispute_assessment_findings.order_index IS 'Order in which findings should be displayed';
