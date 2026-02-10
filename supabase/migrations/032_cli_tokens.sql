-- CLI Tokens table for long-lived CLI authentication
-- Replaces Supabase session token sharing (which expired due to refresh token rotation)
-- CLI gets opaque tokens (cli_<hex>) that are independently managed

CREATE TABLE IF NOT EXISTS cli_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash of the plaintext token
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Fast lookup by token hash (only active tokens)
CREATE INDEX IF NOT EXISTS idx_cli_tokens_hash_active
  ON cli_tokens(token_hash)
  WHERE revoked_at IS NULL;

-- Find all tokens for a user (for management/cleanup)
CREATE INDEX IF NOT EXISTS idx_cli_tokens_user_id
  ON cli_tokens(user_id);

-- Enable RLS
ALTER TABLE cli_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only view/manage their own tokens
CREATE POLICY "Users can view own CLI tokens"
  ON cli_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can revoke own CLI tokens"
  ON cli_tokens FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role (used by API routes) has full access via bypassing RLS
