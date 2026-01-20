-- ============================================
-- NoMoreAISlop Credits & Payments Migration
-- Version: 006 (Idempotent)
-- Description: Credit-based payment system
--   - Free users get 1 credit on signup
--   - Each "detailed report view" costs 1 credit
--   - Users can purchase more credits
-- ============================================

-- ============================================
-- ENUM TYPES
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_transaction_type') THEN
    CREATE TYPE credit_transaction_type AS ENUM ('signup_bonus', 'purchase', 'use', 'refund', 'admin_grant');
  END IF;
END $$;

-- ============================================
-- UPDATE USERS TABLE
-- Add credit-related columns
-- ============================================

-- Current credit balance (starts at 1 for new users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER NOT NULL DEFAULT 1 CHECK (credits >= 0);

-- Total credits ever used
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_credits_used INTEGER NOT NULL DEFAULT 0 CHECK (total_credits_used >= 0);

-- First time user made a purchase
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_paid_at TIMESTAMPTZ;

-- ============================================
-- PAYMENTS TABLE
-- Track all payment transactions from Polar
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who paid
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Polar integration
  polar_checkout_id TEXT NOT NULL UNIQUE,
  polar_customer_id TEXT,

  -- Payment details
  amount INTEGER NOT NULL CHECK (amount > 0),  -- in cents
  currency TEXT NOT NULL DEFAULT 'USD',

  -- What they got
  credits_purchased INTEGER NOT NULL CHECK (credits_purchased > 0),

  -- Status
  status payment_status NOT NULL DEFAULT 'pending',

  -- Optional: which result triggered this purchase
  result_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_polar_checkout ON payments(polar_checkout_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);

-- ============================================
-- CREDIT_TRANSACTIONS TABLE
-- Audit log for all credit changes
-- ============================================

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What type
  type credit_transaction_type NOT NULL,

  -- Amount (positive for gains, negative for usage)
  amount INTEGER NOT NULL,

  -- Running balance after this transaction
  balance_after INTEGER NOT NULL,

  -- References
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  result_id TEXT,  -- which report was unlocked

  -- Metadata
  description TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for credit_transactions
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_result ON credit_transactions(result_id) WHERE result_id IS NOT NULL;

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Use a credit to unlock a report
-- Returns: true if successful, false if insufficient credits
CREATE OR REPLACE FUNCTION use_credit_for_report(
  p_user_id UUID,
  p_result_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_credits INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Lock the user row and get current credits
  SELECT credits INTO v_current_credits
  FROM users
  WHERE id = p_user_id
  FOR UPDATE;

  -- Check if user exists and has credits
  IF v_current_credits IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_current_credits < 1 THEN
    RETURN FALSE;
  END IF;

  -- Check if already unlocked this report
  IF EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE user_id = p_user_id
      AND result_id = p_result_id
      AND type = 'use'
  ) THEN
    -- Already unlocked, return success without charging
    RETURN TRUE;
  END IF;

  -- Deduct credit
  v_new_balance := v_current_credits - 1;

  UPDATE users
  SET
    credits = v_new_balance,
    total_credits_used = total_credits_used + 1,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Record transaction
  INSERT INTO credit_transactions (
    user_id, type, amount, balance_after, result_id, description
  ) VALUES (
    p_user_id, 'use', -1, v_new_balance, p_result_id, 'Unlocked detailed report'
  );

  -- Update analysis_results to mark as paid
  UPDATE analysis_results
  SET is_paid = TRUE, paid_at = NOW()
  WHERE result_id = p_result_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add credits after purchase
CREATE OR REPLACE FUNCTION add_credits_from_purchase(
  p_user_id UUID,
  p_payment_id UUID,
  p_credits INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Lock and update user credits
  UPDATE users
  SET
    credits = credits + p_credits,
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

-- Check if user has unlocked a specific result
CREATE OR REPLACE FUNCTION has_unlocked_result(
  p_user_id UUID,
  p_result_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE user_id = p_user_id
      AND result_id = p_result_id
      AND type = 'use'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user credit info
CREATE OR REPLACE FUNCTION get_user_credit_info(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'credits', credits,
    'totalUsed', total_credits_used,
    'hasPaid', first_paid_at IS NOT NULL,
    'firstPaidAt', first_paid_at
  )
  INTO result
  FROM users
  WHERE id = p_user_id;

  RETURN COALESCE(result, json_build_object(
    'credits', 0,
    'totalUsed', 0,
    'hasPaid', false,
    'firstPaidAt', null
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Payments: users can read their own, service role full access
DROP POLICY IF EXISTS "Users can read own payments" ON payments;
CREATE POLICY "Users can read own payments" ON payments
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on payments" ON payments;
CREATE POLICY "Service role full access on payments" ON payments
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Credit transactions: users can read their own, service role full access
DROP POLICY IF EXISTS "Users can read own credit transactions" ON credit_transactions;
CREATE POLICY "Users can read own credit transactions" ON credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on credit_transactions" ON credit_transactions;
CREATE POLICY "Service role full access on credit_transactions" ON credit_transactions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE payments IS 'Payment transactions from Polar - tracks all credit purchases';
COMMENT ON TABLE credit_transactions IS 'Audit log of all credit changes - purchases, usage, refunds';
COMMENT ON COLUMN users.credits IS 'Current credit balance - starts at 1 (free signup bonus)';
COMMENT ON COLUMN users.total_credits_used IS 'Lifetime credits used to unlock reports';
COMMENT ON COLUMN users.first_paid_at IS 'First time user made a purchase - null for free-only users';

COMMENT ON FUNCTION use_credit_for_report IS 'Atomically use 1 credit to unlock a report. Returns false if insufficient credits.';
COMMENT ON FUNCTION add_credits_from_purchase IS 'Add credits to user after successful payment. Returns new balance.';
COMMENT ON FUNCTION has_unlocked_result IS 'Check if user has already unlocked a specific result.';
COMMENT ON FUNCTION get_user_credit_info IS 'Get user credit balance and payment status.';

-- ============================================
-- DONE! Migration 006 Complete (Idempotent)
-- ============================================
