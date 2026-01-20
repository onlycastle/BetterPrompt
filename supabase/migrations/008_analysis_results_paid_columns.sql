-- ============================================================================
-- Add is_paid and paid_at columns to analysis_results
-- ============================================================================
-- Required by the use_credit_for_report RPC function (from migration 006).
-- These columns track whether a report has been unlocked via credit or payment.
-- ============================================================================

-- Add is_paid column (boolean, defaults to false)
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT FALSE;

-- Add paid_at column (timestamp when report was unlocked)
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Create index for finding paid results efficiently
CREATE INDEX IF NOT EXISTS idx_analysis_results_is_paid
  ON analysis_results(is_paid)
  WHERE is_paid = TRUE;

-- ============================================================================
-- DONE! Migration 008 Complete
-- ============================================================================
