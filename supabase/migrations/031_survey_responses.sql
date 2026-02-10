-- Survey responses table for user satisfaction data collection
-- Stores ratings and optional comments from the report page survey bottom sheet

CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_survey_responses_result_id ON survey_responses(result_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_created ON survey_responses(created_at DESC);

-- Enable RLS
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Service role has full access (API route uses service role key)
DROP POLICY IF EXISTS "Service role full access on survey_responses" ON survey_responses;
CREATE POLICY "Service role full access on survey_responses" ON survey_responses
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE survey_responses IS 'User satisfaction survey responses collected from report page bottom sheet';
