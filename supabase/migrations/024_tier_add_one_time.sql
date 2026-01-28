-- ============================================================================
-- Add 'one_time' to user_tier ENUM
-- Version: 024 (Idempotent)
-- Description: Adds 'one_time' tier for one-time credit purchases
--   - Part of 4-tier refactoring: free, one_time, pro, enterprise
--   - 'one_time' replaces 'paid' semantically (backfill in 025)
--   - PostgreSQL requires ENUM additions in separate transaction
-- ============================================================================

-- Add 'one_time' to user_tier ENUM (idempotent)
-- Position: after 'free', before 'paid'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'user_tier'::regtype AND enumlabel = 'one_time'
  ) THEN
    ALTER TYPE user_tier ADD VALUE 'one_time' AFTER 'free';
  END IF;
END $$;

-- ============================================================================
-- DONE! Migration 024 Complete (Idempotent)
-- ============================================================================
