-- Separate business vs personal activity: escrows created from Business Suite are tagged.
-- Personal dashboard shows all escrows; Business dashboard shows only suite_context = 'business'.
ALTER TABLE escrows
  ADD COLUMN IF NOT EXISTS suite_context TEXT DEFAULT NULL;

COMMENT ON COLUMN escrows.suite_context IS 'personal (null) or business; business dashboard only shows business escrows';

CREATE INDEX IF NOT EXISTS idx_escrows_suite_context ON escrows(suite_context);
