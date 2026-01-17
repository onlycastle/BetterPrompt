-- Migration: Add user_id to analysis_results for result claiming
-- This allows anonymous CLI results to be claimed by users after login

-- Add user_id column (nullable for backward compatibility)
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add claimed_at timestamp to track when result was claimed
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

-- Add index for user lookups
CREATE INDEX IF NOT EXISTS idx_analysis_results_user_id
  ON analysis_results(user_id)
  WHERE user_id IS NOT NULL;

-- RLS policy: Users can read their own claimed results
CREATE POLICY "Users can read own claimed results"
  ON analysis_results
  FOR SELECT
  USING (
    user_id IS NULL  -- Public results (not claimed)
    OR auth.uid() = user_id  -- User's own claimed results
  );

-- RLS policy: Users can claim unclaimed results
CREATE POLICY "Users can claim unclaimed results"
  ON analysis_results
  FOR UPDATE
  USING (user_id IS NULL)  -- Only unclaimed results
  WITH CHECK (auth.uid() = user_id);  -- Can only claim to themselves

-- Enable RLS if not already enabled
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for API routes)
CREATE POLICY "Service role full access on analysis_results"
  ON analysis_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
