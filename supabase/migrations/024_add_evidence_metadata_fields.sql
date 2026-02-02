-- Add metadata fields to dispute_evidence table
-- This migration adds title, description, evidence_type, and verified status

-- Add title column
ALTER TABLE dispute_evidence 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Add description column
ALTER TABLE dispute_evidence 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add evidence_type column (to categorize evidence)
ALTER TABLE dispute_evidence 
ADD COLUMN IF NOT EXISTS evidence_type VARCHAR(50);

-- Add verified status column (default false)
ALTER TABLE dispute_evidence 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;

-- Create index for evidence_type filtering
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_type ON dispute_evidence(evidence_type);

-- Create index for verified status filtering
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_verified ON dispute_evidence(verified);

-- Add comments explaining the purpose of these fields
COMMENT ON COLUMN dispute_evidence.title IS 'Title of the evidence (e.g., "Original Agreement", "Final Deliverable")';
COMMENT ON COLUMN dispute_evidence.description IS 'Description of the evidence content';
COMMENT ON COLUMN dispute_evidence.evidence_type IS 'Type of evidence: original_agreement, final_deliverable, reference_images, work_progress_timeline, chat_screenshots, email_communications';
COMMENT ON COLUMN dispute_evidence.verified IS 'Whether the evidence has been verified by the mediator';
