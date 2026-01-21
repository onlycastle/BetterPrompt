-- ============================================================================
-- Remove Signup Bonus Migration
-- ============================================================================
-- Version: 010 (Idempotent)
-- Description: Remove the free 1-credit signup bonus for new users
--   - New users now start with 0 credits
--   - Existing users keep their current credit balance
-- ============================================================================

-- ============================================================================
-- UPDATE DEFAULT VALUE
-- ============================================================================

-- Change default from 1 to 0 for new users
ALTER TABLE users ALTER COLUMN credits SET DEFAULT 0;

-- ============================================================================
-- UPDATE TRIGGER FUNCTION
-- ============================================================================

-- Update the handle_new_user function to give 0 credits instead of 1
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, credits, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    0,  -- No signup bonus: start with 0 credits
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;  -- Prevent duplicates if user already exists

  RETURN NEW;
END;
$$;

-- ============================================================================
-- UPDATE COMMENTS
-- ============================================================================

COMMENT ON COLUMN users.credits IS 'Current credit balance - starts at 0 (no signup bonus)';

-- ============================================================================
-- DONE! Migration 010 Complete (Idempotent)
-- ============================================================================
