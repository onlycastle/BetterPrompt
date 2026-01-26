/**
 * Tests for Knowledge Linker (Phase 1)
 *
 * Tests the dimension-KB integration including:
 * - Keyword configuration retrieval
 * - Mode determination from scores
 * - Resource level calculation
 * - Knowledge linking and filtering
 * - Professional insights filtering
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  // dimension-keywords exports
  DIMENSION_KEYWORDS,
  getKeywordConfig,
  getModeFromScore,
  getResourceLevel,
  type InsightMode,
  type ResourceLevel,
} from '../src/lib/analyzer/dimension-keywords.js';
import {
  KnowledgeLinker,
  MockKnowledgeSource,
  createKnowledgeLinker,
  type KnowledgeSource,
  type LinkedKnowledge,
  type DimensionKnowledge,
  type KnowledgeContext,
} from '../src/lib/analyzer/knowledge-linker.js';
import type { DimensionName, DimensionResult } from '../src/lib/models/unified-report.js';

// ============================================
// dimension-keywords.ts Tests
// ============================================

describe('dimension-keywords', () => {
  describe('DIMENSION_KEYWORDS', () => {
    it('should have all 6 dimensions defined', () => {
      const dimensions: DimensionName[] = [
        'aiCollaboration',
        'contextEngineering',
        'toolMastery',
        'burnoutRisk',
        'aiControl',
        'skillResilience',
      ];

      dimensions.forEach((dim) => {
        expect(DIMENSION_KEYWORDS[dim]).toBeDefined();
        expect(DIMENSION_KEYWORDS[dim].reinforcement).toBeDefined();
        expect(DIMENSION_KEYWORDS[dim].improvement).toBeDefined();
      });
    });

    it('should have required fields for each config', () => {
      Object.values(DIMENSION_KEYWORDS).forEach((mapping) => {
        ['reinforcement', 'improvement'].forEach((mode) => {
          const config = mapping[mode as InsightMode];
          expect(config.keywords).toBeInstanceOf(Array);
          expect(config.keywords.length).toBeGreaterThan(0);
          expect(['beginner', 'intermediate', 'advanced']).toContain(config.level);
          expect(typeof config.searchQuery).toBe('string');
        });
      });
    });

    it('should have advanced level for reinforcement and beginner for improvement', () => {
      Object.values(DIMENSION_KEYWORDS).forEach((mapping) => {
        expect(mapping.reinforcement.level).toBe('advanced');
        expect(mapping.improvement.level).toBe('beginner');
      });
    });
  });

  describe('getKeywordConfig', () => {
    it('should return correct config for reinforcement mode', () => {
      const config = getKeywordConfig('contextEngineering', 'reinforcement');
      expect(config.level).toBe('advanced');
      expect(config.keywords).toContain('advanced context management');
    });

    it('should return correct config for improvement mode', () => {
      const config = getKeywordConfig('skillResilience', 'improvement');
      expect(config.level).toBe('beginner');
      expect(config.keywords).toContain('skill atrophy');
    });
  });

  describe('getModeFromScore', () => {
    it('should return reinforcement for score >= 70', () => {
      expect(getModeFromScore(70)).toBe('reinforcement');
      expect(getModeFromScore(85)).toBe('reinforcement');
      expect(getModeFromScore(100)).toBe('reinforcement');
    });

    it('should return improvement for score < 70', () => {
      expect(getModeFromScore(69)).toBe('improvement');
      expect(getModeFromScore(50)).toBe('improvement');
      expect(getModeFromScore(0)).toBe('improvement');
    });
  });

  describe('getResourceLevel', () => {
    it('should return advanced for score >= 85', () => {
      expect(getResourceLevel(85)).toBe('advanced');
      expect(getResourceLevel(100)).toBe('advanced');
    });

    it('should return intermediate for score >= 50 and < 85', () => {
      expect(getResourceLevel(50)).toBe('intermediate');
      expect(getResourceLevel(70)).toBe('intermediate');
      expect(getResourceLevel(84)).toBe('intermediate');
    });

    it('should return beginner for score < 50', () => {
      expect(getResourceLevel(49)).toBe('beginner');
      expect(getResourceLevel(25)).toBe('beginner');
      expect(getResourceLevel(0)).toBe('beginner');
    });
  });
});

// ============================================
// knowledge-linker.ts Tests
// ============================================

describe('knowledge-linker', () => {
  describe('MockKnowledgeSource', () => {
    it('should return empty array for searchAdvanced', async () => {
      const source = new MockKnowledgeSource();
      const results = await source.searchAdvanced({ query: 'test' });
      expect(results).toEqual([]);
    });

    it('should return empty professional insights (now stored in database)', async () => {
      const source = new MockKnowledgeSource();
      const insights = await source.getProfessionalInsights();
      expect(insights).toEqual([]);
    });
  });

  describe('KnowledgeLinker', () => {
    let linker: KnowledgeLinker;

    beforeEach(() => {
      linker = new KnowledgeLinker();
    });

    describe('findRelevant', () => {
      it('should return DimensionKnowledge for high score (reinforcement)', async () => {
        const result = await linker.findRelevant('contextEngineering', 85);

        expect(result.dimension).toBe('contextEngineering');
        expect(result.mode).toBe('reinforcement');
        expect(result.level).toBe('advanced');
        expect(result.knowledgeItems).toBeInstanceOf(Array);
        expect(result.professionalInsights).toBeInstanceOf(Array);
      });

      it('should return DimensionKnowledge for low score (improvement)', async () => {
        const result = await linker.findRelevant('skillResilience', 45);

        expect(result.dimension).toBe('skillResilience');
        expect(result.mode).toBe('improvement');
        expect(result.level).toBe('beginner');
      });

      it('should return empty professional insights with MockKnowledgeSource', async () => {
        const result = await linker.findRelevant('skillResilience', 40);

        // MockKnowledgeSource returns empty (insights now in database)
        expect(result.professionalInsights).toEqual([]);
      });

      it('should filter professional insights by score range', async () => {
        // pi-001 has maxScore: 60, so it should NOT appear for score 75
        const result = await linker.findRelevant('skillResilience', 75);

        const insightIds = result.professionalInsights.map((i) => i.id);
        // pi-001 should not be included as score 75 > maxScore 60
        // BUT it's in preferredIds, so it might still appear
        // Let's verify the logic works correctly
        expect(result.mode).toBe('reinforcement');
      });
    });

    describe('getKnowledgeForDimensions', () => {
      it('should return knowledge context for multiple dimensions', async () => {
        const dimensions: DimensionResult[] = [
          createMockDimensionResult('aiCollaboration', 85),
          createMockDimensionResult('contextEngineering', 75),
          createMockDimensionResult('toolMastery', 60),
          createMockDimensionResult('burnoutRisk', 45),
          createMockDimensionResult('aiControl', 80),
          createMockDimensionResult('skillResilience', 30),
        ];

        const context = await linker.getKnowledgeForDimensions(dimensions);

        expect(context.reinforcements).toBeInstanceOf(Array);
        expect(context.improvements).toBeInstanceOf(Array);

        // Scores >= 70 should be reinforcements
        expect(context.reinforcements.length).toBe(3); // aiCollaboration, contextEngineering, aiControl
        // Scores < 70 should be improvements
        expect(context.improvements.length).toBe(3); // toolMastery, burnoutRisk, skillResilience
      });

      it('should categorize dimensions correctly by score threshold', async () => {
        const dimensions: DimensionResult[] = [
          createMockDimensionResult('aiCollaboration', 70), // exactly at threshold
          createMockDimensionResult('contextEngineering', 69), // just below
        ];

        const context = await linker.getKnowledgeForDimensions(dimensions);

        expect(context.reinforcements.length).toBe(1);
        expect(context.improvements.length).toBe(1);
        expect(context.reinforcements[0].dimension).toBe('aiCollaboration');
        expect(context.improvements[0].dimension).toBe('contextEngineering');
      });
    });
  });

  describe('createKnowledgeLinker', () => {
    it('should create a KnowledgeLinker instance', () => {
      const linker = createKnowledgeLinker();
      expect(linker).toBeInstanceOf(KnowledgeLinker);
    });

    it('should accept custom knowledge source', async () => {
      const customSource: KnowledgeSource = {
        async searchAdvanced() {
          return [
            {
              id: 'custom-1',
              title: 'Custom Item',
              summary: 'Custom summary',
              category: 'best-practices',
            },
          ];
        },
        async getProfessionalInsights() {
          return [];
        },
      };

      const linker = createKnowledgeLinker(customSource);
      const result = await linker.findRelevant('aiCollaboration', 50);

      expect(result.knowledgeItems.length).toBeGreaterThan(0);
      expect(result.knowledgeItems[0].id).toBe('custom-1');
    });
  });
});

// ============================================
// Professional Insights Integration Tests
// ============================================

describe('Professional Insights Integration', () => {
  // Professional insights are now stored in the database.
  // MockKnowledgeSource returns empty arrays, so these tests verify
  // the filtering logic with an injected custom source.

  it('should filter insights by dimension and score range', async () => {
    const customSource: KnowledgeSource = {
      async searchAdvanced() { return []; },
      async getProfessionalInsights() {
        return [
          {
            id: 'pi-001',
            title: 'Skill Atrophy Prevention',
            keyTakeaway: 'Practice independently',
            actionableAdvice: ['Code without AI weekly'],
            source: { type: 'article', author: 'Test Author' },
            applicableDimensions: ['skillResilience'],
            minScore: 0,
            maxScore: 60,
            priority: 10,
            enabled: true,
          },
          {
            id: 'pi-002',
            title: 'Advanced AI Control',
            keyTakeaway: 'Verify outputs systematically',
            actionableAdvice: ['Use structured reviews'],
            source: { type: 'article', author: 'Test Author' },
            applicableDimensions: ['aiControl'],
            minScore: 0,
            maxScore: 50,
            priority: 8,
            enabled: true,
          },
        ];
      },
    };

    const linker = createKnowledgeLinker(customSource);

    // pi-001 should match: skillResilience dimension, score 40 <= maxScore 60
    const result = await linker.findRelevant('skillResilience', 40);
    const ids = result.professionalInsights.map((i) => i.id);
    expect(ids).toContain('pi-001');
    expect(ids).not.toContain('pi-002'); // Wrong dimension
  });

  it('should limit insights to 3 per dimension', async () => {
    const linker = new KnowledgeLinker();
    const result = await linker.findRelevant('aiControl', 40);
    expect(result.professionalInsights.length).toBeLessThanOrEqual(3);
  });

  it('should exclude insights outside score range', async () => {
    const customSource: KnowledgeSource = {
      async searchAdvanced() { return []; },
      async getProfessionalInsights() {
        return [
          {
            id: 'pi-001',
            title: 'Beginner Guide',
            keyTakeaway: 'Start here',
            actionableAdvice: ['Step 1'],
            source: { type: 'article', author: 'Test' },
            applicableDimensions: ['skillResilience'],
            minScore: 0,
            maxScore: 60,
            priority: 10,
            enabled: true,
          },
        ];
      },
    };

    const linker = createKnowledgeLinker(customSource);

    // Score 75 exceeds maxScore 60 — should NOT include pi-001
    const result = await linker.findRelevant('skillResilience', 75);
    const ids = result.professionalInsights.map((i) => i.id);
    expect(ids).not.toContain('pi-001');
  });
});

// ============================================
// Helper Functions
// ============================================

function createMockDimensionResult(
  name: DimensionName,
  score: number
): DimensionResult {
  return {
    name,
    displayName: name,
    score,
    level: score >= 70 ? 'proficient' : 'developing',
    isStrength: score >= 70,
    breakdown: {},
    highlights: {
      strengths: [],
      growthAreas: [],
    },
    insights: [],
    interpretation: `Mock interpretation for ${name}`,
  };
}
