-- ============================================
-- NoMoreAISlop Core Schema Migration
-- Version: 003 (Idempotent)
-- Description: Creates users, analyses, and enterprise tables
-- Dependencies: 001_search_agent.sql (update_updated_at function)
-- ============================================

-- ============================================
-- ENUM TYPES (Idempotent with DO blocks)
-- ============================================

-- User subscription tiers (matches UserTier in src/domain/models/user.ts)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_tier') THEN
    CREATE TYPE user_tier AS ENUM ('free', 'pro', 'premium', 'enterprise');
  END IF;
END $$;

-- Team member roles (for enterprise features)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_role') THEN
    CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member', 'viewer');
  END IF;
END $$;

-- Organization tier (for enterprise)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_tier') THEN
    CREATE TYPE organization_tier AS ENUM ('team', 'enterprise');
  END IF;
END $$;

-- ============================================
-- USERS TABLE
-- Core user profile linked to Supabase Auth
-- Referenced by: user-repo.ts (UserRow interface)
-- ============================================

CREATE TABLE IF NOT EXISTS users (
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
  organization_id UUID,  -- FK added later after organizations table
  team_ids UUID[] DEFAULT '{}',

  -- User preferences (matches UserRow.settings in user-repo.ts)
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

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_reset ON users(analyses_reset_at);

-- ============================================
-- ANALYSES TABLE
-- Stores session analysis results
-- Referenced by: analysis-repo.ts (AnalysisRow interface)
-- ============================================

CREATE TABLE IF NOT EXISTS analyses (
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

-- Indexes for analyses
CREATE INDEX IF NOT EXISTS idx_analyses_user ON analyses(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analyses_session ON analyses(session_id);
CREATE INDEX IF NOT EXISTS idx_analyses_project ON analyses(project_name);
CREATE INDEX IF NOT EXISTS idx_analyses_created ON analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_user_month ON analyses(user_id, created_at)
  WHERE user_id IS NOT NULL;

-- ============================================
-- ORGANIZATIONS TABLE
-- For enterprise tier multi-tenancy
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9-]+$'),

  -- Owner (references users, but users FK to org is deferred)
  owner_id UUID NOT NULL,

  -- Subscription
  tier organization_tier NOT NULL DEFAULT 'team',

  -- Seat management
  max_seats INTEGER NOT NULL DEFAULT 5 CHECK (max_seats >= 1),
  used_seats INTEGER NOT NULL DEFAULT 0 CHECK (used_seats >= 0),

  -- Settings
  settings JSONB NOT NULL DEFAULT '{
    "allowedDomains": [],
    "ssoEnabled": false,
    "customKnowledgeBaseEnabled": false
  }'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Add foreign keys after both tables exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_organizations_owner'
  ) THEN
    ALTER TABLE organizations
      ADD CONSTRAINT fk_organizations_owner
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_organization'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT fk_users_organization
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for organizations
CREATE INDEX IF NOT EXISTS idx_orgs_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_orgs_owner ON organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id) WHERE organization_id IS NOT NULL;

-- ============================================
-- TEAMS TABLE
-- Groups within an organization
-- ============================================

CREATE TABLE IF NOT EXISTS teams (
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

-- Indexes for teams
CREATE INDEX IF NOT EXISTS idx_teams_org ON teams(organization_id);

-- ============================================
-- TEAM_MEMBERS TABLE
-- Junction table for team membership
-- Referenced by: analysis-repo.ts (findByTeam method)
-- ============================================

CREATE TABLE IF NOT EXISTS team_members (
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Role within the team
  role team_role NOT NULL DEFAULT 'member',

  -- When they joined
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Composite primary key
  PRIMARY KEY (team_id, user_id)
);

-- Indexes for team_members
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(team_id, role);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp triggers (using update_updated_at from 001_search_agent.sql)
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_analyses_updated_at ON analyses;
CREATE TRIGGER trigger_analyses_updated_at
  BEFORE UPDATE ON analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_organizations_updated_at ON organizations;
CREATE TRIGGER trigger_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_teams_updated_at ON teams;
CREATE TRIGGER trigger_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Update team member count (called after insert/delete on team_members)
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

DROP TRIGGER IF EXISTS trigger_team_member_count ON team_members;
CREATE TRIGGER trigger_team_member_count
  AFTER INSERT OR DELETE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_team_member_count();

-- Update organization seat count when users are added/removed
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

DROP TRIGGER IF EXISTS trigger_org_seat_count ON users;
CREATE TRIGGER trigger_org_seat_count
  AFTER UPDATE OF organization_id ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_org_seat_count();

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Reset monthly analyses for all users whose reset date has passed
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

-- Reset monthly analyses for a specific user (called from user-repo.ts)
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

-- Increment analysis count for a user (atomic operation)
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

-- Check if user can perform analysis (respects tier limits)
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

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS POLICIES
-- ============================================

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role has full access (for server-side operations)
DROP POLICY IF EXISTS "Service role full access on users" ON users;
CREATE POLICY "Service role full access on users" ON users
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- ANALYSES POLICIES
-- ============================================

-- Users can read their own analyses
DROP POLICY IF EXISTS "Users can read own analyses" ON analyses;
CREATE POLICY "Users can read own analyses" ON analyses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create analyses (linked to themselves or anonymous)
DROP POLICY IF EXISTS "Users can create own analyses" ON analyses;
CREATE POLICY "Users can create own analyses" ON analyses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can delete their own analyses
DROP POLICY IF EXISTS "Users can delete own analyses" ON analyses;
CREATE POLICY "Users can delete own analyses" ON analyses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Team members can read analyses from teammates
DROP POLICY IF EXISTS "Team members can read team analyses" ON analyses;
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
DROP POLICY IF EXISTS "Service role full access on analyses" ON analyses;
CREATE POLICY "Service role full access on analyses" ON analyses
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- ORGANIZATIONS POLICIES
-- ============================================

-- Org members can read their organization
DROP POLICY IF EXISTS "Org members can read own org" ON organizations;
CREATE POLICY "Org members can read own org" ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.organization_id = organizations.id
    )
  );

-- Org owners can update their organization
DROP POLICY IF EXISTS "Org owners can update own org" ON organizations;
CREATE POLICY "Org owners can update own org" ON organizations
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Service role full access
DROP POLICY IF EXISTS "Service role full access on organizations" ON organizations;
CREATE POLICY "Service role full access on organizations" ON organizations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- TEAMS POLICIES
-- ============================================

-- Team members can read their teams
DROP POLICY IF EXISTS "Team members can read own teams" ON teams;
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
DROP POLICY IF EXISTS "Org admins can manage teams" ON teams;
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
DROP POLICY IF EXISTS "Service role full access on teams" ON teams;
CREATE POLICY "Service role full access on teams" ON teams
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- TEAM_MEMBERS POLICIES
-- ============================================

-- Team members can read their team's members
DROP POLICY IF EXISTS "Team members can read own team members" ON team_members;
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
DROP POLICY IF EXISTS "Team admins can manage members" ON team_members;
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
DROP POLICY IF EXISTS "Service role full access on team_members" ON team_members;
CREATE POLICY "Service role full access on team_members" ON team_members
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE users IS 'User profiles linked to Supabase Auth with tier-based access control';
COMMENT ON TABLE analyses IS 'Session analysis results with evaluation, type result, and dimensions';
COMMENT ON TABLE organizations IS 'Enterprise tier organizations for multi-tenancy';
COMMENT ON TABLE teams IS 'Groups within organizations for team-based access';
COMMENT ON TABLE team_members IS 'Team membership with role-based permissions';

COMMENT ON FUNCTION reset_monthly_analyses IS 'Batch reset analysis counts for all users whose reset date has passed';
COMMENT ON FUNCTION reset_user_monthly_analyses IS 'Reset analysis count for a specific user';
COMMENT ON FUNCTION increment_user_analysis_count IS 'Atomic increment of user analysis count';
COMMENT ON FUNCTION can_user_analyze IS 'Check if user can perform analysis based on tier limits';
COMMENT ON FUNCTION update_team_member_count IS 'Trigger function to maintain team member_count';
COMMENT ON FUNCTION update_org_seat_count IS 'Trigger function to maintain organization used_seats';

-- ============================================
-- DONE! Migration 003 Complete (Idempotent)
-- ============================================
