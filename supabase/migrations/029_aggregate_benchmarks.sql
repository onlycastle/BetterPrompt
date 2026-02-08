-- ============================================================================
-- Aggregate Benchmarks Migration
-- Version: 029 (Idempotent)
-- Description: Adds worker domain percentile columns to aggregate_stats,
--   and creates functions to calculate/refresh aggregate benchmarks
--   and compute per-user percentile rankings.
-- Dependencies: 002_freemium.sql (aggregate_stats table)
-- ============================================================================

-- ============================================================================
-- ADD WORKER DOMAIN PERCENTILE COLUMNS
-- These store percentile distributions for each Phase 2 worker domain score.
-- ============================================================================

ALTER TABLE aggregate_stats
  ADD COLUMN IF NOT EXISTS thinking_quality_percentiles JSONB DEFAULT '{}';

ALTER TABLE aggregate_stats
  ADD COLUMN IF NOT EXISTS communication_percentiles JSONB DEFAULT '{}';

ALTER TABLE aggregate_stats
  ADD COLUMN IF NOT EXISTS learning_behavior_percentiles JSONB DEFAULT '{}';

ALTER TABLE aggregate_stats
  ADD COLUMN IF NOT EXISTS context_efficiency_percentiles JSONB DEFAULT '{}';

ALTER TABLE aggregate_stats
  ADD COLUMN IF NOT EXISTS session_outcome_percentiles JSONB DEFAULT '{}';

-- ============================================================================
-- REFRESH AGGREGATE STATS FUNCTION
-- Calculates current month's stats from analysis_results.
-- Computes percentiles (p10, p25, p50, p75, p90, p95) for each domain score.
-- Uses UPSERT on period_start for idempotent monthly updates.
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_aggregate_stats()
RETURNS void AS $$
DECLARE
  v_period DATE := date_trunc('month', CURRENT_DATE)::DATE;
  v_total INTEGER;
  v_type_dist JSONB;
  v_thinking JSONB;
  v_communication JSONB;
  v_learning JSONB;
  v_context JSONB;
  v_session_outcome JSONB;
BEGIN
  -- Count total analyses for current month
  SELECT COUNT(*)
  INTO v_total
  FROM analysis_results
  WHERE created_at >= v_period
    AND created_at < (v_period + INTERVAL '1 month');

  -- If no data for this month, exit early (nothing to aggregate)
  IF v_total = 0 THEN
    RAISE NOTICE 'No analysis_results found for period %', v_period;
    RETURN;
  END IF;

  -- Calculate type distribution from evaluation->'primaryType'
  SELECT COALESCE(jsonb_object_agg(primary_type, type_count), '{}'::jsonb)
  INTO v_type_dist
  FROM (
    SELECT
      evaluation->>'primaryType' AS primary_type,
      COUNT(*) AS type_count
    FROM analysis_results
    WHERE created_at >= v_period
      AND created_at < (v_period + INTERVAL '1 month')
      AND evaluation->>'primaryType' IS NOT NULL
    GROUP BY evaluation->>'primaryType'
  ) t;

  -- Calculate percentiles for thinkingQuality domainScore
  SELECT jsonb_build_object(
    'p10', COALESCE(percentile_cont(0.10) WITHIN GROUP (ORDER BY score), 0),
    'p25', COALESCE(percentile_cont(0.25) WITHIN GROUP (ORDER BY score), 0),
    'p50', COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY score), 0),
    'p75', COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY score), 0),
    'p90', COALESCE(percentile_cont(0.90) WITHIN GROUP (ORDER BY score), 0),
    'p95', COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY score), 0),
    'count', COUNT(score)
  )
  INTO v_thinking
  FROM (
    SELECT (evaluation->'workerInsights'->'thinkingQuality'->>'domainScore')::numeric AS score
    FROM analysis_results
    WHERE created_at >= v_period
      AND created_at < (v_period + INTERVAL '1 month')
      AND evaluation->'workerInsights'->'thinkingQuality'->>'domainScore' IS NOT NULL
  ) s;

  -- Calculate percentiles for communicationPatterns domainScore
  SELECT jsonb_build_object(
    'p10', COALESCE(percentile_cont(0.10) WITHIN GROUP (ORDER BY score), 0),
    'p25', COALESCE(percentile_cont(0.25) WITHIN GROUP (ORDER BY score), 0),
    'p50', COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY score), 0),
    'p75', COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY score), 0),
    'p90', COALESCE(percentile_cont(0.90) WITHIN GROUP (ORDER BY score), 0),
    'p95', COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY score), 0),
    'count', COUNT(score)
  )
  INTO v_communication
  FROM (
    SELECT (evaluation->'workerInsights'->'communicationPatterns'->>'domainScore')::numeric AS score
    FROM analysis_results
    WHERE created_at >= v_period
      AND created_at < (v_period + INTERVAL '1 month')
      AND evaluation->'workerInsights'->'communicationPatterns'->>'domainScore' IS NOT NULL
  ) s;

  -- Calculate percentiles for learningBehavior domainScore
  SELECT jsonb_build_object(
    'p10', COALESCE(percentile_cont(0.10) WITHIN GROUP (ORDER BY score), 0),
    'p25', COALESCE(percentile_cont(0.25) WITHIN GROUP (ORDER BY score), 0),
    'p50', COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY score), 0),
    'p75', COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY score), 0),
    'p90', COALESCE(percentile_cont(0.90) WITHIN GROUP (ORDER BY score), 0),
    'p95', COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY score), 0),
    'count', COUNT(score)
  )
  INTO v_learning
  FROM (
    SELECT (evaluation->'workerInsights'->'learningBehavior'->>'domainScore')::numeric AS score
    FROM analysis_results
    WHERE created_at >= v_period
      AND created_at < (v_period + INTERVAL '1 month')
      AND evaluation->'workerInsights'->'learningBehavior'->>'domainScore' IS NOT NULL
  ) s;

  -- Calculate percentiles for contextEfficiency domainScore
  SELECT jsonb_build_object(
    'p10', COALESCE(percentile_cont(0.10) WITHIN GROUP (ORDER BY score), 0),
    'p25', COALESCE(percentile_cont(0.25) WITHIN GROUP (ORDER BY score), 0),
    'p50', COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY score), 0),
    'p75', COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY score), 0),
    'p90', COALESCE(percentile_cont(0.90) WITHIN GROUP (ORDER BY score), 0),
    'p95', COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY score), 0),
    'count', COUNT(score)
  )
  INTO v_context
  FROM (
    SELECT (evaluation->'workerInsights'->'contextEfficiency'->>'domainScore')::numeric AS score
    FROM analysis_results
    WHERE created_at >= v_period
      AND created_at < (v_period + INTERVAL '1 month')
      AND evaluation->'workerInsights'->'contextEfficiency'->>'domainScore' IS NOT NULL
  ) s;

  -- Calculate percentiles for sessionOutcome domainScore
  SELECT jsonb_build_object(
    'p10', COALESCE(percentile_cont(0.10) WITHIN GROUP (ORDER BY score), 0),
    'p25', COALESCE(percentile_cont(0.25) WITHIN GROUP (ORDER BY score), 0),
    'p50', COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY score), 0),
    'p75', COALESCE(percentile_cont(0.75) WITHIN GROUP (ORDER BY score), 0),
    'p90', COALESCE(percentile_cont(0.90) WITHIN GROUP (ORDER BY score), 0),
    'p95', COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY score), 0),
    'count', COUNT(score)
  )
  INTO v_session_outcome
  FROM (
    SELECT (evaluation->'workerInsights'->'sessionOutcome'->>'domainScore')::numeric AS score
    FROM analysis_results
    WHERE created_at >= v_period
      AND created_at < (v_period + INTERVAL '1 month')
      AND evaluation->'workerInsights'->'sessionOutcome'->>'domainScore' IS NOT NULL
  ) s;

  -- UPSERT into aggregate_stats
  INSERT INTO aggregate_stats (
    period_start,
    total_analyses,
    type_distribution,
    thinking_quality_percentiles,
    communication_percentiles,
    learning_behavior_percentiles,
    context_efficiency_percentiles,
    session_outcome_percentiles,
    updated_at
  )
  VALUES (
    v_period,
    v_total,
    v_type_dist,
    v_thinking,
    v_communication,
    v_learning,
    v_context,
    v_session_outcome,
    now()
  )
  ON CONFLICT (period_start) DO UPDATE SET
    total_analyses = EXCLUDED.total_analyses,
    type_distribution = EXCLUDED.type_distribution,
    thinking_quality_percentiles = EXCLUDED.thinking_quality_percentiles,
    communication_percentiles = EXCLUDED.communication_percentiles,
    learning_behavior_percentiles = EXCLUDED.learning_behavior_percentiles,
    context_efficiency_percentiles = EXCLUDED.context_efficiency_percentiles,
    session_outcome_percentiles = EXCLUDED.session_outcome_percentiles,
    updated_at = now();

  RAISE NOTICE 'Aggregate stats refreshed for period %: % analyses', v_period, v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION refresh_aggregate_stats IS
  'Recalculate monthly aggregate stats (type distribution, domain score percentiles) from analysis_results. Idempotent via UPSERT.';

-- ============================================================================
-- GET USER PERCENTILES FUNCTION
-- Returns the authenticated user's latest analysis scores alongside their
-- percentile rank within the current month's aggregate data.
--
-- SECURITY CONTRACT: This function uses SECURITY DEFINER to bypass RLS for
-- cross-user percentile rank calculations. Callers MUST authenticate the user
-- first and only pass the authenticated user's own ID. The API route
-- (/api/benchmarks/personal) enforces this via Supabase auth.getUser().
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_percentiles(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_period DATE := date_trunc('month', CURRENT_DATE)::DATE;
  v_user_eval JSONB;
  v_thinking_score NUMERIC;
  v_communication_score NUMERIC;
  v_learning_score NUMERIC;
  v_context_score NUMERIC;
  v_session_outcome_score NUMERIC;
  v_thinking_rank NUMERIC;
  v_communication_rank NUMERIC;
  v_learning_rank NUMERIC;
  v_context_rank NUMERIC;
  v_session_outcome_rank NUMERIC;
  v_total_in_period INTEGER;
BEGIN
  -- Get user's most recent evaluation
  SELECT evaluation
  INTO v_user_eval
  FROM analysis_results
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_eval IS NULL THEN
    RAISE EXCEPTION 'No analysis results found for user %', p_user_id;
  END IF;

  -- Extract domain scores from the user's evaluation
  v_thinking_score := (v_user_eval->'workerInsights'->'thinkingQuality'->>'domainScore')::numeric;
  v_communication_score := (v_user_eval->'workerInsights'->'communicationPatterns'->>'domainScore')::numeric;
  v_learning_score := (v_user_eval->'workerInsights'->'learningBehavior'->>'domainScore')::numeric;
  v_context_score := (v_user_eval->'workerInsights'->'contextEfficiency'->>'domainScore')::numeric;
  v_session_outcome_score := (v_user_eval->'workerInsights'->'sessionOutcome'->>'domainScore')::numeric;

  -- Count total analyses in current period for percentile calculation
  SELECT COUNT(*)
  INTO v_total_in_period
  FROM analysis_results
  WHERE created_at >= v_period
    AND created_at < (v_period + INTERVAL '1 month');

  -- Calculate percentile rank for each domain
  -- Percentile rank = (number of scores below user's score) / total * 100

  -- Thinking Quality percentile rank
  IF v_thinking_score IS NOT NULL THEN
    SELECT ROUND(
      COUNT(*) FILTER (
        WHERE (evaluation->'workerInsights'->'thinkingQuality'->>'domainScore')::numeric < v_thinking_score
      )::numeric / NULLIF(COUNT(*) FILTER (
        WHERE evaluation->'workerInsights'->'thinkingQuality'->>'domainScore' IS NOT NULL
      ), 0) * 100, 1
    )
    INTO v_thinking_rank
    FROM analysis_results
    WHERE created_at >= v_period
      AND created_at < (v_period + INTERVAL '1 month');
  END IF;

  -- Communication percentile rank
  IF v_communication_score IS NOT NULL THEN
    SELECT ROUND(
      COUNT(*) FILTER (
        WHERE (evaluation->'workerInsights'->'communicationPatterns'->>'domainScore')::numeric < v_communication_score
      )::numeric / NULLIF(COUNT(*) FILTER (
        WHERE evaluation->'workerInsights'->'communicationPatterns'->>'domainScore' IS NOT NULL
      ), 0) * 100, 1
    )
    INTO v_communication_rank
    FROM analysis_results
    WHERE created_at >= v_period
      AND created_at < (v_period + INTERVAL '1 month');
  END IF;

  -- Learning Behavior percentile rank
  IF v_learning_score IS NOT NULL THEN
    SELECT ROUND(
      COUNT(*) FILTER (
        WHERE (evaluation->'workerInsights'->'learningBehavior'->>'domainScore')::numeric < v_learning_score
      )::numeric / NULLIF(COUNT(*) FILTER (
        WHERE evaluation->'workerInsights'->'learningBehavior'->>'domainScore' IS NOT NULL
      ), 0) * 100, 1
    )
    INTO v_learning_rank
    FROM analysis_results
    WHERE created_at >= v_period
      AND created_at < (v_period + INTERVAL '1 month');
  END IF;

  -- Context Efficiency percentile rank
  IF v_context_score IS NOT NULL THEN
    SELECT ROUND(
      COUNT(*) FILTER (
        WHERE (evaluation->'workerInsights'->'contextEfficiency'->>'domainScore')::numeric < v_context_score
      )::numeric / NULLIF(COUNT(*) FILTER (
        WHERE evaluation->'workerInsights'->'contextEfficiency'->>'domainScore' IS NOT NULL
      ), 0) * 100, 1
    )
    INTO v_context_rank
    FROM analysis_results
    WHERE created_at >= v_period
      AND created_at < (v_period + INTERVAL '1 month');
  END IF;

  -- Session Outcome percentile rank
  IF v_session_outcome_score IS NOT NULL THEN
    SELECT ROUND(
      COUNT(*) FILTER (
        WHERE (evaluation->'workerInsights'->'sessionOutcome'->>'domainScore')::numeric < v_session_outcome_score
      )::numeric / NULLIF(COUNT(*) FILTER (
        WHERE evaluation->'workerInsights'->'sessionOutcome'->>'domainScore' IS NOT NULL
      ), 0) * 100, 1
    )
    INTO v_session_outcome_rank
    FROM analysis_results
    WHERE created_at >= v_period
      AND created_at < (v_period + INTERVAL '1 month');
  END IF;

  RETURN jsonb_build_object(
    'userId', p_user_id,
    'period', v_period,
    'totalAnalysesInPeriod', v_total_in_period,
    'scores', jsonb_build_object(
      'thinkingQuality', v_thinking_score,
      'communicationPatterns', v_communication_score,
      'learningBehavior', v_learning_score,
      'contextEfficiency', v_context_score,
      'sessionOutcome', v_session_outcome_score
    ),
    'percentileRanks', jsonb_build_object(
      'thinkingQuality', v_thinking_rank,
      'communicationPatterns', v_communication_rank,
      'learningBehavior', v_learning_rank,
      'contextEfficiency', v_context_rank,
      'sessionOutcome', v_session_outcome_rank
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_percentiles IS
  'Returns the user''s latest domain scores and their percentile rank within the current month''s analysis population.';

-- ============================================================================
-- AUTO-REFRESH TRIGGER
-- Calls refresh_aggregate_stats() when a new analysis result is inserted,
-- but only if the aggregate for this month hasn't been refreshed in the last
-- hour. This prevents expensive recomputation on every INSERT while keeping
-- benchmarks reasonably fresh.
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_refresh_aggregate_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_period DATE := date_trunc('month', CURRENT_DATE)::DATE;
  v_last_update TIMESTAMPTZ;
BEGIN
  -- Check when aggregate_stats was last updated for the current month
  SELECT updated_at
  INTO v_last_update
  FROM aggregate_stats
  WHERE period_start = v_period;

  -- Refresh if no data exists for this month, or if last update was > 1 hour ago
  IF v_last_update IS NULL OR v_last_update < (now() - INTERVAL '1 hour') THEN
    PERFORM refresh_aggregate_stats();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger idempotently
DROP TRIGGER IF EXISTS trg_refresh_aggregate_stats ON analysis_results;

CREATE TRIGGER trg_refresh_aggregate_stats
  AFTER INSERT ON analysis_results
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_aggregate_stats();

COMMENT ON FUNCTION trigger_refresh_aggregate_stats IS
  'Trigger function that refreshes aggregate_stats at most once per hour when new analysis results are inserted.';

-- ============================================================================
-- DONE! Migration 029 Complete (Idempotent)
-- ============================================================================
