-- ============================================================================
-- Drop Unused Analyses Table Migration
-- Version: 020 (Idempotent)
-- Description: Removes the unused 'analyses' table
--   - The 'analyses' table was created in 003_core_schema.sql but never used
--   - All actual analysis data is stored in 'analysis_results' table
--   - The analysis-repo.ts that referenced this table was never imported
--   - This cleanup reduces confusion and maintenance burden
-- ============================================================================

-- ============================================================================
-- DROP TRIGGERS FIRST (dependencies)
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_analyses_updated_at ON analyses;

-- ============================================================================
-- DROP RLS POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can create own analyses" ON analyses;
DROP POLICY IF EXISTS "Users can delete own analyses" ON analyses;
DROP POLICY IF EXISTS "Team members can read team analyses" ON analyses;
DROP POLICY IF EXISTS "Service role full access on analyses" ON analyses;

-- ============================================================================
-- DROP INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_analyses_user;
DROP INDEX IF EXISTS idx_analyses_session;
DROP INDEX IF EXISTS idx_analyses_project;
DROP INDEX IF EXISTS idx_analyses_created;
DROP INDEX IF EXISTS idx_analyses_user_month;

-- ============================================================================
-- DROP TABLE
-- ============================================================================

DROP TABLE IF EXISTS analyses;

-- ============================================================================
-- DONE! Migration 020 Complete (Idempotent)
-- ============================================================================
