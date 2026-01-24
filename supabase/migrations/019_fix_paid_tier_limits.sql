-- ============================================================================
-- Fix Paid Tier Limits Migration
-- Version: 019 (Idempotent)
-- Description: Updates can_user_analyze to give 'paid' tier unlimited analyses
--   - Previously: paid tier had 3/month (same as free)
--   - Now: paid tier has unlimited (NULL = no limit)
--   - Rationale: One-time purchase should provide unlimited access
-- ============================================================================

-- ============================================================================
-- UPDATE can_user_analyze FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION can_user_analyze(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_record RECORD;
  tier_limit INTEGER;
BEGIN
  SELECT tier, analyses_this_month, analyses_reset_at
  INTO user_record
  FROM users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Check if reset is needed first
  IF user_record.analyses_reset_at <= NOW() THEN
    PERFORM reset_user_monthly_analyses(p_user_id);
    RETURN TRUE;
  END IF;

  -- Get tier limit (NULL = unlimited)
  -- free: 3 analyses per month
  -- paid: unlimited (one-time purchase grants unlimited access)
  -- pro/premium/enterprise: unlimited
  tier_limit := CASE user_record.tier
    WHEN 'free' THEN 3
    WHEN 'paid' THEN NULL      -- Unlimited for paid users
    WHEN 'pro' THEN NULL       -- Unlimited for pro
    WHEN 'premium' THEN NULL   -- Unlimited for premium
    WHEN 'enterprise' THEN NULL
  END;

  -- Unlimited tiers always return true
  IF tier_limit IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN user_record.analyses_this_month < tier_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE COMMENT
-- ============================================================================

COMMENT ON FUNCTION can_user_analyze IS
  'Check if user can perform analysis. free=3/month, paid/pro/premium/enterprise=unlimited';

-- ============================================================================
-- DONE! Migration 019 Complete (Idempotent)
-- ============================================================================
