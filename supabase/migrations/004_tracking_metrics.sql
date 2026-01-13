-- ============================================
-- NoMoreAISlop Tracking Metrics Migration
-- Version: 004 (Idempotent)
-- Description: Creates tracking_metrics table for PREMIUM tier daily metrics
-- Dependencies: 003_core_schema.sql (users table)
-- ============================================

-- ============================================
-- TRACKING_METRICS TABLE
-- Stores daily metrics for PREMIUM tier users
-- Referenced by: ITrackingRepository (src/application/ports/storage.ts:392-429)
-- ============================================

CREATE TABLE IF NOT EXISTS tracking_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner (required - only authenticated users get tracking)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Date key (YYYY-MM-DD)
  date DATE NOT NULL,

  -- Daily metrics
  sessions_analyzed INTEGER NOT NULL DEFAULT 0 CHECK (sessions_analyzed >= 0),
  average_score NUMERIC(5, 2) CHECK (average_score >= 0 AND average_score <= 100),

  -- Dimension scores (JSONB for flexibility)
  -- Schema: { aiCollaboration, promptEngineering, burnoutRisk, toolMastery, aiControl, skillResilience }
  dimension_scores JSONB DEFAULT '{}'::jsonb,

  -- Streak tracking (calculated by application)
  streak_days INTEGER NOT NULL DEFAULT 0 CHECK (streak_days >= 0),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  -- Unique constraint: one record per user per day
  UNIQUE (user_id, date)
);

-- ============================================
-- INDEXES
-- ============================================

-- Primary lookup: get metrics for a user
CREATE INDEX IF NOT EXISTS idx_tracking_user ON tracking_metrics(user_id);

-- Date range queries: get metrics between dates
CREATE INDEX IF NOT EXISTS idx_tracking_date ON tracking_metrics(date DESC);

-- Composite index for efficient date range queries per user
CREATE INDEX IF NOT EXISTS idx_tracking_user_date ON tracking_metrics(user_id, date DESC);

-- Score queries for leaderboards/analytics (if needed in future)
CREATE INDEX IF NOT EXISTS idx_tracking_avg_score ON tracking_metrics(average_score DESC NULLS LAST)
  WHERE average_score IS NOT NULL;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp trigger (using update_updated_at from 001_search_agent.sql)
DROP TRIGGER IF EXISTS trigger_tracking_metrics_updated_at ON tracking_metrics;
CREATE TRIGGER trigger_tracking_metrics_updated_at
  BEFORE UPDATE ON tracking_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Get user tracking summary
CREATE OR REPLACE FUNCTION get_user_tracking_summary(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'totalSessions', COALESCE(SUM(sessions_analyzed), 0),
    'avgScore', COALESCE(AVG(average_score), 0),
    'dimensionAverages', (
      SELECT json_build_object(
        'aiCollaboration', COALESCE(AVG((dimension_scores->>'aiCollaboration')::numeric), 0),
        'promptEngineering', COALESCE(AVG((dimension_scores->>'promptEngineering')::numeric), 0),
        'burnoutRisk', COALESCE(AVG((dimension_scores->>'burnoutRisk')::numeric), 0),
        'toolMastery', COALESCE(AVG((dimension_scores->>'toolMastery')::numeric), 0),
        'aiControl', COALESCE(AVG((dimension_scores->>'aiControl')::numeric), 0),
        'skillResilience', COALESCE(AVG((dimension_scores->>'skillResilience')::numeric), 0)
      )
      FROM tracking_metrics
      WHERE user_id = p_user_id
        AND dimension_scores IS NOT NULL
        AND dimension_scores != '{}'::jsonb
    ),
    'streak', COALESCE(MAX(streak_days), 0)
  )
  INTO result
  FROM tracking_metrics
  WHERE user_id = p_user_id;

  RETURN COALESCE(result, json_build_object(
    'totalSessions', 0,
    'avgScore', 0,
    'dimensionAverages', json_build_object(
      'aiCollaboration', 0,
      'promptEngineering', 0,
      'burnoutRisk', 0,
      'toolMastery', 0,
      'aiControl', 0,
      'skillResilience', 0
    ),
    'streak', 0
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Upsert daily metrics (insert or update today's metrics)
CREATE OR REPLACE FUNCTION upsert_daily_metrics(
  p_user_id UUID,
  p_date DATE,
  p_sessions INT,
  p_avg_score NUMERIC,
  p_dimension_scores JSONB
)
RETURNS void AS $$
BEGIN
  INSERT INTO tracking_metrics (
    user_id,
    date,
    sessions_analyzed,
    average_score,
    dimension_scores,
    created_at
  )
  VALUES (
    p_user_id,
    p_date,
    p_sessions,
    p_avg_score,
    p_dimension_scores,
    NOW()
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    sessions_analyzed = EXCLUDED.sessions_analyzed,
    average_score = EXCLUDED.average_score,
    dimension_scores = EXCLUDED.dimension_scores,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate streak for a user (called after inserting/updating metrics)
-- Counts consecutive days with sessions_analyzed > 0
CREATE OR REPLACE FUNCTION calculate_user_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  streak INTEGER := 0;
  current_date DATE := CURRENT_DATE;
  has_data BOOLEAN;
BEGIN
  -- Loop backwards from today until we find a gap
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM tracking_metrics
      WHERE user_id = p_user_id
        AND date = current_date
        AND sessions_analyzed > 0
    ) INTO has_data;

    IF NOT has_data THEN
      EXIT;
    END IF;

    streak := streak + 1;
    current_date := current_date - INTERVAL '1 day';
  END LOOP;

  RETURN streak;
END;
$$ LANGUAGE plpgsql;

-- Update streak for a user's most recent metric
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS void AS $$
DECLARE
  new_streak INTEGER;
BEGIN
  -- Calculate the current streak
  new_streak := calculate_user_streak(p_user_id);

  -- Update all recent metrics with the same streak
  -- (We update multiple rows to keep them in sync)
  UPDATE tracking_metrics
  SET streak_days = new_streak
  WHERE user_id = p_user_id
    AND date >= CURRENT_DATE - INTERVAL '90 days'; -- Only update recent data
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE tracking_metrics ENABLE ROW LEVEL SECURITY;

-- Users can read their own metrics
DROP POLICY IF EXISTS "Users can read own tracking metrics" ON tracking_metrics;
CREATE POLICY "Users can read own tracking metrics" ON tracking_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own metrics (application handles this)
DROP POLICY IF EXISTS "Users can insert own tracking metrics" ON tracking_metrics;
CREATE POLICY "Users can insert own tracking metrics" ON tracking_metrics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own metrics (for updateToday)
DROP POLICY IF EXISTS "Users can update own tracking metrics" ON tracking_metrics;
CREATE POLICY "Users can update own tracking metrics" ON tracking_metrics
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own metrics
DROP POLICY IF EXISTS "Users can delete own tracking metrics" ON tracking_metrics;
CREATE POLICY "Users can delete own tracking metrics" ON tracking_metrics
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role has full access (for admin operations)
DROP POLICY IF EXISTS "Service role full access on tracking_metrics" ON tracking_metrics;
CREATE POLICY "Service role full access on tracking_metrics" ON tracking_metrics
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE tracking_metrics IS 'Daily tracking metrics for PREMIUM tier users - sessions, scores, dimensions, streaks';
COMMENT ON COLUMN tracking_metrics.dimension_scores IS 'JSONB object with aiCollaboration, promptEngineering, burnoutRisk, toolMastery, aiControl, skillResilience scores';
COMMENT ON COLUMN tracking_metrics.streak_days IS 'Consecutive days with at least one session analyzed';

COMMENT ON FUNCTION get_user_tracking_summary IS 'Get aggregated tracking summary for a user - total sessions, avg score, dimension averages, streak';
COMMENT ON FUNCTION upsert_daily_metrics IS 'Insert or update daily metrics for a user (idempotent)';
COMMENT ON FUNCTION calculate_user_streak IS 'Calculate consecutive days streak for a user';
COMMENT ON FUNCTION update_user_streak IS 'Update streak_days for a user''s recent metrics';

-- ============================================
-- DONE! Migration 004 Complete (Idempotent)
-- ============================================
