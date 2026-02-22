-- ============================================
-- Expired Reports Cleanup Indexes
-- Version: 033
-- Description: Add indexes for efficient cleanup of expired reports.
-- ============================================

CREATE INDEX IF NOT EXISTS idx_analysis_results_expires_at
  ON analysis_results (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shared_reports_expires_at
  ON shared_reports (expires_at)
  WHERE expires_at IS NOT NULL;

