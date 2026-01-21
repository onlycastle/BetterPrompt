-- Device Codes table for OAuth Device Flow (RFC 8628)
-- Used by CLI to authenticate users via browser-based OAuth

CREATE TABLE IF NOT EXISTS device_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_code TEXT NOT NULL UNIQUE,
  user_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'denied', 'used', 'expired')),
  user_id UUID REFERENCES auth.users(id),
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  authorized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_device_codes_device_code ON device_codes(device_code);
CREATE INDEX IF NOT EXISTS idx_device_codes_user_code ON device_codes(user_code);
CREATE INDEX IF NOT EXISTS idx_device_codes_expires_at ON device_codes(expires_at);

-- Enable RLS
ALTER TABLE device_codes ENABLE ROW LEVEL SECURITY;

-- Admin-only access (via service role key)
-- No direct user access needed since all operations go through API routes

-- Auto-cleanup expired codes after 1 hour
-- (This would be better as a cron job, but adding a comment for now)
-- COMMENT: Consider adding a pg_cron job to delete expired device_codes periodically
