-- Waitlist table for earlybird signups
-- Stores email registrations for macOS app and PRO subscription waitlists

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('macos_app', 'pro_subscription')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate signups for the same waitlist type
  UNIQUE (email, source)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_waitlist_source ON waitlist(source);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist(created_at DESC);

-- Enable RLS
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert (signup without authentication)
DROP POLICY IF EXISTS "Anyone can insert to waitlist" ON waitlist;
CREATE POLICY "Anyone can insert to waitlist" ON waitlist
  FOR INSERT
  WITH CHECK (true);

-- Service role has full access for admin queries
DROP POLICY IF EXISTS "Service role full access on waitlist" ON waitlist;
CREATE POLICY "Service role full access on waitlist" ON waitlist
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE waitlist IS 'Email signups for macOS app and PRO subscription earlybird lists';
