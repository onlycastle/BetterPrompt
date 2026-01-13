-- ============================================
-- NoMoreAISlop Freemium Schema Migration
-- Version: 002 (Idempotent)
-- Description: Adds tables for sharing, licensing, and usage tracking
-- Dependencies: 001_search_agent.sql (update_updated_at function)
-- ============================================

-- ============================================
-- SHARED_REPORTS TABLE
-- For viral sharing of analysis reports
-- ============================================

CREATE TABLE IF NOT EXISTS shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Unique report identifier (short, URL-friendly)
  report_id TEXT UNIQUE NOT NULL,

  -- Access control
  access_token TEXT NOT NULL,

  -- Report data (denormalized for fast reads)
  type_result JSONB NOT NULL,
  dimensions JSONB,

  -- Session metadata
  session_id TEXT,
  session_duration_minutes INTEGER,
  message_count INTEGER,
  tool_call_count INTEGER,

  -- Analytics
  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ
);

-- Indexes for shared_reports
CREATE INDEX IF NOT EXISTS idx_shared_reports_report_id ON shared_reports(report_id);
CREATE INDEX IF NOT EXISTS idx_shared_reports_token ON shared_reports(access_token);
CREATE INDEX IF NOT EXISTS idx_shared_reports_created ON shared_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_reports_active ON shared_reports(is_active) WHERE is_active = true;

-- ============================================
-- ENUM TYPES (Idempotent)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'license_type') THEN
    CREATE TYPE license_type AS ENUM ('one_time', 'pro', 'team');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'license_status') THEN
    CREATE TYPE license_status AS ENUM ('active', 'expired', 'revoked', 'cancelled');
  END IF;
END $$;

-- ============================================
-- LICENSES TABLE
-- For freemium and pro subscription management
-- ============================================

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- License key (format: NOSLOP-{TYPE}-{RANDOM}-{CHECKSUM})
  license_key TEXT UNIQUE NOT NULL,

  -- Owner info
  email TEXT NOT NULL,

  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_payment_intent_id TEXT,

  -- License details
  type license_type NOT NULL,
  status license_status NOT NULL DEFAULT 'active',

  -- Activation tracking
  activations INTEGER DEFAULT 0,
  max_activations INTEGER DEFAULT 3,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

-- Indexes for licenses
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_stripe_customer ON licenses(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_licenses_stripe_subscription ON licenses(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_type ON licenses(type);

-- ============================================
-- LICENSE_ACTIVATIONS TABLE
-- Track device activations per license
-- ============================================

CREATE TABLE IF NOT EXISTS license_activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,

  -- Device identification
  device_fingerprint TEXT NOT NULL,
  device_name TEXT,
  device_os TEXT,

  -- Timestamps
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,

  -- Unique constraint: one activation per device per license
  UNIQUE (license_id, device_fingerprint)
);

-- Indexes for license_activations
CREATE INDEX IF NOT EXISTS idx_activations_license ON license_activations(license_id);
CREATE INDEX IF NOT EXISTS idx_activations_device ON license_activations(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_activations_active ON license_activations(license_id)
  WHERE deactivated_at IS NULL;

-- ============================================
-- USAGE_RECORDS TABLE
-- Track usage for rate limiting and analytics
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'usage_action') THEN
    CREATE TYPE usage_action AS ENUM ('analysis', 'share', 'export', 'view');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner (license or device)
  license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
  device_fingerprint TEXT,

  -- Usage details
  action usage_action NOT NULL,

  -- Period tracking (for monthly limits)
  period_start DATE NOT NULL,
  count INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint using expression (cannot be inside CREATE TABLE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_unique_entity_action_period
  ON usage_records (COALESCE(license_id::text, device_fingerprint), action, period_start);

-- Indexes for usage_records
CREATE INDEX IF NOT EXISTS idx_usage_license ON usage_records(license_id);
CREATE INDEX IF NOT EXISTS idx_usage_device ON usage_records(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_usage_period ON usage_records(period_start);
CREATE INDEX IF NOT EXISTS idx_usage_action ON usage_records(action);

-- ============================================
-- FREE_USAGE TABLE
-- Track free tier usage by device (no license)
-- ============================================

CREATE TABLE IF NOT EXISTS free_usage (
  device_fingerprint TEXT PRIMARY KEY,

  -- Monthly counters
  analyses_this_month INTEGER DEFAULT 0,
  shares_this_month INTEGER DEFAULT 0,

  -- Timestamps
  last_analysis_at TIMESTAMPTZ,
  last_share_at TIMESTAMPTZ,
  period_start DATE NOT NULL,

  -- First seen
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for period-based cleanup
CREATE INDEX IF NOT EXISTS idx_free_usage_period ON free_usage(period_start);

-- ============================================
-- AGGREGATE_STATS TABLE
-- For peer comparison (Pro feature)
-- ============================================

CREATE TABLE IF NOT EXISTS aggregate_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Period
  period_start DATE NOT NULL UNIQUE,

  -- Counts
  total_analyses INTEGER DEFAULT 0,
  total_shares INTEGER DEFAULT 0,

  -- Type distribution
  type_distribution JSONB DEFAULT '{}',

  -- Score percentiles (5th, 10th, 25th, 50th, 75th, 90th, 95th)
  ai_collaboration_percentiles JSONB DEFAULT '{}',
  prompt_score_percentiles JSONB DEFAULT '{}',
  tool_mastery_percentiles JSONB DEFAULT '{}',
  ai_control_percentiles JSONB DEFAULT '{}',
  skill_resilience_percentiles JSONB DEFAULT '{}',

  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for period lookup
CREATE INDEX IF NOT EXISTS idx_aggregate_period ON aggregate_stats(period_start DESC);

-- ============================================
-- ANALYSIS_HISTORY TABLE
-- For Pro tier historical trends
-- ============================================

CREATE TABLE IF NOT EXISTS analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
  device_fingerprint TEXT,

  -- Analysis data
  session_id TEXT NOT NULL,
  primary_type TEXT NOT NULL,
  distribution JSONB NOT NULL,
  dimensions JSONB,

  -- Reference to shared report (if shared)
  shared_report_id UUID REFERENCES shared_reports(id) ON DELETE SET NULL,

  -- Timestamps
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for analysis_history
CREATE INDEX IF NOT EXISTS idx_history_license ON analysis_history(license_id);
CREATE INDEX IF NOT EXISTS idx_history_device ON analysis_history(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_history_date ON analysis_history(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_type ON analysis_history(primary_type);

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Increment view count for shared report
CREATE OR REPLACE FUNCTION increment_report_views(report_uuid TEXT)
RETURNS void AS $$
BEGIN
  UPDATE shared_reports
  SET
    view_count = view_count + 1,
    last_viewed_at = now()
  WHERE report_id = report_uuid AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Increment share count for shared report
CREATE OR REPLACE FUNCTION increment_report_shares(report_uuid TEXT)
RETURNS void AS $$
BEGIN
  UPDATE shared_reports
  SET share_count = share_count + 1
  WHERE report_id = report_uuid AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Check and increment usage (returns true if within limits)
CREATE OR REPLACE FUNCTION check_and_increment_usage(
  p_license_id UUID,
  p_device_fingerprint TEXT,
  p_action usage_action,
  p_limit INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_period_start DATE := date_trunc('month', CURRENT_DATE)::DATE;
  v_current_count INTEGER;
  v_record_id UUID;
BEGIN
  -- Try to find existing record
  SELECT id, count INTO v_record_id, v_current_count
  FROM usage_records
  WHERE COALESCE(license_id::text, device_fingerprint) = COALESCE(p_license_id::text, p_device_fingerprint)
    AND action = p_action
    AND period_start = v_period_start;

  IF v_record_id IS NOT NULL THEN
    -- Update existing record
    UPDATE usage_records
    SET count = count + 1
    WHERE id = v_record_id
    RETURNING count INTO v_current_count;
  ELSE
    -- Insert new record
    INSERT INTO usage_records (license_id, device_fingerprint, action, period_start, count)
    VALUES (p_license_id, p_device_fingerprint, p_action, v_period_start, 1)
    RETURNING count INTO v_current_count;
  END IF;

  -- Check limit if specified
  IF p_limit IS NOT NULL AND v_current_count > p_limit THEN
    -- Rollback the increment
    UPDATE usage_records
    SET count = count - 1
    WHERE COALESCE(license_id::text, device_fingerprint) = COALESCE(p_license_id::text, p_device_fingerprint)
      AND action = p_action
      AND period_start = v_period_start;
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all new tables
ALTER TABLE shared_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE free_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregate_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;

-- Shared Reports: Public read (for sharing), service role write
DROP POLICY IF EXISTS "Public read active reports" ON shared_reports;
CREATE POLICY "Public read active reports" ON shared_reports
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Service role full access" ON shared_reports;
CREATE POLICY "Service role full access" ON shared_reports
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Licenses: Service role only (sensitive data)
DROP POLICY IF EXISTS "Service role access only" ON licenses;
CREATE POLICY "Service role access only" ON licenses
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- License Activations: Service role only
DROP POLICY IF EXISTS "Service role access only" ON license_activations;
CREATE POLICY "Service role access only" ON license_activations
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Usage Records: Service role only
DROP POLICY IF EXISTS "Service role access only" ON usage_records;
CREATE POLICY "Service role access only" ON usage_records
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Free Usage: Service role only
DROP POLICY IF EXISTS "Service role access only" ON free_usage;
CREATE POLICY "Service role access only" ON free_usage
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Aggregate Stats: Public read (anonymized), service role write
DROP POLICY IF EXISTS "Public read aggregate stats" ON aggregate_stats;
CREATE POLICY "Public read aggregate stats" ON aggregate_stats
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role write" ON aggregate_stats;
CREATE POLICY "Service role write" ON aggregate_stats
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Analysis History: Service role only (personal data)
DROP POLICY IF EXISTS "Service role access only" ON analysis_history;
CREATE POLICY "Service role access only" ON analysis_history
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp triggers (uses update_updated_at from 001_search_agent.sql)
DROP TRIGGER IF EXISTS trigger_licenses_updated_at ON licenses;
CREATE TRIGGER trigger_licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_aggregate_stats_updated_at ON aggregate_stats;
CREATE TRIGGER trigger_aggregate_stats_updated_at
  BEFORE UPDATE ON aggregate_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- DONE! Migration 002 Complete (Idempotent)
-- ============================================
