-- ============================================
-- NoMoreAISlop Knowledge Dimension Unification Migration
-- Version: 016 (Idempotent)
-- Description: Adds applicable_dimensions and sub_categories to knowledge_items
--              for unified dimension system with Professional Insights
-- ============================================

-- ============================================
-- ADD NEW COLUMNS
-- ============================================

-- Add applicable_dimensions column (array of dimension names)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_items'
    AND column_name = 'applicable_dimensions'
  ) THEN
    ALTER TABLE knowledge_items
    ADD COLUMN applicable_dimensions TEXT[] DEFAULT '{}';
  END IF;
END $$;

-- Add sub_categories column (JSONB for dimension->keywords mapping)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_items'
    AND column_name = 'sub_categories'
  ) THEN
    ALTER TABLE knowledge_items
    ADD COLUMN sub_categories JSONB DEFAULT '{}';
  END IF;
END $$;

-- ============================================
-- MIGRATE EXISTING DATA
-- Map category -> applicable_dimensions
-- ============================================

UPDATE knowledge_items
SET applicable_dimensions = CASE category
  WHEN 'context-engineering' THEN ARRAY['contextEngineering']
  WHEN 'memory-management' THEN ARRAY['contextEngineering']
  WHEN 'prompt-engineering' THEN ARRAY['aiCollaboration']
  WHEN 'tool-use' THEN ARRAY['toolMastery']
  WHEN 'subagents' THEN ARRAY['toolMastery']
  WHEN 'claude-code-skills' THEN ARRAY['toolMastery']
  WHEN 'workflow-automation' THEN ARRAY['iterationEfficiency']
  WHEN 'best-practices' THEN ARRAY['skillResilience']
  WHEN 'other' THEN ARRAY['skillResilience']
  ELSE ARRAY['skillResilience']
END
WHERE applicable_dimensions = '{}' OR applicable_dimensions IS NULL;

-- ============================================
-- CREATE INDEXES FOR NEW COLUMNS
-- ============================================

-- GIN index for applicable_dimensions array searches
CREATE INDEX IF NOT EXISTS idx_knowledge_applicable_dimensions
ON knowledge_items USING gin(applicable_dimensions);

-- GIN index for sub_categories JSONB searches
CREATE INDEX IF NOT EXISTS idx_knowledge_sub_categories
ON knowledge_items USING gin(sub_categories);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN knowledge_items.applicable_dimensions IS
  'Array of dimension names this knowledge applies to (aligned with Professional Insights)';

COMMENT ON COLUMN knowledge_items.sub_categories IS
  'JSONB mapping dimension names to keyword arrays for search matching';

-- ============================================
-- NOTE: category column is NOT removed
-- It remains for backward compatibility during transition.
-- A future migration can drop it once all code is updated.
-- ============================================

-- ============================================
-- DONE! Migration 016 Complete (Idempotent)
-- ============================================
