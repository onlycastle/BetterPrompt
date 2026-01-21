-- ============================================================================
-- Add 'paid' Tier Migration - Part 1: ENUM Only
-- ============================================================================
-- Version: 011 (Idempotent)
-- Description: Adds 'paid' tier to user_tier ENUM
--   - IMPORTANT: New enum values cannot be used in the same transaction
--   - This migration ONLY adds the enum value
--   - See migration 012 for function updates and backfill
-- ============================================================================

-- Add 'paid' value to user_tier ENUM after 'free'
-- This must be committed before the value can be used
DO $$
BEGIN
  -- Check if 'paid' already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_tier' AND e.enumlabel = 'paid'
  ) THEN
    -- Add 'paid' value after 'free'
    ALTER TYPE user_tier ADD VALUE 'paid' AFTER 'free';
  END IF;
END $$;

-- ============================================================================
-- DONE! Migration 011 Complete
-- Run migration 012 next for function updates and backfill
-- ============================================================================
