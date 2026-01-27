-- Migration: Remove Phase 3 dimensions (iterationEfficiency, learningVelocity, scopeManagement)
-- These 3 dimensions were planned for Premium/Enterprise but never implemented.
-- This migration remaps all affected professional insights to the 6 active dimensions.
--
-- Remapping strategy:
--   iterationEfficiency → aiControl (iteration control) or toolMastery (tool optimization)
--   learningVelocity    → skillResilience (learning capability) or aiCollaboration (AI skills)
--   scopeManagement     → aiControl (boundary control), aiCollaboration (collaboration precision),
--                          or contextEngineering (context organization)
--
-- See plan for per-insight rationale.

-- ============================================================================
-- Step 1: Remap iterationEfficiency insights
-- ============================================================================

-- 'Iteration Efficiency Assessment' → aiControl (controlling iteration cycles)
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'iterationEfficiency') || ARRAY['aiControl']
WHERE id = 'a1b2c3d4-0014-4000-8000-000000000014'
  AND 'iterationEfficiency' = ANY(applicable_dimensions)
  AND NOT 'aiControl' = ANY(applicable_dimensions);

-- 'Targeted Refinement vs Shotgun Debugging' → aiControl (precise control over AI edits)
-- Already has aiCollaboration, replace iterationEfficiency with aiControl
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'iterationEfficiency') || ARRAY['aiControl']
WHERE id = 'a1b2c3d4-0017-4000-8000-000000000017'
  AND 'iterationEfficiency' = ANY(applicable_dimensions)
  AND NOT 'aiControl' = ANY(applicable_dimensions);

-- 'Cascade Pattern: Parallel AI Instances' → toolMastery (tool optimization strategy)
-- Already has toolMastery, just remove iterationEfficiency
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'iterationEfficiency')
WHERE id = 'a1b2c3d4-0022-4000-8000-000000000022'
  AND 'iterationEfficiency' = ANY(applicable_dimensions);

-- 'Fresh Sessions Outperform Continued Context' → contextEngineering (already has it)
-- Just remove iterationEfficiency
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'iterationEfficiency')
WHERE id = 'a1b2c3d4-0019-4000-8000-000000000019'
  AND 'iterationEfficiency' = ANY(applicable_dimensions);

-- '30% Faster Reviews: AI as First Reviewer' → toolMastery (tool efficiency)
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'iterationEfficiency') || ARRAY['toolMastery']
WHERE id = 'b1b2c3d4-0017-4000-8000-000000000017'
  AND 'iterationEfficiency' = ANY(applicable_dimensions)
  AND NOT 'toolMastery' = ANY(applicable_dimensions);

-- 'Stop Blindly Accepting' → aiControl (active verification)
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'iterationEfficiency') || ARRAY['aiControl']
WHERE id = 'b1b2c3d4-0018-4000-8000-000000000018'
  AND 'iterationEfficiency' = ANY(applicable_dimensions)
  AND NOT 'aiControl' = ANY(applicable_dimensions);

-- 'The Four-Phase Workflow' → aiCollaboration (structured workflow, already has it)
-- Just remove iterationEfficiency
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'iterationEfficiency')
WHERE id = 'b1b2c3d4-0022-4000-8000-000000000022'
  AND 'iterationEfficiency' = ANY(applicable_dimensions);

-- 'The 6-Phase Verification Loop Before Every PR' → aiControl (already has it)
-- Just remove iterationEfficiency
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'iterationEfficiency')
WHERE id = 'b1b2c3d4-0023-4000-8000-000000000023'
  AND 'iterationEfficiency' = ANY(applicable_dimensions);

-- 'Two Claudes Are Better Than One' → aiControl (already has it)
-- Just remove iterationEfficiency
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'iterationEfficiency')
WHERE id = 'b1b2c3d4-0024-4000-8000-000000000024'
  AND 'iterationEfficiency' = ANY(applicable_dimensions);

-- ============================================================================
-- Step 2: Remap learningVelocity insights
-- ============================================================================

-- 'Learning Velocity in AI-Assisted Development' → skillResilience (maintaining learning capability)
-- Already has skillResilience, just remove learningVelocity
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'learningVelocity')
WHERE id = 'a1b2c3d4-0015-4000-8000-000000000015'
  AND 'learningVelocity' = ANY(applicable_dimensions);

-- 'The "Why" Question Test' → skillResilience (knowledge independence)
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'learningVelocity') || ARRAY['skillResilience']
WHERE id = 'a1b2c3d4-0018-4000-8000-000000000018'
  AND 'learningVelocity' = ANY(applicable_dimensions)
  AND NOT 'skillResilience' = ANY(applicable_dimensions);

-- 'Fundamentals First' → skillResilience (foundational knowledge)
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'learningVelocity') || ARRAY['skillResilience']
WHERE id = 'b1b2c3d4-0011-4000-8000-000000000011'
  AND 'learningVelocity' = ANY(applicable_dimensions)
  AND NOT 'skillResilience' = ANY(applicable_dimensions);

-- 'The 56% AI Salary Premium' → aiCollaboration (AI collaboration skills)
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'learningVelocity') || ARRAY['aiCollaboration']
WHERE id = 'b1b2c3d4-0012-4000-8000-000000000012'
  AND 'learningVelocity' = ANY(applicable_dimensions)
  AND NOT 'aiCollaboration' = ANY(applicable_dimensions);

-- '12-Year Developer''s Confession' → skillResilience (already has it)
-- Just remove learningVelocity
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'learningVelocity')
WHERE id = 'b1b2c3d4-0013-4000-8000-000000000013'
  AND 'learningVelocity' = ANY(applicable_dimensions);

-- 'Junior Developer Trap' → skillResilience (already has it)
-- Just remove learningVelocity
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'learningVelocity')
WHERE id = 'b1b2c3d4-0014-4000-8000-000000000014'
  AND 'learningVelocity' = ANY(applicable_dimensions);

-- ============================================================================
-- Step 3: Remap scopeManagement insights
-- ============================================================================

-- 'Scope Management for AI Collaboration' → aiCollaboration (collaboration precision)
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'scopeManagement') || ARRAY['aiCollaboration']
WHERE id = 'a1b2c3d4-0016-4000-8000-000000000016'
  AND 'scopeManagement' = ANY(applicable_dimensions)
  AND NOT 'aiCollaboration' = ANY(applicable_dimensions);

-- 'Task Decomposition Pattern' → contextEngineering (context organization)
-- Already has aiCollaboration, replace scopeManagement with contextEngineering
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'scopeManagement') || ARRAY['contextEngineering']
WHERE id = 'a1b2c3d4-0020-4000-8000-000000000020'
  AND 'scopeManagement' = ANY(applicable_dimensions)
  AND NOT 'contextEngineering' = ANY(applicable_dimensions);

-- 'AI Enables Scope Creep' → aiControl (controlling boundaries)
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'scopeManagement') || ARRAY['aiControl']
WHERE id = 'b1b2c3d4-0007-4000-8000-000000000007'
  AND 'scopeManagement' = ANY(applicable_dimensions)
  AND NOT 'aiControl' = ANY(applicable_dimensions);

-- 'Technical Debt Bubble' → aiControl (security oversight)
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'scopeManagement') || ARRAY['aiControl']
WHERE id = 'b1b2c3d4-0008-4000-8000-000000000008'
  AND 'scopeManagement' = ANY(applicable_dimensions)
  AND NOT 'aiControl' = ANY(applicable_dimensions);

-- 'Production Codebases & Vibe Coding' → contextEngineering (codebase context awareness)
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'scopeManagement') || ARRAY['contextEngineering']
WHERE id = 'b1b2c3d4-0009-4000-8000-000000000009'
  AND 'scopeManagement' = ANY(applicable_dimensions)
  AND NOT 'contextEngineering' = ANY(applicable_dimensions);

-- 'Andrew Ng''s Warning' → aiControl (requirements verification)
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'scopeManagement') || ARRAY['aiControl']
WHERE id = 'b1b2c3d4-0010-4000-8000-000000000010'
  AND 'scopeManagement' = ANY(applicable_dimensions)
  AND NOT 'aiControl' = ANY(applicable_dimensions);

-- ============================================================================
-- Step 4: Catch-all cleanup - remove any remaining references
-- ============================================================================

-- Remove iterationEfficiency from any remaining rows
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'iterationEfficiency')
WHERE 'iterationEfficiency' = ANY(applicable_dimensions);

-- Remove learningVelocity from any remaining rows
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'learningVelocity')
WHERE 'learningVelocity' = ANY(applicable_dimensions);

-- Remove scopeManagement from any remaining rows
UPDATE professional_insights
SET applicable_dimensions = array_remove(applicable_dimensions, 'scopeManagement')
WHERE 'scopeManagement' = ANY(applicable_dimensions);

-- Also clean up knowledge_items table if it has these dimensions
UPDATE knowledge_items
SET applicable_dimensions = array_remove(applicable_dimensions, 'iterationEfficiency')
WHERE applicable_dimensions IS NOT NULL
  AND 'iterationEfficiency' = ANY(applicable_dimensions);

UPDATE knowledge_items
SET applicable_dimensions = array_remove(applicable_dimensions, 'learningVelocity')
WHERE applicable_dimensions IS NOT NULL
  AND 'learningVelocity' = ANY(applicable_dimensions);

UPDATE knowledge_items
SET applicable_dimensions = array_remove(applicable_dimensions, 'scopeManagement')
WHERE applicable_dimensions IS NOT NULL
  AND 'scopeManagement' = ANY(applicable_dimensions);

-- ============================================================================
-- Step 5: Verify no remaining references
-- ============================================================================

DO $$
DECLARE
  remaining_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM professional_insights
  WHERE 'iterationEfficiency' = ANY(applicable_dimensions)
     OR 'learningVelocity' = ANY(applicable_dimensions)
     OR 'scopeManagement' = ANY(applicable_dimensions);

  IF remaining_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % professional_insights still reference removed dimensions', remaining_count;
  END IF;

  RAISE NOTICE 'Migration complete: All Phase 3 dimensions removed from professional_insights';
END$$;
