/**
 * KB Credibility Signal — AC 9 Unit Tests
 *
 * Verifies that KB tip ranking incorporates source authority and credibility signal.
 *
 * Acceptance Criterion 9 (hard gate):
 *   - Source credibility tier (high/medium/standard) influences ranking
 *   - Source platform is used to infer credibility when explicit tier is absent
 *   - Explicit tier takes priority over platform-inferred tier
 *   - Higher-credibility sources rank above lower-credibility with equal keyword overlap
 *   - All matched items carry the resolved credibilityTier for downstream display
 *   - Professional insights receive 'medium' baseline credibility by default
 *   - Professional insights with explicit credibilityTier='high' get the 1.25x boost
 *
 * Evaluation criterion: source_credibility
 *   "KB tip source has demonstrated authority or practitioner credibility"
 *
 * Scale note:
 *   PortableKnowledgeItem.relevanceScore is expected in the 0-1 range.
 *   The scorer multiplies by 5 (giving baseScore 0-5), then adds tag overlap
 *   (0-3) and subCategory overlap (0-2) for a theoretical max of 10.
 *   Tests use 0-1 scale values to stay within the cap-free scoring range
 *   where credibility multipliers create meaningful differentiation.
 *
 * @module tests/unit/lib/kb-credibility-signal
 */

import { describe, it, expect } from 'vitest';
import {
  inferCredibilityTier,
  computeTagOverlap,
  matchKnowledgeResources,
} from '../../../packages/shared/src/matching/knowledge-resource-matcher.js';
import type {
  PortableKnowledgeItem,
  PortableProfessionalInsight,
  GrowthAreaInsight,
  MatchingContext,
} from '../../../packages/shared/src/matching/knowledge-resource-matcher.js';

// ============================================================================
// Test Helpers
// ============================================================================

/** Create a minimal growth area insight for testing. */
function buildGrowthAreaInsight(overrides: Partial<GrowthAreaInsight> = {}): GrowthAreaInsight {
  return {
    title: 'Untested Error Handling in Express Middleware',
    description: 'Catch blocks added to Express middleware without corresponding error path tests using jest.',
    recommendation: 'Write jest.spyOn tests before implementing catch blocks in Express middleware.',
    dimension: 'TrustVerification',
    ...overrides,
  };
}

/**
 * Create a minimal PortableKnowledgeItem for testing.
 *
 * IMPORTANT: relevanceScore uses 0-1 normalized scale.
 * The scorer multiplies by 5 → baseScore 0-5.
 * Using 0.6 gives baseScore=3.0, leaving room for credibility multiplier
 * to create meaningful differentiation without hitting the 10-cap.
 */
function buildKnowledgeItem(overrides: Partial<PortableKnowledgeItem> = {}): PortableKnowledgeItem {
  return {
    id: 'kb-test-item',
    title: 'Express Error Handling Best Practices',
    summary: 'Test error paths with jest before shipping middleware catch blocks.',
    sourceUrl: 'https://example.com/express-errors',
    sourceAuthor: 'Test Author',
    contentType: 'article',
    tags: ['express', 'error-handling', 'jest'],
    applicableDimensions: ['TrustVerification'],
    // 0-1 normalized: 0.6 * 5 = 3.0 baseScore + tags → ~6 preCredibility
    // Leaves headroom for multipliers (1.0x=6.0, 1.1x=6.6, 1.25x=7.5)
    relevanceScore: 0.6,
    ...overrides,
  };
}

/** Create a minimal MatchingContext with one dimension. */
function buildMatchingContext(
  dimension: string,
  growthAreas: GrowthAreaInsight[],
): MatchingContext {
  return {
    growthAreasByDimension: new Map([[dimension, growthAreas]]),
  };
}

// ============================================================================
// inferCredibilityTier — Unit Tests
// ============================================================================

describe('inferCredibilityTier', () => {
  describe('Explicit tier takes priority over platform inference', () => {
    it('returns explicit tier "high" regardless of platform', () => {
      expect(inferCredibilityTier('high', 'reddit')).toBe('high');
    });

    it('returns explicit tier "medium" regardless of platform', () => {
      expect(inferCredibilityTier('medium', 'twitter')).toBe('medium');
    });

    it('returns explicit tier "standard" when explicitly set', () => {
      expect(inferCredibilityTier('standard', 'web')).toBe('standard');
    });

    it('returns explicit tier "high" when no platform provided', () => {
      expect(inferCredibilityTier('high', undefined)).toBe('high');
    });
  });

  describe('Platform-based inference when no explicit tier', () => {
    it('infers "standard" for reddit (community content)', () => {
      expect(inferCredibilityTier(undefined, 'reddit')).toBe('standard');
    });

    it('infers "standard" for twitter (community/microblog)', () => {
      expect(inferCredibilityTier(undefined, 'twitter')).toBe('standard');
    });

    it('infers "standard" for threads (community platform)', () => {
      expect(inferCredibilityTier(undefined, 'threads')).toBe('standard');
    });

    it('infers "medium" for web (often official docs or curated)', () => {
      expect(inferCredibilityTier(undefined, 'web')).toBe('medium');
    });

    it('infers "medium" for manual (curated content)', () => {
      expect(inferCredibilityTier(undefined, 'manual')).toBe('medium');
    });

    it('infers "medium" for youtube (established practitioners)', () => {
      expect(inferCredibilityTier(undefined, 'youtube')).toBe('medium');
    });

    it('infers "medium" for linkedin (professional platform)', () => {
      expect(inferCredibilityTier(undefined, 'linkedin')).toBe('medium');
    });
  });

  describe('Fallback to "standard" when no tier and no recognized platform', () => {
    it('returns "standard" when both arguments are undefined', () => {
      expect(inferCredibilityTier(undefined, undefined)).toBe('standard');
    });

    it('returns "standard" for an unknown platform', () => {
      expect(inferCredibilityTier(undefined, 'discord')).toBe('standard');
    });

    it('returns "standard" for an empty string platform', () => {
      expect(inferCredibilityTier(undefined, '')).toBe('standard');
    });
  });
});

// ============================================================================
// matchKnowledgeResources — Credibility Ranking Tests
// ============================================================================

describe('matchKnowledgeResources — credibility signal in ranking', () => {
  const growthAreas = [buildGrowthAreaInsight()];
  const context = buildMatchingContext('TrustVerification', growthAreas);

  describe('AC 9.1: Higher credibility tier ranks above lower with equal base relevance', () => {
    it('ranks high-credibility item above standard-credibility with same relevanceScore and tags', () => {
      // Use 0.4 (0-1 scale): baseScore=2.0, with tag overlap ~2 → preCredibility~4
      // Standard: 4 * 1.0 = 4.0, High: 4 * 1.25 = 5.0 → differentiated
      const standardItem = buildKnowledgeItem({
        id: 'kb-standard',
        relevanceScore: 0.4,
        credibilityTier: 'standard',
        sourcePlatform: 'reddit',
        tags: ['express', 'error-handling'],
      });
      const highItem = buildKnowledgeItem({
        id: 'kb-high',
        relevanceScore: 0.4,  // identical base score
        credibilityTier: 'high',
        sourcePlatform: 'web',
        tags: ['express', 'error-handling'], // identical tags
      });

      const results = matchKnowledgeResources(context, [standardItem, highItem], []);
      const items = results[0]?.knowledgeItems ?? [];

      expect(items.length).toBe(2);
      // High-credibility item should rank first
      expect(items[0]?.id).toBe('kb-high');
      expect(items[1]?.id).toBe('kb-standard');
    });

    it('ranks high-credibility item above medium-credibility with same base score', () => {
      const mediumItem = buildKnowledgeItem({
        id: 'kb-medium',
        relevanceScore: 0.4,
        credibilityTier: 'medium',
        tags: ['express', 'jest'],
      });
      const highItem = buildKnowledgeItem({
        id: 'kb-high',
        relevanceScore: 0.4, // identical base score
        credibilityTier: 'high',
        tags: ['express', 'jest'], // identical tags
      });

      const results = matchKnowledgeResources(context, [mediumItem, highItem], []);
      const items = results[0]?.knowledgeItems ?? [];

      expect(items[0]?.id).toBe('kb-high');
    });

    it('ranks medium-credibility item above standard-credibility with same base score', () => {
      const standardItem = buildKnowledgeItem({
        id: 'kb-standard',
        relevanceScore: 0.4,
        credibilityTier: 'standard',
        tags: ['jest'],
      });
      const mediumItem = buildKnowledgeItem({
        id: 'kb-medium',
        relevanceScore: 0.4, // identical base score
        credibilityTier: 'medium',
        tags: ['jest'], // identical tags
      });

      const results = matchKnowledgeResources(context, [standardItem, mediumItem], []);
      const items = results[0]?.knowledgeItems ?? [];

      expect(items[0]?.id).toBe('kb-medium');
    });
  });

  describe('AC 9.2: Credibility tier carried through to MatchedKnowledgeItem', () => {
    it('carries explicit credibilityTier "high" to the matched result', () => {
      const item = buildKnowledgeItem({ credibilityTier: 'high', sourcePlatform: 'web' });
      const results = matchKnowledgeResources(context, [item], []);
      const matched = results[0]?.knowledgeItems[0];

      expect(matched?.credibilityTier).toBe('high');
    });

    it('carries explicit credibilityTier "standard" to the matched result', () => {
      const item = buildKnowledgeItem({ credibilityTier: 'standard', sourcePlatform: 'reddit' });
      const results = matchKnowledgeResources(context, [item], []);
      const matched = results[0]?.knowledgeItems[0];

      expect(matched?.credibilityTier).toBe('standard');
    });

    it('infers credibilityTier from platform when explicit tier is absent', () => {
      const item = buildKnowledgeItem({
        credibilityTier: undefined,
        sourcePlatform: 'youtube', // should infer 'medium'
      });
      const results = matchKnowledgeResources(context, [item], []);
      const matched = results[0]?.knowledgeItems[0];

      expect(matched?.credibilityTier).toBe('medium');
    });

    it('infers "standard" when neither tier nor recognized platform is present', () => {
      const item = buildKnowledgeItem({
        credibilityTier: undefined,
        sourcePlatform: undefined,
      });
      const results = matchKnowledgeResources(context, [item], []);
      const matched = results[0]?.knowledgeItems[0];

      expect(matched?.credibilityTier).toBe('standard');
    });

    it('carries sourcePlatform through to matched result', () => {
      const item = buildKnowledgeItem({ sourcePlatform: 'linkedin', credibilityTier: 'medium' });
      const results = matchKnowledgeResources(context, [item], []);
      const matched = results[0]?.knowledgeItems[0];

      expect(matched?.sourcePlatform).toBe('linkedin');
    });
  });

  describe('AC 9.3: Platform-inferred credibility influences ranking', () => {
    it('web-sourced item outranks reddit-sourced item with equal base score', () => {
      // No explicit credibilityTier — both use platform inference
      // reddit → 'standard' (1.0x), web → 'medium' (1.1x)
      const redditItem = buildKnowledgeItem({
        id: 'kb-reddit',
        relevanceScore: 0.4,
        credibilityTier: undefined, // will infer 'standard' from reddit
        sourcePlatform: 'reddit',
        tags: ['express', 'jest'],
      });
      const webItem = buildKnowledgeItem({
        id: 'kb-web',
        relevanceScore: 0.4, // same base score
        credibilityTier: undefined, // will infer 'medium' from web
        sourcePlatform: 'web',
        tags: ['express', 'jest'], // same tags
      });

      const results = matchKnowledgeResources(context, [redditItem, webItem], []);
      const items = results[0]?.knowledgeItems ?? [];

      // web (inferred medium, 1.1x) should beat reddit (inferred standard, 1.0x)
      expect(items[0]?.id).toBe('kb-web');
      expect(items[0]?.credibilityTier).toBe('medium');
      expect(items[1]?.id).toBe('kb-reddit');
      expect(items[1]?.credibilityTier).toBe('standard');
    });
  });

  describe('AC 9.4: matchScore is strictly higher for higher credibility tier', () => {
    it('high-credibility item has strictly higher matchScore than standard with same inputs', () => {
      // Use relevanceScore=0.4 with zero-overlap tags to isolate credibility signal
      const standardItem = buildKnowledgeItem({
        id: 'kb-standard',
        relevanceScore: 0.4,
        credibilityTier: 'standard',
        tags: ['unrelated-tag-xyz'],
      });
      const highItem = buildKnowledgeItem({
        id: 'kb-high',
        relevanceScore: 0.4,   // same relevance
        credibilityTier: 'high',
        tags: ['unrelated-tag-xyz'],   // same tags (no overlap → tagScore=0)
      });

      const results = matchKnowledgeResources(context, [standardItem, highItem], []);
      const items = results[0]?.knowledgeItems ?? [];

      const highMatched = items.find(i => i.id === 'kb-high');
      const standardMatched = items.find(i => i.id === 'kb-standard');

      expect(highMatched).toBeDefined();
      expect(standardMatched).toBeDefined();
      // highItem: 0.4*5=2.0, tagScore=0, * 1.25 = 2.5
      // standardItem: 0.4*5=2.0, tagScore=0, * 1.0 = 2.0
      expect(highMatched!.matchScore).toBeGreaterThan(standardMatched!.matchScore);
    });

    it('medium-credibility item has strictly higher matchScore than standard', () => {
      const standardItem = buildKnowledgeItem({
        id: 'kb-standard',
        relevanceScore: 0.4,
        credibilityTier: 'standard',
        tags: ['unrelated-tag-xyz'],
      });
      const mediumItem = buildKnowledgeItem({
        id: 'kb-medium',
        relevanceScore: 0.4,
        credibilityTier: 'medium',
        tags: ['unrelated-tag-xyz'],
      });

      const results = matchKnowledgeResources(context, [standardItem, mediumItem], []);
      const items = results[0]?.knowledgeItems ?? [];

      const mediumMatched = items.find(i => i.id === 'kb-medium');
      const standardMatched = items.find(i => i.id === 'kb-standard');

      // mediumItem: 2.0 * 1.1 = 2.2
      // standardItem: 2.0 * 1.0 = 2.0
      expect(mediumMatched!.matchScore).toBeGreaterThan(standardMatched!.matchScore);
    });

    it('high > medium > standard in matchScore ordering with identical inputs', () => {
      const standard = buildKnowledgeItem({ id: 'std', relevanceScore: 0.4, credibilityTier: 'standard', tags: [] });
      const medium = buildKnowledgeItem({ id: 'med', relevanceScore: 0.4, credibilityTier: 'medium', tags: [] });
      const high = buildKnowledgeItem({ id: 'hgh', relevanceScore: 0.4, credibilityTier: 'high', tags: [] });

      const results = matchKnowledgeResources(context, [standard, medium, high], []);
      const items = results[0]?.knowledgeItems ?? [];

      const highMatched = items.find(i => i.id === 'hgh');
      const medMatched = items.find(i => i.id === 'med');
      const stdMatched = items.find(i => i.id === 'std');

      expect(highMatched!.matchScore).toBeGreaterThan(medMatched!.matchScore);
      expect(medMatched!.matchScore).toBeGreaterThan(stdMatched!.matchScore);
    });
  });
});

// ============================================================================
// Professional Insights — Credibility Baseline Tests
// ============================================================================

describe('matchKnowledgeResources — professional insight credibility baseline', () => {
  const growthAreas = [buildGrowthAreaInsight()];
  const context = buildMatchingContext('TrustVerification', growthAreas);

  /** Build a minimal professional insight. */
  function buildInsight(overrides: Partial<PortableProfessionalInsight> = {}): PortableProfessionalInsight {
    return {
      id: 'pi-test',
      title: 'Always Verify Error Paths in Express Middleware',
      keyTakeaway: 'Testing error paths prevents silent failures in production.',
      actionableAdvice: ['Write tests for every catch block before submitting PR.'],
      sourceAuthor: 'Kent C. Dodds',
      sourceUrl: 'https://kentcdodds.com/testing',
      category: 'testing',
      priority: 7,
      applicableDimensions: ['TrustVerification'],
      ...overrides,
    };
  }

  describe('AC 9.5: Professional insights default to "medium" baseline credibility', () => {
    it('matched professional insight has credibilityTier "medium" when no explicit tier', () => {
      const insight = buildInsight({ credibilityTier: undefined });
      const results = matchKnowledgeResources(context, [], [insight]);
      const matched = results[0]?.professionalInsights[0];

      expect(matched?.credibilityTier).toBe('medium');
    });

    it('matched professional insight with explicit "high" tier gets "high" credibility', () => {
      const insight = buildInsight({ credibilityTier: 'high' });
      const results = matchKnowledgeResources(context, [], [insight]);
      const matched = results[0]?.professionalInsights[0];

      expect(matched?.credibilityTier).toBe('high');
    });

    it('high-credibility insight has higher matchScore than default-credibility insight', () => {
      const defaultInsight = buildInsight({ id: 'pi-default', credibilityTier: undefined });
      const highInsight = buildInsight({ id: 'pi-high', credibilityTier: 'high' });

      const defaultResults = matchKnowledgeResources(context, [], [defaultInsight]);
      const highResults = matchKnowledgeResources(context, [], [highInsight]);

      const defaultScore = defaultResults[0]?.professionalInsights[0]?.matchScore ?? 0;
      const highScore = highResults[0]?.professionalInsights[0]?.matchScore ?? 0;

      // High credibility (1.25x) should produce a higher score than medium (1.1x)
      expect(highScore).toBeGreaterThan(defaultScore);
    });
  });

  describe('AC 9.6: Professional insights ranked by credibility-boosted score', () => {
    it('high-credibility insight ranked above medium-credibility with same priority', () => {
      const mediumInsight = buildInsight({
        id: 'pi-medium',
        priority: 7,
        credibilityTier: undefined, // defaults to 'medium'
      });
      const highInsight = buildInsight({
        id: 'pi-high',
        priority: 7, // same priority
        credibilityTier: 'high',
      });

      const results = matchKnowledgeResources(context, [], [mediumInsight, highInsight]);
      const insights = results[0]?.professionalInsights ?? [];

      expect(insights[0]?.id).toBe('pi-high');
    });
  });
});

// ============================================================================
// computeTagOverlap — Prerequisite for credibility scoring context
// ============================================================================

describe('computeTagOverlap — keyword foundation for credibility ranking', () => {
  const growthAreas = [buildGrowthAreaInsight()];

  it('returns 0 when tags array is empty', () => {
    expect(computeTagOverlap([], growthAreas)).toBe(0);
  });

  it('returns 0 when growth areas array is empty', () => {
    expect(computeTagOverlap(['express', 'jest'], [])).toBe(0);
  });

  it('counts matching tags up to 3 maximum', () => {
    const tags = ['express', 'jest', 'error-handling', 'middleware', 'testing'];
    const score = computeTagOverlap(tags, growthAreas);

    expect(score).toBeGreaterThanOrEqual(1);
    expect(score).toBeLessThanOrEqual(3); // max 3
  });

  it('does not exceed 3 even when all tags match', () => {
    const tags = ['express', 'jest', 'error', 'middleware', 'catch', 'testing'];
    const score = computeTagOverlap(tags, growthAreas);
    expect(score).toBeLessThanOrEqual(3);
  });

  it('handles hyphenated tags by matching the non-hyphenated form', () => {
    // 'error-handling' → matches 'error handling' in growth area title
    const score = computeTagOverlap(['error-handling'], growthAreas);
    expect(score).toBeGreaterThan(0); // 'error handling' appears in title
  });
});

// ============================================================================
// End-to-end: credibility signal survives full matchKnowledgeResources pipeline
// ============================================================================

describe('AC 9 End-to-End: credibility signal preserved through full pipeline', () => {
  it('official docs (high credibility) beat community posts (standard) in final ranking', () => {
    const communityItem = buildKnowledgeItem({
      id: 'kb-reddit-post',
      relevanceScore: 0.4,   // 0-1 normalized scale
      credibilityTier: 'standard',
      sourcePlatform: 'reddit',
      tags: ['express', 'jest'],
    });

    const officialDocsItem = buildKnowledgeItem({
      id: 'kb-official-docs',
      relevanceScore: 0.4, // same base relevance
      credibilityTier: 'high',
      sourcePlatform: 'web',
      tags: ['express', 'jest'], // same tags
    });

    const growthAreas = [buildGrowthAreaInsight()];
    const context = buildMatchingContext('TrustVerification', growthAreas);

    const results = matchKnowledgeResources(context, [communityItem, officialDocsItem], []);
    const items = results[0]?.knowledgeItems ?? [];

    expect(items.length).toBe(2);
    expect(items[0]?.id).toBe('kb-official-docs');
    expect(items[0]?.credibilityTier).toBe('high');
    expect(items[1]?.id).toBe('kb-reddit-post');
    expect(items[1]?.credibilityTier).toBe('standard');
  });

  it('matchScore strictly monotonic: high > medium > standard with same relevance', () => {
    // No tags (tagScore=0) to isolate credibility signal
    const standardItem = buildKnowledgeItem({
      id: 'kb-standard',
      relevanceScore: 0.4,
      credibilityTier: 'standard',
      tags: [],
    });
    const mediumItem = buildKnowledgeItem({
      id: 'kb-medium',
      relevanceScore: 0.4,
      credibilityTier: 'medium',
      tags: [],
    });
    const highItem = buildKnowledgeItem({
      id: 'kb-high',
      relevanceScore: 0.4,
      credibilityTier: 'high',
      tags: [],
    });

    const growthAreas = [buildGrowthAreaInsight()];
    const context = buildMatchingContext('TrustVerification', growthAreas);

    const results = matchKnowledgeResources(
      context,
      [standardItem, mediumItem, highItem],
      [],
    );
    const items = results[0]?.knowledgeItems ?? [];

    // Sort order: high > medium > standard
    expect(items[0]?.id).toBe('kb-high');
    expect(items[1]?.id).toBe('kb-medium');
    expect(items[2]?.id).toBe('kb-standard');

    // Verify score monotonicity
    expect(items[0]!.matchScore).toBeGreaterThan(items[1]!.matchScore);
    expect(items[1]!.matchScore).toBeGreaterThan(items[2]!.matchScore);
  });

  it('explicit "high" tier beats platform-inferred "medium" tier at same relevance', () => {
    const inferredMedium = buildKnowledgeItem({
      id: 'kb-inferred-medium',
      relevanceScore: 0.4,
      credibilityTier: undefined, // inferred as 'medium' from 'web'
      sourcePlatform: 'web',
      tags: [],
    });
    const explicitHigh = buildKnowledgeItem({
      id: 'kb-explicit-high',
      relevanceScore: 0.4,
      credibilityTier: 'high', // explicit beats inference
      sourcePlatform: 'reddit', // would infer 'standard' without explicit
      tags: [],
    });

    const growthAreas = [buildGrowthAreaInsight()];
    const context = buildMatchingContext('TrustVerification', growthAreas);

    const results = matchKnowledgeResources(context, [inferredMedium, explicitHigh], []);
    const items = results[0]?.knowledgeItems ?? [];

    // explicitHigh gets 'high' (not 'standard' from reddit) because explicit takes priority
    expect(items[0]?.id).toBe('kb-explicit-high');
    expect(items[0]?.credibilityTier).toBe('high');
    expect(items[1]?.credibilityTier).toBe('medium');
  });
});
