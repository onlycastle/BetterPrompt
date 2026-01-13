-- ============================================
-- NoMoreAISlop Knowledge Base Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- ENUM TYPES
-- ============================================

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

-- ============================================
-- KNOWLEDGE_ITEMS TABLE
-- ============================================

CREATE TABLE knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- For multi-tenancy (future)
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

  -- Source (JSONB for nested object)
  source JSONB NOT NULL,

  -- Relevance (JSONB for nested object)
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

-- Indexes for common queries
CREATE INDEX idx_knowledge_category ON knowledge_items(category);
CREATE INDEX idx_knowledge_status ON knowledge_items(status);
CREATE INDEX idx_knowledge_user ON knowledge_items(user_id);
CREATE INDEX idx_knowledge_created ON knowledge_items(created_at DESC);
CREATE INDEX idx_knowledge_source_url ON knowledge_items((source->>'url'));
CREATE INDEX idx_knowledge_source_platform ON knowledge_items((source->>'platform'));
CREATE INDEX idx_knowledge_relevance_score ON knowledge_items(((relevance->>'score')::numeric) DESC);

-- Full-text search index
CREATE INDEX idx_knowledge_fts ON knowledge_items
  USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, '')));

-- GIN index for tags array
CREATE INDEX idx_knowledge_tags ON knowledge_items USING gin(tags);

-- ============================================
-- INFLUENCERS TABLE
-- ============================================

CREATE TABLE influencers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- For multi-tenancy (future)
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),

  name TEXT NOT NULL,
  description TEXT,
  credibility_tier credibility_tier NOT NULL,

  -- Expertise topics
  expertise_topics TEXT[] NOT NULL DEFAULT '{}',

  -- Affiliation
  affiliation TEXT,

  -- Stats
  content_count INTEGER NOT NULL DEFAULT 0,

  -- Active flag
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

-- ============================================
-- INFLUENCER_IDENTIFIERS TABLE
-- ============================================

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

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_knowledge_updated_at
  BEFORE UPDATE ON knowledge_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_influencers_updated_at
  BEFORE UPDATE ON influencers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Increment influencer content count
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

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_identifiers ENABLE ROW LEVEL SECURITY;

-- Policies for knowledge_items
-- Public read access (for now)
CREATE POLICY "Public read access" ON knowledge_items
  FOR SELECT USING (true);

-- Service role can do everything (for server-side operations)
CREATE POLICY "Service role full access" ON knowledge_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can manage their own items
CREATE POLICY "Users can insert own items" ON knowledge_items
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own items" ON knowledge_items
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own items" ON knowledge_items
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Policies for influencers
CREATE POLICY "Public read access" ON influencers
  FOR SELECT USING (true);

CREATE POLICY "Service role full access" ON influencers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can manage own influencers" ON influencers
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR user_id IS NULL)
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policies for influencer_identifiers
CREATE POLICY "Public read access" ON influencer_identifiers
  FOR SELECT USING (true);

CREATE POLICY "Service role full access" ON influencer_identifiers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Manage via influencer ownership" ON influencer_identifiers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM influencers
      WHERE id = influencer_id AND (user_id = auth.uid() OR user_id IS NULL)
    )
  );

-- ============================================
-- DONE!
-- ============================================
