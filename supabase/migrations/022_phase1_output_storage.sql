-- ============================================================================
-- Phase 1 Output Storage Migration
-- Version: 022 (Idempotent)
-- Description: Adds phase1_output column to analysis_results table
--   - Stores raw Phase1Output (developer utterances, AI responses, metrics)
--   - Enables post-hoc evidence auditing and re-generation
--   - Supports frontend display of original developer quotes
-- ============================================================================

-- Add phase1_output JSONB column (nullable for backward compatibility)
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS phase1_output JSONB;

-- Add comment explaining the column
COMMENT ON COLUMN analysis_results.phase1_output IS
  'Raw Phase 1 extraction output (developer utterances, AI responses, session metrics). Used for evidence auditing, re-generation, and frontend source tracking.';

-- ============================================================================
-- DONE! Migration 022 Complete (Idempotent)
-- ============================================================================
