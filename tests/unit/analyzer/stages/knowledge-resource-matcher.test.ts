/**
 * Tests for Knowledge Resource Matcher (Phase 2.75)
 *
 * Validates two-level matching:
 * - Level 1: Dimension filter
 * - Level 2: Tag overlap, style boost, control level boost, subCategory overlap
 */

import { describe, it, expect, vi } from 'vitest';
import {
  matchKnowledgeResources,
  extractMatchingContext,
  computeTagOverlap,
  computeSubCategoryOverlap,
} from '../../../../src/lib/analyzer/stages/knowledge-resource-matcher.js';
import type { KnowledgeMatcherDeps } from '../../../../src/lib/analyzer/stages/knowledge-resource-matcher.js';
import type { AgentOutputs } from '../../../../src/lib/models/agent-outputs.js';
import type { KnowledgeItem, ProfessionalInsight } from '../../../../src/lib/domain/models/knowledge.js';
import type { GrowthAreaInsight } from '../../../../src/lib/models/strength-growth-data.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockKnowledgeItem(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    id: 'ki-1',
    version: '1.0.0',
    title: 'Test Knowledge Item',
    summary: 'A summary of test knowledge',
    content: 'Detailed content about testing',
    applicableDimensions: ['contextEngineering'],
    subCategories: undefined,
    contentType: 'technique',
    tags: ['context-engineering', 'prompt-design'],
    source: {
      platform: 'web',
      url: 'https://example.com/article',
      author: 'Test Author',
      fetchedAt: '2025-01-01T00:00:00Z',
    },
    relevance: {
      score: 0.8,
      confidence: 0.9,
      reasoning: 'Highly relevant',
    },
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    status: 'approved',
    ...overrides,
  } as KnowledgeItem;
}

function createMockProfessionalInsight(overrides: Partial<ProfessionalInsight> = {}): ProfessionalInsight {
  return {
    id: 'pi-1',
    version: '1.0.0',
    category: 'diagnosis',
    title: 'Test Professional Insight',
    keyTakeaway: 'Key takeaway for testing',
    actionableAdvice: ['Action step 1', 'Action step 2'],
    source: {
      type: 'blog',
      url: 'https://example.com/insight',
      author: 'Insight Author',
    },
    applicableStyles: ['architect'],
    applicableControlLevels: ['navigator'],
    applicableDimensions: ['contextEngineering'],
    priority: 7,
    enabled: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  } as ProfessionalInsight;
}

function createMockGrowthArea(overrides: Partial<GrowthAreaInsight> = {}): GrowthAreaInsight {
  return {
    title: 'Context Provision Pattern',
    description: 'Developer often skips providing context engineering details',
    evidence: [],
    recommendation: 'Provide structured context before each prompt',
    dimension: 'contextEngineering',
    ...overrides,
  } as GrowthAreaInsight;
}

function createMockDeps(
  knowledgeItems: KnowledgeItem[] = [],
  professionalInsights: ProfessionalInsight[] = [],
): KnowledgeMatcherDeps {
  return {
    knowledgeRepo: {
      search: vi.fn().mockResolvedValue({
        success: true,
        data: { items: knowledgeItems, total: knowledgeItems.length, hasMore: false },
      }),
      // Other methods not needed for matcher
      save: vi.fn(),
      saveBatch: vi.fn(),
      findById: vi.fn(),
      fullTextSearch: vi.fn(),
      getStats: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
      existsByUrl: vi.fn(),
      findSimilar: vi.fn(),
    } as any,
    professionalInsightRepo: {
      findApplicable: vi.fn().mockResolvedValue({
        success: true,
        data: professionalInsights,
      }),
      // Other methods not needed for matcher
      findEnabled: vi.fn(),
      findWithFilters: vi.fn(),
      findById: vi.fn(),
      save: vi.fn(),
      saveBatch: vi.fn(),
      update: vi.fn(),
      setEnabled: vi.fn(),
      delete: vi.fn(),
      countByCategory: vi.fn(),
    } as any,
  };
}

function createMockAgentOutputs(overrides: Partial<AgentOutputs> = {}): AgentOutputs {
  return {
    strengthGrowth: {
      strengths: [],
      growthAreas: [
        createMockGrowthArea({ dimension: 'contextEngineering' }),
      ],
      confidenceScore: 0.85,
    },
    typeClassifier: {
      primaryType: 'architect',
      distribution: { architect: 40, scientist: 20, collaborator: 15, speedrunner: 15, craftsman: 10 },
      controlLevel: 'navigator',
      controlScore: 65,
      matrixName: 'Systems Architect',
      matrixEmoji: '🏗️',
      confidenceScore: 0.85,
    },
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('KnowledgeResourceMatcher', () => {
  describe('computeTagOverlap', () => {
    it('should return 0 for empty tags', () => {
      const areas = [createMockGrowthArea()];
      expect(computeTagOverlap([], areas)).toBe(0);
    });

    it('should return 0 for empty growth areas', () => {
      expect(computeTagOverlap(['context-engineering'], [])).toBe(0);
    });

    it('should match tags appearing in growth area text', () => {
      const areas = [createMockGrowthArea({
        title: 'Context Engineering Gap',
        description: 'Missing prompt design skills',
        recommendation: 'Learn context engineering basics',
      })];
      const score = computeTagOverlap(['context-engineering', 'prompt-design', 'testing'], areas);
      // 'context-engineering' → 'context engineering' found in title + recommendation
      // 'prompt-design' → 'prompt design' found in description
      // 'testing' → not found
      expect(score).toBe(2);
    });

    it('should normalize hyphens in tags for matching', () => {
      const areas = [createMockGrowthArea({
        title: 'Context engineering patterns',
        description: 'Description',
        recommendation: 'Recommendation',
      })];
      expect(computeTagOverlap(['context-engineering'], areas)).toBe(1);
    });

    it('should cap at 3', () => {
      const areas = [createMockGrowthArea({
        title: 'alpha beta gamma delta epsilon',
        description: 'alpha beta gamma delta epsilon',
        recommendation: 'alpha beta gamma delta epsilon',
      })];
      const score = computeTagOverlap(['alpha', 'beta', 'gamma', 'delta', 'epsilon'], areas);
      expect(score).toBe(3);
    });
  });

  describe('computeSubCategoryOverlap', () => {
    it('should return 0 for undefined keywords', () => {
      expect(computeSubCategoryOverlap(undefined, [createMockGrowthArea()])).toBe(0);
    });

    it('should return 0 for empty keywords', () => {
      expect(computeSubCategoryOverlap([], [createMockGrowthArea()])).toBe(0);
    });

    it('should score 0.5 per matching keyword', () => {
      const areas = [createMockGrowthArea({
        title: 'Context provision',
        description: 'Missing structured prompts',
      })];
      const score = computeSubCategoryOverlap(['context', 'prompts'], areas);
      // 'context' found, 'prompts' found → 2 * 0.5 = 1.0
      expect(score).toBe(1.0);
    });

    it('should cap at 2', () => {
      const areas = [createMockGrowthArea({
        title: 'a b c d e f',
        description: 'a b c d e f',
      })];
      const score = computeSubCategoryOverlap(['a', 'b', 'c', 'd', 'e'], areas);
      expect(score).toBe(2);
    });
  });

  describe('extractMatchingContext', () => {
    it('should return empty map for no growth areas', () => {
      const ctx = extractMatchingContext({});
      expect(ctx.growthAreasByDimension.size).toBe(0);
      expect(ctx.primaryType).toBeUndefined();
      expect(ctx.controlLevel).toBeUndefined();
    });

    it('should extract primaryType and controlLevel from TypeClassifier', () => {
      const outputs = createMockAgentOutputs();
      const ctx = extractMatchingContext(outputs);
      expect(ctx.primaryType).toBe('architect');
      expect(ctx.controlLevel).toBe('navigator');
    });

    it('should group growth areas by dimension', () => {
      const outputs = createMockAgentOutputs({
        strengthGrowth: {
          strengths: [],
          growthAreas: [
            createMockGrowthArea({ dimension: 'contextEngineering', title: 'GA1' }),
            createMockGrowthArea({ dimension: 'contextEngineering', title: 'GA2' }),
            createMockGrowthArea({ dimension: 'toolMastery', title: 'GA3' }),
          ],
          confidenceScore: 0.8,
        },
      });
      const ctx = extractMatchingContext(outputs);
      expect(ctx.growthAreasByDimension.size).toBe(2);
      expect(ctx.growthAreasByDimension.get('contextEngineering')?.length).toBe(2);
      expect(ctx.growthAreasByDimension.get('toolMastery')?.length).toBe(1);
    });
  });

  describe('matchKnowledgeResources', () => {
    it('should return empty array when no growth areas exist', async () => {
      const deps = createMockDeps();
      const outputs: AgentOutputs = {};
      const result = await matchKnowledgeResources(outputs, deps);
      expect(result).toEqual([]);
    });

    it('should return matches grouped by dimension', async () => {
      const ki = createMockKnowledgeItem({
        applicableDimensions: ['contextEngineering'],
        tags: ['context-engineering'],
      });
      const pi = createMockProfessionalInsight({
        applicableDimensions: ['contextEngineering'],
      });
      const deps = createMockDeps([ki], [pi]);
      const outputs = createMockAgentOutputs();

      const result = await matchKnowledgeResources(outputs, deps);

      expect(result.length).toBe(1);
      expect(result[0].dimension).toBe('contextEngineering');
      expect(result[0].dimensionDisplayName).toBe('Context Engineering');
      expect(result[0].knowledgeItems.length).toBe(1);
      expect(result[0].professionalInsights.length).toBe(1);
    });

    it('should filter out knowledge items not matching dimension', async () => {
      const ki = createMockKnowledgeItem({
        applicableDimensions: ['toolMastery'], // Does NOT match contextEngineering
        tags: ['context-engineering'],
      });
      const deps = createMockDeps([ki], []);
      const outputs = createMockAgentOutputs();

      const result = await matchKnowledgeResources(outputs, deps);

      // Dimension contextEngineering has growth areas but no matching knowledge items
      // and no professional insights → filtered out
      expect(result.length).toBe(0);
    });

    it('should rank knowledge items with matching tags higher', async () => {
      const kiHigh = createMockKnowledgeItem({
        id: 'ki-high',
        applicableDimensions: ['contextEngineering'],
        tags: ['context-engineering', 'prompt-design'], // Both match
        relevance: { score: 0.5, confidence: 0.9, reasoning: 'Test' },
      });
      const kiLow = createMockKnowledgeItem({
        id: 'ki-low',
        applicableDimensions: ['contextEngineering'],
        tags: ['unrelated-tag'], // No match
        relevance: { score: 0.5, confidence: 0.9, reasoning: 'Test' },
      });
      const deps = createMockDeps([kiLow, kiHigh], []);
      const outputs = createMockAgentOutputs({
        strengthGrowth: {
          strengths: [],
          growthAreas: [createMockGrowthArea({
            dimension: 'contextEngineering',
            title: 'Context Engineering Issue',
            description: 'Needs better prompt design',
            recommendation: 'Improve context engineering',
          })],
          confidenceScore: 0.8,
        },
      });

      const result = await matchKnowledgeResources(outputs, deps);

      expect(result.length).toBe(1);
      expect(result[0].knowledgeItems.length).toBe(2);
      // kiHigh should rank first (higher tag overlap score)
      expect(result[0].knowledgeItems[0].id).toBe('ki-high');
      expect(result[0].knowledgeItems[0].matchScore).toBeGreaterThan(
        result[0].knowledgeItems[1].matchScore
      );
    });

    it('should boost professional insights matching primaryType', async () => {
      const piMatch = createMockProfessionalInsight({
        id: 'pi-style-match',
        applicableStyles: ['architect'], // matches TypeClassifier
        applicableControlLevels: [],
        priority: 5,
      });
      const piNoMatch = createMockProfessionalInsight({
        id: 'pi-no-match',
        applicableStyles: ['speedrunner'], // does not match
        applicableControlLevels: [],
        priority: 5,
      });

      const deps = createMockDeps(
        [createMockKnowledgeItem()],
        [piNoMatch, piMatch],
      );
      const outputs = createMockAgentOutputs(); // primaryType = architect

      const result = await matchKnowledgeResources(outputs, deps);

      expect(result.length).toBe(1);
      expect(result[0].professionalInsights.length).toBe(2);
      // piMatch should rank first due to style boost
      expect(result[0].professionalInsights[0].id).toBe('pi-style-match');
      expect(result[0].professionalInsights[0].matchScore).toBeGreaterThan(
        result[0].professionalInsights[1].matchScore
      );
    });

    it('should boost professional insights matching controlLevel', async () => {
      const piMatch = createMockProfessionalInsight({
        id: 'pi-control-match',
        applicableStyles: [],
        applicableControlLevels: ['navigator'], // matches TypeClassifier
        priority: 5,
      });
      const piNoMatch = createMockProfessionalInsight({
        id: 'pi-no-control',
        applicableStyles: [],
        applicableControlLevels: ['explorer'], // does not match
        priority: 5,
      });

      const deps = createMockDeps(
        [createMockKnowledgeItem()],
        [piNoMatch, piMatch],
      );
      const outputs = createMockAgentOutputs(); // controlLevel = navigator

      const result = await matchKnowledgeResources(outputs, deps);

      expect(result.length).toBe(1);
      // piMatch should rank first due to control level boost
      expect(result[0].professionalInsights[0].id).toBe('pi-control-match');
    });

    it('should handle subCategory matching', async () => {
      const ki = createMockKnowledgeItem({
        applicableDimensions: ['contextEngineering'],
        subCategories: {
          contextEngineering: ['context', 'structured prompts'],
        } as any,
        tags: [],
        relevance: { score: 0.5, confidence: 0.9, reasoning: 'Test' },
      });
      const kiNoSub = createMockKnowledgeItem({
        id: 'ki-no-sub',
        applicableDimensions: ['contextEngineering'],
        subCategories: undefined,
        tags: [],
        relevance: { score: 0.5, confidence: 0.9, reasoning: 'Test' },
      });

      const deps = createMockDeps([kiNoSub, ki], []);
      const outputs = createMockAgentOutputs({
        strengthGrowth: {
          strengths: [],
          growthAreas: [createMockGrowthArea({
            dimension: 'contextEngineering',
            title: 'Context provision issue',
            description: 'Needs structured prompts for AI',
          })],
          confidenceScore: 0.8,
        },
      });

      const result = await matchKnowledgeResources(outputs, deps);

      expect(result.length).toBe(1);
      // ki with subCategories should rank higher
      expect(result[0].knowledgeItems[0].id).toBe('ki-1');
    });

    it('should handle multiple dimensions', async () => {
      const kiContext = createMockKnowledgeItem({
        id: 'ki-ctx',
        applicableDimensions: ['contextEngineering'],
      });
      const kiTool = createMockKnowledgeItem({
        id: 'ki-tool',
        applicableDimensions: ['toolMastery'],
      });

      const deps: KnowledgeMatcherDeps = {
        knowledgeRepo: {
          search: vi.fn().mockResolvedValue({
            success: true,
            data: { items: [kiContext, kiTool], total: 2, hasMore: false },
          }),
        } as any,
        professionalInsightRepo: {
          findApplicable: vi.fn().mockResolvedValue({
            success: true,
            data: [],
          }),
        } as any,
      };

      const outputs = createMockAgentOutputs({
        strengthGrowth: {
          strengths: [],
          growthAreas: [
            createMockGrowthArea({ dimension: 'contextEngineering' }),
            createMockGrowthArea({ dimension: 'toolMastery' }),
          ],
          confidenceScore: 0.8,
        },
      });

      const result = await matchKnowledgeResources(outputs, deps);

      expect(result.length).toBe(2);
      const dims = result.map(r => r.dimension);
      expect(dims).toContain('contextEngineering');
      expect(dims).toContain('toolMastery');
    });

    it('should sort items by matchScore descending', async () => {
      const items = [
        createMockKnowledgeItem({
          id: 'ki-low',
          applicableDimensions: ['contextEngineering'],
          tags: [],
          relevance: { score: 0.2, confidence: 0.9, reasoning: 'Low' },
        }),
        createMockKnowledgeItem({
          id: 'ki-high',
          applicableDimensions: ['contextEngineering'],
          tags: ['context-engineering'],
          relevance: { score: 0.9, confidence: 0.9, reasoning: 'High' },
        }),
        createMockKnowledgeItem({
          id: 'ki-mid',
          applicableDimensions: ['contextEngineering'],
          tags: [],
          relevance: { score: 0.5, confidence: 0.9, reasoning: 'Mid' },
        }),
      ];
      const deps = createMockDeps(items, []);
      const outputs = createMockAgentOutputs({
        strengthGrowth: {
          strengths: [],
          growthAreas: [createMockGrowthArea({
            dimension: 'contextEngineering',
            title: 'Context engineering gap',
          })],
          confidenceScore: 0.8,
        },
      });

      const result = await matchKnowledgeResources(outputs, deps);

      expect(result[0].knowledgeItems[0].id).toBe('ki-high');
      expect(result[0].knowledgeItems[2].id).toBe('ki-low');
      // Verify descending order
      const scores = result[0].knowledgeItems.map(i => i.matchScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }
    });

    it('should propagate errors from knowledge repo (No Fallback Policy)', async () => {
      const deps: KnowledgeMatcherDeps = {
        knowledgeRepo: {
          search: vi.fn().mockResolvedValue({
            success: false,
            error: new Error('Connection failed'),
          }),
        } as any,
        professionalInsightRepo: {
          findApplicable: vi.fn(),
        } as any,
      };

      const outputs = createMockAgentOutputs();

      await expect(
        matchKnowledgeResources(outputs, deps)
      ).rejects.toThrow('Knowledge repo search failed');
    });

    it('should propagate errors from professional insight repo (No Fallback Policy)', async () => {
      const deps: KnowledgeMatcherDeps = {
        knowledgeRepo: {
          search: vi.fn().mockResolvedValue({
            success: true,
            data: { items: [], total: 0, hasMore: false },
          }),
        } as any,
        professionalInsightRepo: {
          findApplicable: vi.fn().mockResolvedValue({
            success: false,
            error: new Error('Insight repo down'),
          }),
        } as any,
      };

      const outputs = createMockAgentOutputs();

      await expect(
        matchKnowledgeResources(outputs, deps)
      ).rejects.toThrow('Professional insight repo failed');
    });

    it('should handle missing TypeClassifier output gracefully', async () => {
      const pi = createMockProfessionalInsight({
        applicableStyles: ['architect'],
        applicableControlLevels: ['navigator'],
        priority: 5,
      });
      const ki = createMockKnowledgeItem();
      const deps = createMockDeps([ki], [pi]);
      const outputs = createMockAgentOutputs({
        typeClassifier: undefined, // No TypeClassifier output
      });

      const result = await matchKnowledgeResources(outputs, deps);

      expect(result.length).toBe(1);
      // Insight should still appear but without style/control boosts
      expect(result[0].professionalInsights[0].matchScore).toBe(5); // just priority, no boosts
    });

    it('should cap matchScore at 10', async () => {
      const pi = createMockProfessionalInsight({
        applicableStyles: ['architect'],
        applicableControlLevels: ['navigator'],
        priority: 9, // 9 + 2.0 + 1.5 = 12.5 → capped at 10
      });
      const ki = createMockKnowledgeItem();
      const deps = createMockDeps([ki], [pi]);
      const outputs = createMockAgentOutputs();

      const result = await matchKnowledgeResources(outputs, deps);

      expect(result[0].professionalInsights[0].matchScore).toBe(10);
    });
  });
});
