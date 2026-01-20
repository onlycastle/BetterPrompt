-- ============================================================================
-- Auth User Sync Trigger
-- ============================================================================
-- Automatically creates a row in public.users when a user signs up via Supabase Auth.
-- This ensures the credit system works immediately after registration.
-- ============================================================================

-- Function to handle new user creation
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
    1,  -- Default: 1 free credit on signup
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;  -- Prevent duplicates if user already exists

  RETURN NEW;
END;
$$;

-- Trigger that fires after a new user is created in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Backfill: Create public.users rows for existing auth.users
-- ============================================================================
-- This ensures any existing users get their public.users row with 1 free credit

INSERT INTO public.users (id, email, credits, created_at, updated_at)
SELECT
  au.id,
  au.email,
  1,  -- 1 free credit
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Grant necessary permissions
-- ============================================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, UPDATE ON public.users TO authenticated;
