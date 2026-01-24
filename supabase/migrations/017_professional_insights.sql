-- Migration: Create professional_insights table
-- Migrates Professional Insights from hardcoded arrays to dedicated database table

-- ============================================================================
-- Enums
-- ============================================================================

-- Insight category enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insight_category') THEN
    CREATE TYPE insight_category AS ENUM ('diagnosis', 'trend', 'type-specific', 'tool');
  END IF;
END$$;

-- Insight source type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'insight_source_type') THEN
    CREATE TYPE insight_source_type AS ENUM ('x-post', 'arxiv', 'blog', 'research', 'official');
  END IF;
END$$;

-- ============================================================================
-- Table Definition
-- ============================================================================

CREATE TABLE IF NOT EXISTS professional_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL DEFAULT '1.0.0',

  -- Classification
  category insight_category NOT NULL,

  -- Content
  title TEXT NOT NULL,
  key_takeaway TEXT NOT NULL,
  actionable_advice TEXT[] NOT NULL DEFAULT '{}',

  -- Source attribution (JSONB for flexibility with engagement metrics)
  source JSONB NOT NULL,

  -- Applicability filters (arrays for multi-value matching)
  applicable_styles TEXT[] DEFAULT '{}',
  applicable_control_levels TEXT[] DEFAULT '{}',
  applicable_dimensions TEXT[] DEFAULT '{}',

  -- Score-based display conditions
  min_score INTEGER CHECK (min_score IS NULL OR (min_score >= 0 AND min_score <= 100)),
  max_score INTEGER CHECK (max_score IS NULL OR (max_score >= 0 AND max_score <= 100)),

  -- Metadata
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_score_range CHECK (
    (min_score IS NULL AND max_score IS NULL) OR
    (min_score IS NULL AND max_score IS NOT NULL) OR
    (min_score IS NOT NULL AND max_score IS NULL) OR
    (min_score <= max_score)
  ),
  CONSTRAINT title_length CHECK (char_length(title) >= 10 AND char_length(title) <= 3000),
  CONSTRAINT key_takeaway_length CHECK (char_length(key_takeaway) >= 20 AND char_length(key_takeaway) <= 3000)
);

-- ============================================================================
-- Indexes for common queries
-- ============================================================================

-- Index for enabled insights (most common query)
CREATE INDEX IF NOT EXISTS idx_professional_insights_enabled
  ON professional_insights (enabled)
  WHERE enabled = true;

-- Index for dimension-based filtering (GIN for array containment)
CREATE INDEX IF NOT EXISTS idx_professional_insights_dimensions
  ON professional_insights USING GIN (applicable_dimensions);

-- Index for style-based filtering
CREATE INDEX IF NOT EXISTS idx_professional_insights_styles
  ON professional_insights USING GIN (applicable_styles);

-- Index for control level filtering
CREATE INDEX IF NOT EXISTS idx_professional_insights_control_levels
  ON professional_insights USING GIN (applicable_control_levels);

-- Index for priority ordering
CREATE INDEX IF NOT EXISTS idx_professional_insights_priority
  ON professional_insights (priority DESC);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_professional_insights_category
  ON professional_insights (category);

-- Composite index for score-based queries
CREATE INDEX IF NOT EXISTS idx_professional_insights_score_range
  ON professional_insights (min_score, max_score)
  WHERE enabled = true;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE professional_insights ENABLE ROW LEVEL SECURITY;

-- Public read access for enabled insights (these are curated content, not user data)
CREATE POLICY "Anyone can read enabled insights"
  ON professional_insights
  FOR SELECT
  USING (enabled = true);

-- Service role can do anything (for admin management)
CREATE POLICY "Service role has full access"
  ON professional_insights
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_professional_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_professional_insights_updated_at ON professional_insights;

CREATE TRIGGER trigger_professional_insights_updated_at
  BEFORE UPDATE ON professional_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_professional_insights_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE professional_insights IS
  'Curated professional insights and tips for developers based on their analysis results';

COMMENT ON COLUMN professional_insights.category IS
  'Type of insight: diagnosis, trend, type-specific, or tool';

COMMENT ON COLUMN professional_insights.applicable_dimensions IS
  'Which analysis dimensions this insight applies to (e.g., skillResilience, aiControl)';

COMMENT ON COLUMN professional_insights.min_score IS
  'Show this insight only if dimension score >= this value (0-100)';

COMMENT ON COLUMN professional_insights.max_score IS
  'Show this insight only if dimension score <= this value (0-100)';

COMMENT ON COLUMN professional_insights.priority IS
  'Display priority (1-10), higher values shown first';

COMMENT ON COLUMN professional_insights.source IS
  'JSON object with type, url, author, and optional engagement metrics';
