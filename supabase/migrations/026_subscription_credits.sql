-- ============================================================================
-- Subscription Credits System
-- Version: 026 (Idempotent)
-- Description: Credit allocation for Pro/Enterprise subscriptions
--   - Pro subscription: 4 credits/month
--   - Enterprise subscription: 4 credits/month (+ team features)
--   - Monthly reset for subscription tiers
--
-- Subscription Model:
--   | Tier       | Credits/Month | Tier Upgrade |
--   |------------|---------------|--------------|
--   | one_time   | N/A (purchase)| free -> one_time |
--   | pro        | 4             | any -> pro       |
--   | enterprise | 4             | any -> enterprise|
--
-- Integration: Called by Polar webhook handlers when subscription activates/renews
-- ============================================================================

-- ============================================================================
-- ENUM: subscription_status
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'expired');
  END IF;
END $$;

-- ============================================================================
-- TABLE: subscriptions
-- Track active subscriptions for credit management
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Polar integration
  polar_subscription_id TEXT NOT NULL UNIQUE,
  polar_customer_id TEXT,
  polar_product_id TEXT,

  -- Subscription details
  tier user_tier NOT NULL CHECK (tier IN ('pro', 'enterprise')),
  status subscription_status NOT NULL DEFAULT 'active',

  -- Billing cycle
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,

  -- Credits for this period
  credits_per_period INTEGER NOT NULL DEFAULT 4,
  credits_granted_at TIMESTAMPTZ,  -- When credits were last granted

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_polar ON subscriptions(polar_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- FUNCTION: add_credits_from_subscription
-- Called when subscription activates or renews
-- ============================================================================

CREATE OR REPLACE FUNCTION add_credits_from_subscription(
  p_user_id UUID,
  p_polar_subscription_id TEXT,
  p_polar_customer_id TEXT,
  p_polar_product_id TEXT,
  p_tier user_tier,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_credits INTEGER DEFAULT 4
)
RETURNS INTEGER AS $$
DECLARE
  v_subscription_id UUID;
  v_new_balance INTEGER;
  v_existing_subscription RECORD;
BEGIN
  -- Validate tier is subscription tier
  IF p_tier NOT IN ('pro', 'enterprise') THEN
    RAISE EXCEPTION 'Invalid subscription tier: %. Must be pro or enterprise.', p_tier;
  END IF;

  -- Check for existing subscription
  SELECT id, credits_granted_at, current_period_start
  INTO v_existing_subscription
  FROM subscriptions
  WHERE polar_subscription_id = p_polar_subscription_id;

  IF v_existing_subscription.id IS NOT NULL THEN
    -- Update existing subscription
    -- Only grant credits if this is a new period (renewal)
    IF v_existing_subscription.current_period_start < p_period_start THEN
      -- New billing period - grant credits
      UPDATE subscriptions
      SET
        status = 'active',
        current_period_start = p_period_start,
        current_period_end = p_period_end,
        credits_granted_at = NOW(),
        updated_at = NOW()
      WHERE id = v_existing_subscription.id
      RETURNING id INTO v_subscription_id;

      -- Add credits to user
      UPDATE users
      SET
        credits = credits + p_credits,
        tier = p_tier,
        updated_at = NOW()
      WHERE id = p_user_id
      RETURNING credits INTO v_new_balance;

      -- Record credit transaction
      INSERT INTO credit_transactions (
        user_id, type, amount, balance_after, description
      ) VALUES (
        p_user_id, 'purchase', p_credits, v_new_balance,
        'Subscription renewal: ' || p_credits || ' credits (' || p_tier || ')'
      );
    ELSE
      -- Same period - just update status, don't double-grant credits
      UPDATE subscriptions
      SET
        status = 'active',
        updated_at = NOW()
      WHERE id = v_existing_subscription.id;

      SELECT credits INTO v_new_balance FROM users WHERE id = p_user_id;
    END IF;
  ELSE
    -- New subscription - create and grant credits
    INSERT INTO subscriptions (
      user_id, polar_subscription_id, polar_customer_id, polar_product_id,
      tier, status, current_period_start, current_period_end,
      credits_per_period, credits_granted_at
    ) VALUES (
      p_user_id, p_polar_subscription_id, p_polar_customer_id, p_polar_product_id,
      p_tier, 'active', p_period_start, p_period_end,
      p_credits, NOW()
    )
    RETURNING id INTO v_subscription_id;

    -- Upgrade user tier and add credits
    UPDATE users
    SET
      credits = credits + p_credits,
      tier = p_tier,
      first_paid_at = COALESCE(first_paid_at, NOW()),
      updated_at = NOW()
    WHERE id = p_user_id
    RETURNING credits INTO v_new_balance;

    -- Record credit transaction
    INSERT INTO credit_transactions (
      user_id, type, amount, balance_after, description
    ) VALUES (
      p_user_id, 'purchase', p_credits, v_new_balance,
      'New subscription: ' || p_credits || ' credits (' || p_tier || ')'
    );
  END IF;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: cancel_subscription
-- Called when subscription is cancelled
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_subscription(
  p_polar_subscription_id TEXT,
  p_downgrade_tier user_tier DEFAULT 'one_time'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_current_tier user_tier;
BEGIN
  -- Get user from subscription
  SELECT user_id INTO v_user_id
  FROM subscriptions
  WHERE polar_subscription_id = p_polar_subscription_id;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Mark subscription as cancelled
  UPDATE subscriptions
  SET
    status = 'cancelled',
    cancelled_at = NOW(),
    updated_at = NOW()
  WHERE polar_subscription_id = p_polar_subscription_id;

  -- Check if user has other active subscriptions
  IF NOT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = v_user_id
      AND status = 'active'
      AND polar_subscription_id != p_polar_subscription_id
  ) THEN
    -- No other active subscriptions - downgrade tier
    -- Keep 'one_time' if they've made one-time purchases, otherwise 'free'
    SELECT CASE
      WHEN first_paid_at IS NOT NULL THEN 'one_time'::user_tier
      ELSE 'free'::user_tier
    END INTO v_current_tier
    FROM users
    WHERE id = v_user_id;

    UPDATE users
    SET
      tier = COALESCE(v_current_tier, p_downgrade_tier),
      updated_at = NOW()
    WHERE id = v_user_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: get_user_subscription_info
-- Get subscription details for a user
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_subscription_info(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'hasActiveSubscription', EXISTS (
      SELECT 1 FROM subscriptions
      WHERE user_id = p_user_id AND status = 'active'
    ),
    'subscriptions', COALESCE(
      (
        SELECT json_agg(json_build_object(
          'id', id,
          'tier', tier,
          'status', status,
          'currentPeriodStart', current_period_start,
          'currentPeriodEnd', current_period_end,
          'creditsPerPeriod', credits_per_period
        ))
        FROM subscriptions
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
      ),
      '[]'::json
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
DROP POLICY IF EXISTS "Users can read own subscriptions" ON subscriptions;
CREATE POLICY "Users can read own subscriptions" ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role full access
DROP POLICY IF EXISTS "Service role full access on subscriptions" ON subscriptions;
CREATE POLICY "Service role full access on subscriptions" ON subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE subscriptions IS 'Tracks Pro/Enterprise subscriptions for credit allocation and billing cycle management';

COMMENT ON FUNCTION add_credits_from_subscription IS
  'Grant credits for subscription activation/renewal. Pro/Enterprise get 4 credits/month. Prevents double-granting in same period.';

COMMENT ON FUNCTION cancel_subscription IS
  'Cancel subscription and optionally downgrade tier. Preserves one_time tier if user has made purchases.';

COMMENT ON FUNCTION get_user_subscription_info IS
  'Get user subscription status and details for frontend display.';

-- ============================================================================
-- DONE! Migration 026 Complete (Idempotent)
-- ============================================================================
