-- ============================================================================
-- Tier Backfill & Function Updates
-- Version: 025 (Idempotent)
-- Description: Migrates data and updates functions for 4-tier system
--   - Backfill: 'paid' -> 'one_time', 'premium' -> 'pro'
--   - Update can_user_analyze for 4-tier system
--   - Update add_credits_from_purchase for free -> one_time upgrade
--
-- 4-Tier System:
--   | Tier       | Analyses | Content Access | Description              |
--   |------------|----------|----------------|--------------------------|
--   | free       | 3/month  | Limited        | Free users               |
--   | one_time   | Unlimited| Full           | One-time credit purchase |
--   | pro        | Unlimited| Full           | Subscription users       |
--   | enterprise | Unlimited| Full           | Enterprise subscription  |
--
-- Note: Old tiers 'paid' and 'premium' remain in ENUM for backwards compat
--       but no new users should be assigned to them.
-- ============================================================================

-- ============================================================================
-- BACKFILL EXISTING DATA
-- ============================================================================

-- Migrate 'paid' tier users to 'one_time'
UPDATE users
SET
  tier = 'one_time'::user_tier,
  updated_at = NOW()
WHERE tier = 'paid';

-- Migrate 'premium' tier users to 'pro'
UPDATE users
SET
  tier = 'pro'::user_tier,
  updated_at = NOW()
WHERE tier = 'premium';

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

  -- 4-tier system limits (NULL = unlimited)
  -- Note: 'paid' and 'premium' are legacy tiers, treated same as their replacements
  tier_limit := CASE user_record.tier
    WHEN 'free' THEN 3
    WHEN 'one_time' THEN NULL   -- Unlimited for one-time purchasers
    WHEN 'paid' THEN NULL       -- Legacy: same as one_time
    WHEN 'pro' THEN NULL        -- Unlimited for pro subscribers
    WHEN 'premium' THEN NULL    -- Legacy: same as pro
    WHEN 'enterprise' THEN NULL -- Unlimited for enterprise
    ELSE 3                      -- Fallback: free tier limits
  END;

  -- Unlimited tiers always return true
  IF tier_limit IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN user_record.analyses_this_month < tier_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UPDATE add_credits_from_purchase FUNCTION
-- ============================================================================

-- Update function to upgrade free -> one_time (not 'paid')
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
    -- Upgrade tier to 'one_time' if currently 'free' (don't downgrade pro/enterprise)
    tier = CASE WHEN tier = 'free' THEN 'one_time'::user_tier ELSE tier END,
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
-- UPDATE COMMENTS
-- ============================================================================

COMMENT ON FUNCTION can_user_analyze IS
  '4-tier system: free=3/month, one_time/pro/enterprise=unlimited. Legacy paid/premium tiers treated as unlimited.';

COMMENT ON FUNCTION add_credits_from_purchase IS
  'Add credits after payment. Upgrades free users to one_time tier. Returns new balance.';

-- ============================================================================
-- DONE! Migration 025 Complete (Idempotent)
-- ============================================================================
