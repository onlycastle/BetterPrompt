# NoMoreAISlop - Database

> Version: 4.0.0 | Database: Supabase PostgreSQL

## Overview

The NoMoreAISlop database schema supports:
- **Core Analysis**: Session analysis with evaluation, type result, and dimensions
- **Search Agent**: Knowledge base and influencer management for assessment criteria
- **Freemium**: Licensing, usage tracking, and viral sharing
- **Enterprise**: Organizations, teams, and multi-tenancy

## Enum Types

### From Migration 001 (Search Agent)

```sql
-- Knowledge classification
CREATE TYPE topic_category AS ENUM (
  'context-engineering',
  'claude-code-skills',
  'subagents',
  'memory-management',
  'prompt-engineering',
  'tool-use',
  'workflow-automation',
  'best-practices',
  'other'
);

CREATE TYPE content_type AS ENUM (
  'technique',
  'pattern',
  'tool',
  'configuration',
  'insight',
  'example',
  'reference'
);

CREATE TYPE source_platform AS ENUM (
  'reddit',
  'twitter',
  'threads',
  'web',
  'manual',
  'youtube',
  'linkedin'
);

CREATE TYPE knowledge_status AS ENUM (
  'draft',
  'reviewed',
  'approved',
  'archived'
);

-- Influencer management
CREATE TYPE credibility_tier AS ENUM (
  'high',
  'medium',
  'standard'
);

CREATE TYPE influencer_platform AS ENUM (
  'twitter',
  'youtube',
  'linkedin',
  'github',
  'web',
  'reddit'
);
```

### From Migration 002 (Freemium)

```sql
-- Licensing
CREATE TYPE license_type AS ENUM ('one_time', 'pro', 'team');

CREATE TYPE license_status AS ENUM ('active', 'expired', 'revoked', 'cancelled');

-- Usage tracking
CREATE TYPE usage_action AS ENUM ('analysis', 'share', 'export', 'view');
```

### From Migration 003 (Core Schema)

```sql
-- User tiers
CREATE TYPE user_tier AS ENUM ('free', 'pro', 'premium', 'enterprise');

-- Team roles
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Organization tiers
CREATE TYPE organization_tier AS ENUM ('team', 'enterprise');
```

## Tables

### Migration 001: Search Agent

#### knowledge_items

Knowledge base entries with full-text search support.

```sql
CREATE TABLE knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenancy (future)
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),

  -- Content
  version TEXT NOT NULL DEFAULT '1.0.0',
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,

  -- Classification
  category topic_category NOT NULL,
  content_type content_type NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',

  -- Source (JSONB: platform, url, author, published_at, fetched_at)
  source JSONB NOT NULL,

  -- Relevance (JSONB: score, reasoning, keywords, audience)
  relevance JSONB NOT NULL,

  -- Status
  status knowledge_status NOT NULL DEFAULT 'draft',

  -- Relationships
  related_items UUID[] DEFAULT '{}',
  supersedes UUID REFERENCES knowledge_items(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_knowledge_category ON knowledge_items(category);
CREATE INDEX idx_knowledge_status ON knowledge_items(status);
CREATE INDEX idx_knowledge_user ON knowledge_items(user_id);
CREATE INDEX idx_knowledge_created ON knowledge_items(created_at DESC);
CREATE INDEX idx_knowledge_source_url ON knowledge_items((source->>'url'));
CREATE INDEX idx_knowledge_source_platform ON knowledge_items((source->>'platform'));
CREATE INDEX idx_knowledge_relevance_score ON knowledge_items(((relevance->>'score')::numeric) DESC);

-- Full-text search
CREATE INDEX idx_knowledge_fts ON knowledge_items
  USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, '')));

-- Tags array
CREATE INDEX idx_knowledge_tags ON knowledge_items USING gin(tags);
```

#### influencers

Influencer profiles for content attribution and discovery.

```sql
CREATE TABLE influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenancy (future)
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),

  -- Profile
  name TEXT NOT NULL,
  description TEXT,
  credibility_tier credibility_tier NOT NULL,

  -- Expertise
  expertise_topics TEXT[] NOT NULL DEFAULT '{}',
  affiliation TEXT,

  -- Stats
  content_count INTEGER NOT NULL DEFAULT 0,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  last_content_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_influencers_tier ON influencers(credibility_tier);
CREATE INDEX idx_influencers_active ON influencers(is_active);
CREATE INDEX idx_influencers_user ON influencers(user_id);
```

#### influencer_identifiers

Platform-specific handles for influencers.

```sql
CREATE TABLE influencer_identifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  platform influencer_platform NOT NULL,
  handle TEXT NOT NULL,
  profile_url TEXT,

  -- Unique constraint: one handle per platform per influencer
  UNIQUE (influencer_id, platform, handle)
);

-- Indexes
CREATE INDEX idx_influencer_ids_platform ON influencer_identifiers(platform, handle);
CREATE INDEX idx_influencer_ids_influencer ON influencer_identifiers(influencer_id);
```

### Migration 002: Freemium

#### shared_reports

Viral sharing of analysis reports with analytics.

```sql
CREATE TABLE shared_reports (
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

-- Indexes
CREATE INDEX idx_shared_reports_report_id ON shared_reports(report_id);
CREATE INDEX idx_shared_reports_token ON shared_reports(access_token);
CREATE INDEX idx_shared_reports_created ON shared_reports(created_at DESC);
CREATE INDEX idx_shared_reports_active ON shared_reports(is_active) WHERE is_active = true;
```

#### licenses

Freemium and pro subscription management.

```sql
CREATE TABLE licenses (
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

-- Indexes
CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_licenses_email ON licenses(email);
CREATE INDEX idx_licenses_stripe_customer ON licenses(stripe_customer_id);
CREATE INDEX idx_licenses_stripe_subscription ON licenses(stripe_subscription_id);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_type ON licenses(type);
```

#### license_activations

Track device activations per license.

```sql
CREATE TABLE license_activations (
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

-- Indexes
CREATE INDEX idx_activations_license ON license_activations(license_id);
CREATE INDEX idx_activations_device ON license_activations(device_fingerprint);
CREATE INDEX idx_activations_active ON license_activations(license_id)
  WHERE deactivated_at IS NULL;
```

#### usage_records

Track usage for rate limiting and analytics.

```sql
CREATE TABLE usage_records (
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

-- Unique constraint per entity, action, and period
CREATE UNIQUE INDEX idx_usage_unique_entity_action_period
  ON usage_records (COALESCE(license_id::text, device_fingerprint), action, period_start);

-- Indexes
CREATE INDEX idx_usage_license ON usage_records(license_id);
CREATE INDEX idx_usage_device ON usage_records(device_fingerprint);
CREATE INDEX idx_usage_period ON usage_records(period_start);
CREATE INDEX idx_usage_action ON usage_records(action);
```

#### free_usage

Track free tier usage by device (no license required).

```sql
CREATE TABLE free_usage (
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
CREATE INDEX idx_free_usage_period ON free_usage(period_start);
```

#### aggregate_stats

Anonymized stats for peer comparison (Pro feature).

```sql
CREATE TABLE aggregate_stats (
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
CREATE INDEX idx_aggregate_period ON aggregate_stats(period_start DESC);
```

#### analysis_history

Historical analysis data for Pro tier trends.

```sql
CREATE TABLE analysis_history (
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

-- Indexes
CREATE INDEX idx_history_license ON analysis_history(license_id);
CREATE INDEX idx_history_device ON analysis_history(device_fingerprint);
CREATE INDEX idx_history_date ON analysis_history(analyzed_at DESC);
CREATE INDEX idx_history_type ON analysis_history(primary_type);
```

### Migration 003: Core Schema

#### users

User profiles linked to Supabase Auth with tier-based access control.

```sql
CREATE TABLE users (
  -- Primary key linked to Supabase Auth
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Contact
  email TEXT UNIQUE NOT NULL,

  -- Subscription tier
  tier user_tier NOT NULL DEFAULT 'free',

  -- Usage tracking (for rate limiting)
  analyses_this_month INTEGER NOT NULL DEFAULT 0,
  analyses_reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', NOW()) + INTERVAL '1 month'),

  -- Organization membership (for enterprise tier)
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  team_ids UUID[] DEFAULT '{}',

  -- User preferences (JSONB: emailNotifications, weeklyDigest, publicProfile)
  settings JSONB NOT NULL DEFAULT '{
    "emailNotifications": true,
    "weeklyDigest": false,
    "publicProfile": false
  }'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tier ON users(tier);
CREATE INDEX idx_users_reset ON users(analyses_reset_at);
CREATE INDEX idx_users_org ON users(organization_id) WHERE organization_id IS NOT NULL;
```

#### analyses

Session analysis results with evaluation, type result, and dimensions.

```sql
CREATE TABLE analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner (nullable for anonymous/free tier analyses)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Session identification (unique key)
  session_id TEXT NOT NULL UNIQUE,

  -- Project context
  project_path TEXT,
  project_name TEXT,

  -- Analysis results (JSONB for flexibility)
  -- evaluation: Rating scores, clues, recommendations (required)
  evaluation JSONB NOT NULL,
  -- type_result: AI coding style classification (optional)
  type_result JSONB,
  -- dimensions: 6-dimension breakdown (optional)
  dimensions JSONB,

  -- Session metadata: durationSeconds, messageCount, toolCallCount, model
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_analyses_user ON analyses(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_analyses_session ON analyses(session_id);
CREATE INDEX idx_analyses_project ON analyses(project_name);
CREATE INDEX idx_analyses_created ON analyses(created_at DESC);
CREATE INDEX idx_analyses_user_month ON analyses(user_id, created_at)
  WHERE user_id IS NOT NULL;
```

#### organizations

Enterprise tier organizations for multi-tenancy.

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),

  -- Owner (references users)
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Subscription
  tier organization_tier NOT NULL DEFAULT 'team',

  -- Seat management
  max_seats INTEGER NOT NULL DEFAULT 5 CHECK (max_seats >= 1),
  used_seats INTEGER NOT NULL DEFAULT 0 CHECK (used_seats >= 0),

  -- Settings (JSONB: allowedDomains[], ssoEnabled, customKnowledgeBaseEnabled)
  settings JSONB NOT NULL DEFAULT '{
    "allowedDomains": [],
    "ssoEnabled": false,
    "customKnowledgeBaseEnabled": false
  }'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_orgs_slug ON organizations(slug);
CREATE INDEX idx_orgs_owner ON organizations(owner_id);
```

#### teams

Groups within organizations for team-based access.

```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent organization
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Team info
  name TEXT NOT NULL,
  description TEXT,

  -- Stats (maintained by trigger)
  member_count INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  -- Unique team name within organization
  UNIQUE (organization_id, name)
);

-- Indexes
CREATE INDEX idx_teams_org ON teams(organization_id);
```

#### team_members

Team membership with role-based permissions.

```sql
CREATE TABLE team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Role within the team
  role team_role NOT NULL DEFAULT 'member',

  -- When they joined
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite primary key
  PRIMARY KEY (team_id, user_id)
);

-- Indexes
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_role ON team_members(team_id, role);
```

## RPC Functions

### Shared Functions

#### update_updated_at()

Trigger function to automatically update `updated_at` timestamp.

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Applied to: knowledge_items, influencers, licenses, aggregate_stats,
--             users, analyses, organizations, teams
```

### From Migration 001 (Search Agent)

#### increment_influencer_content(influencer_uuid)

Atomic increment of influencer content count.

```sql
CREATE OR REPLACE FUNCTION increment_influencer_content(influencer_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE influencers
  SET
    content_count = content_count + 1,
    last_content_at = now()
  WHERE id = influencer_uuid;
END;
$$ LANGUAGE plpgsql;
```

### From Migration 002 (Freemium)

#### increment_report_views(report_uuid)

Increment view count for shared report.

```sql
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
```

#### increment_report_shares(report_uuid)

Increment share count for shared report.

```sql
CREATE OR REPLACE FUNCTION increment_report_shares(report_uuid TEXT)
RETURNS void AS $$
BEGIN
  UPDATE shared_reports
  SET share_count = share_count + 1
  WHERE report_id = report_uuid AND is_active = true;
END;
$$ LANGUAGE plpgsql;
```

#### check_and_increment_usage(...)

Check and increment usage with limit enforcement (returns true if within limits).

```sql
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
```

### From Migration 003 (Core Schema)

#### reset_monthly_analyses()

Batch reset analysis counts for all users whose reset date has passed.

```sql
CREATE OR REPLACE FUNCTION reset_monthly_analyses()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE users
  SET
    analyses_this_month = 0,
    analyses_reset_at = date_trunc('month', NOW()) + INTERVAL '1 month',
    updated_at = NOW()
  WHERE analyses_reset_at <= NOW();

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### reset_user_monthly_analyses(p_user_id)

Reset analysis count for a specific user.

```sql
CREATE OR REPLACE FUNCTION reset_user_monthly_analyses(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET
    analyses_this_month = 0,
    analyses_reset_at = date_trunc('month', NOW()) + INTERVAL '1 month',
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### increment_user_analysis_count(p_user_id)

Atomic increment of user analysis count (returns new count).

```sql
CREATE OR REPLACE FUNCTION increment_user_analysis_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE users
  SET
    analyses_this_month = analyses_this_month + 1,
    last_active_at = NOW(),
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING analyses_this_month INTO new_count;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### can_user_analyze(p_user_id)

Check if user can perform analysis based on tier limits.

```sql
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

  -- Get tier limit (NULL = unlimited)
  tier_limit := CASE user_record.tier
    WHEN 'free' THEN 3
    WHEN 'pro' THEN NULL
    WHEN 'premium' THEN NULL
    WHEN 'enterprise' THEN NULL
  END;

  -- Unlimited tiers always return true
  IF tier_limit IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN user_record.analyses_this_month < tier_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### update_team_member_count()

Trigger function to maintain team `member_count` on insert/delete.

```sql
CREATE OR REPLACE FUNCTION update_team_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE teams SET member_count = member_count + 1 WHERE id = NEW.team_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE teams SET member_count = member_count - 1 WHERE id = OLD.team_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
```

#### update_org_seat_count()

Trigger function to maintain organization `used_seats` when users join/leave.

```sql
CREATE OR REPLACE FUNCTION update_org_seat_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- User joined an organization
    IF OLD.organization_id IS NULL AND NEW.organization_id IS NOT NULL THEN
      UPDATE organizations
      SET used_seats = used_seats + 1
      WHERE id = NEW.organization_id;
    -- User left an organization
    ELSIF OLD.organization_id IS NOT NULL AND NEW.organization_id IS NULL THEN
      UPDATE organizations
      SET used_seats = used_seats - 1
      WHERE id = OLD.organization_id;
    -- User switched organizations
    ELSIF OLD.organization_id IS DISTINCT FROM NEW.organization_id THEN
      IF OLD.organization_id IS NOT NULL THEN
        UPDATE organizations
        SET used_seats = used_seats - 1
        WHERE id = OLD.organization_id;
      END IF;
      IF NEW.organization_id IS NOT NULL THEN
        UPDATE organizations
        SET used_seats = used_seats + 1
        WHERE id = NEW.organization_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

## Row Level Security (RLS) Policies

### Knowledge Items

```sql
-- Public read access
CREATE POLICY "Public read access" ON knowledge_items
  FOR SELECT USING (true);

-- Service role full access (for backend operations)
CREATE POLICY "Service role full access" ON knowledge_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can insert own items
CREATE POLICY "Users can insert own items" ON knowledge_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can update own items
CREATE POLICY "Users can update own items" ON knowledge_items
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete own items
CREATE POLICY "Users can delete own items" ON knowledge_items
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
```

### Influencers

```sql
-- Public read access
CREATE POLICY "Public read access" ON influencers
  FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service role full access" ON influencers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Users can manage own influencers
CREATE POLICY "Users can manage own influencers" ON influencers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
```

### Influencer Identifiers

```sql
-- Public read access
CREATE POLICY "Public read access" ON influencer_identifiers
  FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service role full access" ON influencer_identifiers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Manage via influencer ownership
CREATE POLICY "Manage via influencer ownership" ON influencer_identifiers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM influencers
      WHERE id = influencer_id AND (user_id = auth.uid() OR user_id IS NULL)
    )
  );
```

### Shared Reports

```sql
-- Public read active reports (for viral sharing)
CREATE POLICY "Public read active reports" ON shared_reports
  FOR SELECT USING (is_active = true);

-- Service role full access
CREATE POLICY "Service role full access" ON shared_reports
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Licenses, License Activations, Usage Records, Free Usage, Analysis History

All sensitive licensing and usage tables are **service role only**:

```sql
-- Example: Licenses
CREATE POLICY "Service role access only" ON licenses
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Same pattern applies to:
-- license_activations, usage_records, free_usage, analysis_history
```

### Aggregate Stats

```sql
-- Public read (anonymized data for peer comparison)
CREATE POLICY "Public read aggregate stats" ON aggregate_stats
  FOR SELECT USING (true);

-- Service role write
CREATE POLICY "Service role write" ON aggregate_stats
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Users

```sql
-- Users can read own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role full access
CREATE POLICY "Service role full access on users" ON users
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Analyses

```sql
-- Users can read own analyses
CREATE POLICY "Users can read own analyses" ON analyses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create own analyses (or anonymous)
CREATE POLICY "Users can create own analyses" ON analyses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can delete own analyses
CREATE POLICY "Users can delete own analyses" ON analyses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Team members can read team analyses
CREATE POLICY "Team members can read team analyses" ON analyses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm1
      JOIN team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid()
        AND tm2.user_id = analyses.user_id
    )
  );

-- Service role full access
CREATE POLICY "Service role full access on analyses" ON analyses
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Organizations

```sql
-- Org members can read own org
CREATE POLICY "Org members can read own org" ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.organization_id = organizations.id
    )
  );

-- Org owners can update own org
CREATE POLICY "Org owners can update own org" ON organizations
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Service role full access
CREATE POLICY "Service role full access on organizations" ON organizations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Teams

```sql
-- Team members can read own teams
CREATE POLICY "Team members can read own teams" ON teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
        AND team_members.user_id = auth.uid()
    )
  );

-- Org admins can manage teams
CREATE POLICY "Org admins can manage teams" ON teams
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = teams.organization_id
        AND organizations.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations
      WHERE organizations.id = teams.organization_id
        AND organizations.owner_id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service role full access on teams" ON teams
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Team Members

```sql
-- Team members can read own team members
CREATE POLICY "Team members can read own team members" ON team_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
        AND tm.user_id = auth.uid()
    )
  );

-- Team admins can manage members
CREATE POLICY "Team admins can manage members" ON team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'admin')
    )
  );

-- Service role full access
CREATE POLICY "Service role full access on team_members" ON team_members
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend (full access) |
| `SUPABASE_ANON_KEY` | Frontend (RLS enforced) |

## Setup

1. Create Supabase project
2. Run migrations from `/supabase/migrations/` in order:
   - `001_search_agent.sql`
   - `002_freemium.sql`
   - `003_core_schema.sql`
3. Verify Row Level Security is enabled
4. Set environment variables

## Table Summary

| Migration | Tables | Purpose |
|-----------|--------|---------|
| 001 | `knowledge_items`, `influencers`, `influencer_identifiers` | Knowledge base and influencer management |
| 002 | `shared_reports`, `licenses`, `license_activations`, `usage_records`, `free_usage`, `aggregate_stats`, `analysis_history` | Freemium licensing, usage tracking, viral sharing |
| 003 | `users`, `analyses`, `organizations`, `teams`, `team_members` | Core user management, analysis storage, enterprise multi-tenancy |

**Total: 15 tables across 3 migrations**
