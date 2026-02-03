-- Add final verdict fields to disputes table
-- This tracks the final verdict/decision process for disputes

-- Create verdict status enum
CREATE TYPE verdict_status AS ENUM ('pending', 'decision_pending', 'decision_made', 'under_review');

-- Add mediator assignment
ALTER TABLE disputes 
ADD COLUMN IF NOT EXISTS mediator_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add verdict status
ALTER TABLE disputes 
ADD COLUMN IF NOT EXISTS verdict_status verdict_status DEFAULT 'pending';

-- Add decision deadline (when decision is expected)
ALTER TABLE disputes 
ADD COLUMN IF NOT EXISTS decision_deadline TIMESTAMPTZ;

-- Add final verdict/decision text
ALTER TABLE disputes 
ADD COLUMN IF NOT EXISTS final_verdict TEXT;

-- Add decision date (when decision was made)
ALTER TABLE disputes 
ADD COLUMN IF NOT EXISTS decision_date TIMESTAMPTZ;

-- Add decision summary/explanation
ALTER TABLE disputes 
ADD COLUMN IF NOT EXISTS decision_summary TEXT;

-- Add decision outcome (e.g., 'favor_initiator', 'favor_respondent', 'partial', 'dismissed')
ALTER TABLE disputes 
ADD COLUMN IF NOT EXISTS decision_outcome VARCHAR(50);

-- Add index for mediator lookups
CREATE INDEX IF NOT EXISTS idx_disputes_mediator_user_id ON disputes(mediator_user_id);

-- Add index for verdict status filtering
CREATE INDEX IF NOT EXISTS idx_disputes_verdict_status ON disputes(verdict_status);

-- Add index for decision deadline (for queries on pending decisions)
CREATE INDEX IF NOT EXISTS idx_disputes_decision_deadline ON disputes(decision_deadline);

-- Add comments
COMMENT ON COLUMN disputes.mediator_user_id IS 'User ID of the assigned mediator/admin reviewing the dispute';
COMMENT ON COLUMN disputes.verdict_status IS 'Status of the final verdict: pending (no mediator assigned), decision_pending (mediator reviewing), decision_made (decision provided), under_review';
COMMENT ON COLUMN disputes.decision_deadline IS 'Expected deadline for the mediator to provide a decision (e.g., 24 hours from assignment)';
COMMENT ON COLUMN disputes.final_verdict IS 'The final verdict/decision text provided by the mediator';
COMMENT ON COLUMN disputes.decision_date IS 'Date and time when the final decision was made';
COMMENT ON COLUMN disputes.decision_summary IS 'Summary or explanation of the decision';
COMMENT ON COLUMN disputes.decision_outcome IS 'Outcome of the decision: favor_initiator, favor_respondent, partial, dismissed, etc.';
