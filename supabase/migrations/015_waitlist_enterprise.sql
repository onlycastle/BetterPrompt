-- Add enterprise_contact to waitlist source types
-- Fixes: ENTERPRISE form submissions failing due to CHECK constraint

-- The original constraint was defined inline on the column in 014_waitlist.sql:
--   source TEXT NOT NULL CHECK (source IN ('macos_app', 'pro_subscription'))
-- PostgreSQL auto-generates constraint name as: waitlist_source_check

ALTER TABLE waitlist
  DROP CONSTRAINT IF EXISTS waitlist_source_check,
  ADD CONSTRAINT waitlist_source_check
    CHECK (source IN ('macos_app', 'pro_subscription', 'enterprise_contact'));

-- Update table comment to reflect new source type
COMMENT ON TABLE waitlist IS 'Email signups for macOS app, PRO subscription, and enterprise contact requests';
