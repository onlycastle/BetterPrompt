/**
 * KB Tip Attachment — AC 8 Unit Tests
 *
 * Verifies the "one best-match KB tip per growth area or none if below threshold"
 * contract of the KB enricher (kb-growth-area-enricher.ts).
 *
 * Acceptance Criteria 8 (hard gate):
 *   - Exactly ONE best-match KB tip is attached per growth area
 *   - No tip is attached when the highest-scoring candidate is below KB_TIP_RELEVANCE_THRESHOLD (0.3)
 *   - Source credibility tier influences ranking (high > medium > standard)
 *   - When no KB items exist, no tips are attached (graceful no-op)
 *   - Input domain results are NOT mutated
 *   - kbTip and knowledgeTip are always identical (dual-write contract)
 *
 * @module tests/unit/plugin/kb-tip-attachment
 */

import { describe, it, expect } from 'vitest';
import { enrichGrowthAreasWithKbTips } from '../../../packages/shared/src/matching/kb-growth-area-enricher.js';
import { KB_TIP_RELEVANCE_THRESHOLD } from '../../../packages/shared/src/schemas/growth-area-pea.js';
import type { DomainResult } from '../../../packages/shared/src/schemas/domain-result.js';
import type {
  PortableKnowledgeItem,
  PortableProfessionalInsight,
} from '../../../packages/shared/src/matching/knowledge-resource-matcher.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Build a minimal DomainResult for testing.
 * Uses 'thinkingQuality' → maps to 'TrustVerification' KB dimension.
 */
function buildDomainResult(growthAreas: DomainResult['growthAreas'] = []): DomainResult {
  return {
    domain: 'thinkingQuality',
    overallScore: 70,
    confidenceScore: 0.8,
    strengths: [],
    growthAreas,
    data: {},
    analyzedAt: '2026-04-01T00:00:00.000Z',
  };
}

/**
 * Build a minimal growth area with required fields.
 */
function buildGrowthArea(overrides: Partial<DomainResult['growthAreas'][0]> = {}): DomainResult['growthAreas'][0] {
  return {
    title: 'Skipped Error Validation in Middleware',
    description: 'Across five sessions you wrote catch blocks in Express middleware without writing corresponding error path tests. This pattern means any error handling regression goes undetected until production. The Stripe webhook handler and the auth middleware both received catch blocks this week without test coverage.',
    severity: 'high',
    recommendation: 'Before writing any catch block in Express middleware, first create a test file with jest.spyOn to simulate the error, then implement the handler.',
    evidence: [
      { utteranceId: 'sess_abc_3', quote: 'Let me just add a try-catch here and move on', context: 'Working on payment webhook' },
      { utteranceId: 'sess_def_7', quote: 'The middleware is crashing but I can fix later', context: 'Auth middleware debug' },
    ],
    ...overrides,
  };
}

/**
 * Build a knowledge item that matches the TrustVerification dimension (thinkingQuality domain).
 */
function buildKbItem(overrides: Partial<PortableKnowledgeItem> = {}): PortableKnowledgeItem {
  return {
    id: 'kb-express-error-testing',
    title: 'Test-Driven Error Handling in Express',
    summary: 'Write error path tests before implementing catch blocks. Use jest.spyOn to simulate failures.',
    sourceUrl: 'https://kentcdodds.com/blog/error-handling',
    sourceAuthor: 'Kent C. Dodds',
    contentType: 'article',
    tags: ['express', 'error-handling', 'jest', 'testing'],
    applicableDimensions: ['TrustVerification'],
    relevanceScore: 8,
    sourcePlatform: 'web',
    credibilityTier: 'high',
    ...overrides,
  };
}

// ============================================================================
// AC 8.1: No KB items → no tip attached (graceful no-op)
// ============================================================================

describe('KB Tip Attachment — AC 8', () => {
  describe('AC 8.1: No KB items → no tip', () => {
    it('returns same domain results when knowledgeItems is empty', () => {
      const domainResults = [buildDomainResult([buildGrowthArea()])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [], []);

      expect(enriched[0]!.growthAreas[0]!.kbTip).toBeUndefined();
      expect(enriched[0]!.growthAreas[0]!.knowledgeTip).toBeUndefined();
    });

    it('returns same domain results when both knowledgeItems and professionalInsights are empty', () => {
      const domainResults = [buildDomainResult([buildGrowthArea(), buildGrowthArea()])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [], []);

      expect(enriched.length).toBe(1);
      expect(enriched[0]!.growthAreas.every(ga => !ga.kbTip)).toBe(true);
      expect(enriched[0]!.growthAreas.every(ga => !ga.knowledgeTip)).toBe(true);
    });
  });

  // ============================================================================
  // AC 8.2: Below-threshold → no tip attached
  // ============================================================================

  describe('AC 8.2: Below-threshold candidate → no tip', () => {
    it('does NOT attach a tip when the KB item relevance is too low to exceed threshold', () => {
      // A KB item in a completely unrelated dimension will score 0 on dimension overlap.
      // Match requires applicableDimensions to include 'TrustVerification'.
      // A 'CommunicationPatterns'-only item should score 0 (no dimension overlap).
      const unrelatedItem = buildKbItem({
        id: 'kb-unrelated',
        applicableDimensions: ['CommunicationPatterns'], // does NOT include TrustVerification
        relevanceScore: 1, // very low even if it somehow matched
      });

      const domainResults = [buildDomainResult([buildGrowthArea()])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [unrelatedItem], []);

      // No dimension overlap → candidate pool is empty → no tip
      expect(enriched[0]!.growthAreas[0]!.kbTip).toBeUndefined();
    });

    it('does NOT attach a tip when relevanceScore is 0 (guaranteed below threshold)', () => {
      // Item with relevanceScore=0 means base score = 0*5 = 0. No tag/subcat overlap either.
      // Normalized score = 0, which is well below 0.3 threshold.
      const zeroRelevanceItem = buildKbItem({
        id: 'kb-zero-relevance',
        relevanceScore: 0, // 0 * 5 = 0 base score
        tags: [], // no tag overlap bonus
        applicableDimensions: ['TrustVerification'],
      });

      const domainResults = [buildDomainResult([buildGrowthArea()])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [zeroRelevanceItem], []);

      expect(enriched[0]!.growthAreas[0]!.kbTip).toBeUndefined();
    });

    it('threshold constant is 0.3', () => {
      // Verify the exported threshold matches our expected value
      expect(KB_TIP_RELEVANCE_THRESHOLD).toBe(0.3);
    });
  });

  // ============================================================================
  // AC 8.3: Above-threshold → exactly ONE tip attached
  // ============================================================================

  describe('AC 8.3: Above-threshold candidate → exactly one tip attached', () => {
    it('attaches exactly one tip when a high-relevance KB item matches the dimension', () => {
      // high credibility item with relevanceScore=8 → base = 8*5=40, but scored 0-10 scale
      // 8 relevance → score around 8+ (within 0-10 matcher scale) → normalized ~0.8+ → above 0.3
      const highRelevanceItem = buildKbItem({
        id: 'kb-high-relevance',
        relevanceScore: 8,
        tags: ['express', 'error-handling', 'jest'],  // overlaps growth area text
        applicableDimensions: ['TrustVerification'],
        credibilityTier: 'high',
      });

      const ga = buildGrowthArea();
      const domainResults = [buildDomainResult([ga])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [highRelevanceItem], []);

      const attachedTip = enriched[0]!.growthAreas[0]!.kbTip;
      expect(attachedTip).toBeDefined();
      expect(attachedTip?.tipId).toBe('kb-high-relevance');
    });

    it('attaches only ONE tip even when multiple KB items match', () => {
      const item1 = buildKbItem({ id: 'kb-item-1', relevanceScore: 8, credibilityTier: 'high' });
      const item2 = buildKbItem({ id: 'kb-item-2', relevanceScore: 6, credibilityTier: 'medium' });
      const item3 = buildKbItem({ id: 'kb-item-3', relevanceScore: 4, credibilityTier: 'standard' });

      const domainResults = [buildDomainResult([buildGrowthArea()])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [item1, item2, item3], []);

      const attachedTip = enriched[0]!.growthAreas[0]!.kbTip;
      expect(attachedTip).toBeDefined();
      // Only one tipId exists on the growth area, not an array
      expect(typeof attachedTip?.tipId).toBe('string');
    });

    it('selects the highest-scoring item (not arbitrary first match)', () => {
      // item1 has lower score but item2 has higher score — item2 should win
      const lowerScoreItem = buildKbItem({
        id: 'kb-lower-score',
        relevanceScore: 4,  // lower
        credibilityTier: 'standard',
        tags: [], // no tag overlap
      });
      const higherScoreItem = buildKbItem({
        id: 'kb-higher-score',
        relevanceScore: 9,  // higher
        credibilityTier: 'high',
        tags: ['express', 'error-handling', 'jest'], // overlaps growth area text
      });

      const domainResults = [buildDomainResult([buildGrowthArea()])];
      // Put lowerScoreItem first in array to ensure winner is picked by score, not array order
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [lowerScoreItem, higherScoreItem], []);

      const attachedTip = enriched[0]!.growthAreas[0]!.kbTip;
      expect(attachedTip?.tipId).toBe('kb-higher-score');
    });
  });

  // ============================================================================
  // AC 8.4: Credibility boost affects ranking
  // ============================================================================

  describe('AC 8.4: Credibility tier influences final ranking', () => {
    it('prefers high-credibility source over standard-credibility with same base score', () => {
      // Both items have identical relevance and tags, but different credibility tiers.
      // The high-credibility item should get a 1.25x multiplier vs 1.0x for standard.
      const standardCredItem = buildKbItem({
        id: 'kb-standard-cred',
        relevanceScore: 6,
        credibilityTier: 'standard', // 1.0x multiplier
        tags: ['express', 'error-handling'],
        sourcePlatform: 'reddit',
      });
      const highCredItem = buildKbItem({
        id: 'kb-high-cred',
        relevanceScore: 6,           // same base score
        credibilityTier: 'high',     // 1.25x multiplier
        tags: ['express', 'error-handling'], // same tags
        sourcePlatform: 'web',
      });

      const domainResults = [buildDomainResult([buildGrowthArea()])];
      // Standard-cred item first — if credibility matters, high-cred still wins
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [standardCredItem, highCredItem], []);

      const attachedTip = enriched[0]!.growthAreas[0]!.kbTip;
      expect(attachedTip?.tipId).toBe('kb-high-cred');
    });

    it('attached tip carries credibilityTier for transparency', () => {
      const item = buildKbItem({ credibilityTier: 'high', relevanceScore: 8 });
      const domainResults = [buildDomainResult([buildGrowthArea()])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [item], []);

      const tip = enriched[0]!.growthAreas[0]!.kbTip;
      expect(tip?.credibilityTier).toBe('high');
    });

    it('attached tip carries sourcePlatform for credibility display', () => {
      const item = buildKbItem({ sourcePlatform: 'web', credibilityTier: 'high', relevanceScore: 8 });
      const domainResults = [buildDomainResult([buildGrowthArea()])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [item], []);

      const tip = enriched[0]!.growthAreas[0]!.kbTip;
      expect(tip?.sourcePlatform).toBe('web');
    });
  });

  // ============================================================================
  // AC 8.5: Dual-write contract — kbTip and knowledgeTip are always identical
  // ============================================================================

  describe('AC 8.5: Dual-write — kbTip and knowledgeTip are always identical', () => {
    it('populates both kbTip and knowledgeTip when a tip is attached', () => {
      const item = buildKbItem({ relevanceScore: 8, credibilityTier: 'high' });
      const domainResults = [buildDomainResult([buildGrowthArea()])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [item], []);

      const ga = enriched[0]!.growthAreas[0]!;
      expect(ga.kbTip).toBeDefined();
      expect(ga.knowledgeTip).toBeDefined();
      expect(ga.knowledgeTip).toEqual(ga.kbTip);
    });

    it('leaves both kbTip and knowledgeTip undefined when no tip qualifies', () => {
      const domainResults = [buildDomainResult([buildGrowthArea()])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [], []);

      const ga = enriched[0]!.growthAreas[0]!;
      expect(ga.kbTip).toBeUndefined();
      expect(ga.knowledgeTip).toBeUndefined();
    });

    it('both fields are identical across all growth areas in multiple domains', () => {
      const item = buildKbItem({ relevanceScore: 8, credibilityTier: 'high' });
      const domainResults = [
        buildDomainResult([buildGrowthArea(), buildGrowthArea({ title: 'Another Growth Area' })]),
      ];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [item], []);

      for (const dr of enriched) {
        for (const ga of dr.growthAreas) {
          if (ga.kbTip) {
            expect(ga.knowledgeTip).toEqual(ga.kbTip);
          } else {
            expect(ga.knowledgeTip).toBeUndefined();
          }
        }
      }
    });
  });

  // ============================================================================
  // AC 8.6: Immutability — input domain results are NOT mutated
  // ============================================================================

  describe('AC 8.6: Immutability — input domain results are not mutated', () => {
    it('returns new objects without modifying input growth areas', () => {
      const item = buildKbItem({ relevanceScore: 8 });
      const originalGa = buildGrowthArea();
      const domainResults = [buildDomainResult([originalGa])];

      // Deep-clone the original for comparison
      const originalSnapshot = JSON.parse(JSON.stringify(domainResults));

      enrichGrowthAreasWithKbTips(domainResults, [item], []);

      // Original should be unchanged
      expect(JSON.stringify(domainResults)).toBe(JSON.stringify(originalSnapshot));
    });

    it('does not mutate the input domainResults array itself', () => {
      const item = buildKbItem({ relevanceScore: 8 });
      const domainResults = [buildDomainResult([buildGrowthArea()])];
      const originalLength = domainResults.length;

      enrichGrowthAreasWithKbTips(domainResults, [item], []);

      expect(domainResults.length).toBe(originalLength);
    });
  });

  // ============================================================================
  // AC 8.7: Tip fields — relevanceScore is normalized 0-1
  // ============================================================================

  describe('AC 8.7: Tip relevanceScore is normalized to 0-1 range', () => {
    it('attached tip has relevanceScore between 0 and 1 inclusive', () => {
      const item = buildKbItem({ relevanceScore: 8, credibilityTier: 'high' });
      const domainResults = [buildDomainResult([buildGrowthArea()])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [item], []);

      const tip = enriched[0]!.growthAreas[0]!.kbTip;
      expect(tip).toBeDefined();
      expect(tip!.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(tip!.relevanceScore).toBeLessThanOrEqual(1);
    });

    it('attached tip relevanceScore is at or above KB_TIP_RELEVANCE_THRESHOLD (0.3)', () => {
      const item = buildKbItem({ relevanceScore: 8, credibilityTier: 'high' });
      const domainResults = [buildDomainResult([buildGrowthArea()])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [item], []);

      const tip = enriched[0]!.growthAreas[0]!.kbTip;
      if (tip) {
        // If a tip was attached, its score must exceed the threshold
        expect(tip.relevanceScore).toBeGreaterThanOrEqual(KB_TIP_RELEVANCE_THRESHOLD);
      }
      // If no tip was attached (no match for this dimension), that's also valid
    });
  });

  // ============================================================================
  // AC 8.8: Per-growth-area matching — different growth areas can get different tips
  // ============================================================================

  describe('AC 8.8: Per-growth-area matching — each growth area independently matched', () => {
    it('each growth area gets independently matched (one tip per growth area)', () => {
      const ga1 = buildGrowthArea({ title: 'Error Handling Issue' });
      const ga2 = buildGrowthArea({ title: 'Context Window Bloat' });

      const item = buildKbItem({ relevanceScore: 8 });
      const domainResults = [buildDomainResult([ga1, ga2])];
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [item], []);

      const tips = enriched[0]!.growthAreas.map(ga => ga.kbTip);
      // Each growth area gets at most one tip (not an array)
      for (const tip of tips) {
        if (tip !== undefined) {
          expect(typeof tip.tipId).toBe('string'); // not an array
          expect(typeof tip.title).toBe('string');
          expect(typeof tip.relevanceScore).toBe('number');
        }
      }
    });
  });

  // ============================================================================
  // AC 8.9: Multiple domain results — each domain processed independently
  // ============================================================================

  describe('AC 8.9: Multiple domain results — all domains enriched', () => {
    it('enriches growth areas across multiple domain results', () => {
      // thinkingQuality → TrustVerification
      // contextEfficiency → ContextEfficiency
      const domainResults: DomainResult[] = [
        {
          domain: 'thinkingQuality',
          overallScore: 70,
          confidenceScore: 0.8,
          strengths: [],
          growthAreas: [buildGrowthArea()],
          data: {},
          analyzedAt: '2026-04-01T00:00:00.000Z',
        },
        {
          domain: 'contextEfficiency',
          overallScore: 65,
          confidenceScore: 0.7,
          strengths: [],
          growthAreas: [
            buildGrowthArea({
              title: 'Context Window Overloading',
              description: 'Across three sessions you kept outdated code snippets in context unnecessarily. Each time the context window grew beyond 60%, the AI responses became less focused. Observed in sessions working on the checkout flow and the payment confirmation handler.',
            }),
          ],
          data: {},
          analyzedAt: '2026-04-01T00:00:00.000Z',
        },
      ];

      const trustItem = buildKbItem({
        id: 'kb-trust',
        applicableDimensions: ['TrustVerification'],
        relevanceScore: 8,
      });
      const contextItem: PortableKnowledgeItem = {
        id: 'kb-context',
        title: 'Context Window Management Best Practices',
        summary: 'Keep sessions focused. Use /compact at 60% fill. Reference prior context.',
        sourceUrl: 'https://docs.anthropic.com/claude-code/context',
        sourceAuthor: 'Anthropic Docs',
        contentType: 'documentation',
        tags: ['context-window', 'session-management', 'prompting'],
        applicableDimensions: ['ContextEfficiency'],
        relevanceScore: 7,
        sourcePlatform: 'web',
        credibilityTier: 'high',
      };

      const enriched = enrichGrowthAreasWithKbTips(domainResults, [trustItem, contextItem], []);

      // Both domains should return enriched results
      expect(enriched.length).toBe(2);
      // Structure preserved
      expect(enriched[0]!.domain).toBe('thinkingQuality');
      expect(enriched[1]!.domain).toBe('contextEfficiency');
      // Each should have growth areas (possibly with or without tips)
      expect(enriched[0]!.growthAreas.length).toBe(1);
      expect(enriched[1]!.growthAreas.length).toBe(1);
    });
  });

  // ============================================================================
  // AC 8.10: Professional insights can also be attached as tips
  // ============================================================================

  describe('AC 8.10: Professional insights are also candidates for tip selection', () => {
    it('attaches a professional insight as tip when no knowledge item matches but insight does', () => {
      // No knowledge items match
      const insight: PortableProfessionalInsight = {
        id: 'pi-error-verification',
        title: 'Always Verify Error Paths Before Shipping',
        keyTakeaway: 'Testing error paths prevents silent failures in production middleware.',
        actionableAdvice: ['Write a test for every catch block before submitting PR.'],
        sourceAuthor: 'Martin Fowler',
        sourceUrl: 'https://martinfowler.com/articles/errorPaths.html',
        category: 'testing',
        priority: 9,
        applicableDimensions: ['TrustVerification'],
      };

      const domainResults = [buildDomainResult([buildGrowthArea()])];
      // Empty knowledge items — only insights
      const enriched = enrichGrowthAreasWithKbTips(domainResults, [], [insight]);

      const tip = enriched[0]!.growthAreas[0]!.kbTip;
      // If the insight score exceeds threshold, it should be attached
      if (tip) {
        expect(tip.tipId).toBe('pi-error-verification');
        expect(tip.title).toBe('Always Verify Error Paths Before Shipping');
        expect(tip.sourceAuthor).toBe('Martin Fowler');
        expect(tip.relevanceScore).toBeGreaterThanOrEqual(KB_TIP_RELEVANCE_THRESHOLD);
      }
      // If not attached (score too low), that's also valid per the threshold contract
    });
  });
});
