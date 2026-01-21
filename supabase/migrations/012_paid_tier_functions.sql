-- ============================================================================
-- Add 'paid' Tier Migration - Part 2: Functions & Backfill
-- ============================================================================
-- Version: 012 (Idempotent)
-- Description: Updates functions to use 'paid' tier and backfills existing users
--   - Requires migration 011 to be committed first (enum value must exist)
--   - Updates add_credits_from_purchase to set tier = 'paid'
--   - Updates can_user_analyze to handle 'paid' tier
--   - Backfills existing paid users (first_paid_at IS NOT NULL)
-- ============================================================================

-- ============================================================================
-- UPDATE add_credits_from_purchase FUNCTION
-- ============================================================================

-- Update function to also set tier = 'paid' when user makes a purchase
CREATE OR REPLACE FUNCTION add_credits_from_purchase(
  p_user_id UUID,
  p_payment_id UUID,
  p_credits INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Lock and update user credits + tier
  UPDATE users
  SET
    credits = credits + p_credits,
    -- Upgrade tier to 'paid' if currently 'free' (don't downgrade pro/premium/enterprise)
    tier = CASE WHEN tier = 'free' THEN 'paid'::user_tier ELSE tier END,
    first_paid_at = COALESCE(first_paid_at, NOW()),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING credits INTO v_new_balance;

  -- Record transaction
  INSERT INTO credit_transactions (
    user_id, type, amount, balance_after, payment_id, description
  ) VALUES (
    p_user_id, 'purchase', p_credits, v_new_balance, p_payment_id,
    'Purchased ' || p_credits || ' credits'
  );

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE can_user_analyze FUNCTION
-- ============================================================================

-- Update function to handle 'paid' tier (same limits as 'free' for now)
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
  -- 'paid' tier gets same limit as 'free' for now
  tier_limit := CASE user_record.tier
    WHEN 'free' THEN 3
    WHEN 'paid' THEN 3
    WHEN 'pro' THEN NULL
    WHEN 'premium' THEN NULL
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
-- BACKFILL EXISTING PAID USERS
-- ============================================================================

-- Upgrade existing users who have paid (first_paid_at IS NOT NULL) to 'paid' tier
-- Only upgrade from 'free' tier (don't affect pro/premium/enterprise)
UPDATE users
SET
  tier = 'paid'::user_tier,
  updated_at = NOW()
WHERE first_paid_at IS NOT NULL
  AND tier = 'free';

-- ============================================================================
-- UPDATE COMMENTS
-- ============================================================================

COMMENT ON FUNCTION add_credits_from_purchase IS 'Add credits to user after successful payment. Sets tier to paid if free. Returns new balance.';
COMMENT ON FUNCTION can_user_analyze IS 'Check if user can perform analysis based on tier limits. paid tier has same limits as free.';

-- ============================================================================
-- DONE! Migration 012 Complete (Idempotent)
-- ============================================================================
