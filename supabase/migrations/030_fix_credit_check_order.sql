-- Fix: Swap check order in use_credit_for_report
-- Previously checked credits BEFORE checking if already unlocked.
-- When webhook already unlocked the report (credits=0), the function
-- returned FALSE instead of TRUE, causing confusing behavior.
-- Now checks "already unlocked" first, then credit balance.

CREATE OR REPLACE FUNCTION use_credit_for_report(p_user_id UUID, p_result_id TEXT)
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

  -- Check if user exists
  IF v_current_credits IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if already unlocked this report FIRST (before credit balance)
  IF EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE user_id = p_user_id
      AND result_id = p_result_id
      AND type = 'use'
  ) THEN
    -- Already unlocked, return success without charging
    RETURN TRUE;
  END IF;

  -- Then check credits
  IF v_current_credits < 1 THEN
    RETURN FALSE;
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
