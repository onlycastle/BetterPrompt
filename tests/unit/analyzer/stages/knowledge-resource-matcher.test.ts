/**
 * Tests for Knowledge Resource Matcher (Phase 2.75)
 *
 * Two-level matching: Dimension filter, then tag/style/control level boosts.
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

interface GrowthAreaInsight {
  title: string;
  description: string;
  recommendation: string;
  dimension: string;
}

function createMockKnowledgeItem(overrides: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    id: 'ki-1',
    version: '1.0.0',
    title: 'Test Knowledge Item',
    summary: 'A summary of test knowledge',
    content: 'Detailed content about testing',
    applicableDimensions: ['KnowledgeGap'],
    subCategories: undefined,
    contentType: 'technique',
    tags: ['typescript', 'generics'],
    source: { platform: 'web', url: 'https://example.com/article', author: 'Test Author', fetchedAt: '2025-01-01T00:00:00Z' },
    relevance: { score: 0.8, confidence: 0.9, reasoning: 'Highly relevant' },
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
    source: { type: 'blog', url: 'https://example.com/insight', author: 'Insight Author' },
    applicableStyles: ['architect'],
    applicableControlLevels: ['navigator'],
    applicableDimensions: ['KnowledgeGap'],
    priority: 7,
    enabled: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  } as ProfessionalInsight;
}

function createMockGrowthArea(overrides: Partial<GrowthAreaInsight> = {}): GrowthAreaInsight {
  return {
    title: 'Knowledge Gap Pattern',
    description: 'Developer often lacks understanding of TypeScript generics',
    recommendation: 'Study TypeScript handbook generics section',
    dimension: 'KnowledgeGap',
    ...overrides,
  };
}

function createMockDeps(knowledgeItems: KnowledgeItem[] = [], professionalInsights: ProfessionalInsight[] = []): KnowledgeMatcherDeps {
  return {
    knowledgeRepo: {
      search: vi.fn().mockResolvedValue({ success: true, data: { items: knowledgeItems, total: knowledgeItems.length, hasMore: false } }),
      save: vi.fn(), saveBatch: vi.fn(), findById: vi.fn(), fullTextSearch: vi.fn(), getStats: vi.fn(), update: vi.fn(), updateStatus: vi.fn(), delete: vi.fn(), existsByUrl: vi.fn(), findSimilar: vi.fn(),
    } as KnowledgeMatcherDeps['knowledgeRepo'],
    professionalInsightRepo: {
      findApplicable: vi.fn().mockResolvedValue({ success: true, data: professionalInsights }),
      findEnabled: vi.fn(), findWithFilters: vi.fn(), findById: vi.fn(), save: vi.fn(), saveBatch: vi.fn(), update: vi.fn(), setEnabled: vi.fn(), delete: vi.fn(), countByCategory: vi.fn(),
    } as KnowledgeMatcherDeps['professionalInsightRepo'],
  };
}

function createMockAgentOutputs(overrides: Partial<AgentOutputs> = {}): AgentOutputs {
  return {
    learningBehavior: {
      knowledgeGaps: [{ topic: 'TypeScript generics', questionCount: 5, depth: 'shallow', example: 'How do I use generic constraints?' }],
      learningProgress: [],
      recommendedResources: [],
      repeatedMistakePatterns: [],
      topInsights: [],
      overallLearningScore: 70,
      confidenceScore: 0.8,
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
      const ctx = extractMatchingContext(createMockAgentOutputs());
      expect(ctx.primaryType).toBe('architect');
      expect(ctx.controlLevel).toBe('navigator');
    });

    it('should group growth areas by dimension from v3 workers', () => {
      const outputs = createMockAgentOutputs({
        thinkingQuality: {
          planningHabits: [],
          planQualityScore: 70,
          verificationBehavior: { level: 'minimal_verification', examples: [], recommendation: '' },
          criticalThinkingMoments: [],
          verificationAntiPatterns: [
            { type: 'blind_acceptance', frequency: 5, severity: 'moderate', examples: [], improvement: 'Review before accepting' },
            { type: 'passive_acceptance', frequency: 3, severity: 'low', examples: [], improvement: 'Ask questions' },
          ],
          communicationPatterns: [],
          overallThinkingQualityScore: 65,
          confidenceScore: 0.75,
        },
        learningBehavior: {
          knowledgeGaps: [{ topic: 'TypeScript', questionCount: 3, depth: 'shallow', example: 'generics question' }],
          learningProgress: [],
          recommendedResources: [],
          repeatedMistakePatterns: [],
          topInsights: [],
          overallLearningScore: 70,
          confidenceScore: 0.8,
        },
      });
      const ctx = extractMatchingContext(outputs);
      expect(ctx.growthAreasByDimension.size).toBe(2);
      expect(ctx.growthAreasByDimension.get('TrustVerification')?.length).toBe(2);
      expect(ctx.growthAreasByDimension.get('KnowledgeGap')?.length).toBe(1);
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
        applicableDimensions: ['KnowledgeGap'],  // v3 dimension
        tags: ['typescript', 'generics'],
      });
      const pi = createMockProfessionalInsight({
        applicableDimensions: ['KnowledgeGap'],  // v3 dimension
      });
      const deps = createMockDeps([ki], [pi]);
      const outputs = createMockAgentOutputs();

      const result = await matchKnowledgeResources(outputs, deps);

      expect(result.length).toBe(1);
      expect(result[0].dimension).toBe('KnowledgeGap');
      // v3 dimensions fallback to raw name when no DIMENSION_DISPLAY_NAMES mapping exists
      expect(result[0].dimensionDisplayName).toBe('KnowledgeGap');
      expect(result[0].knowledgeItems.length).toBe(1);
      expect(result[0].professionalInsights.length).toBe(1);
    });

    it('should filter out knowledge items not matching dimension', async () => {
      const ki = createMockKnowledgeItem({
        applicableDimensions: ['TrustVerification'],  // Does NOT match KnowledgeGap
        tags: ['typescript', 'generics'],
      });
      const deps = createMockDeps([ki], []);
      const outputs = createMockAgentOutputs();

      const result = await matchKnowledgeResources(outputs, deps);

      // Dimension KnowledgeGap has growth areas but no matching knowledge items
      // and no professional insights → filtered out
      expect(result.length).toBe(0);
    });

    it('should rank knowledge items with matching tags higher', async () => {
      const kiHigh = createMockKnowledgeItem({ id: 'ki-high', applicableDimensions: ['KnowledgeGap'], tags: ['typescript', 'generics'], relevance: { score: 0.5, confidence: 0.9, reasoning: 'Test' } });
      const kiLow = createMockKnowledgeItem({ id: 'ki-low', applicableDimensions: ['KnowledgeGap'], tags: ['unrelated-tag'], relevance: { score: 0.5, confidence: 0.9, reasoning: 'Test' } });
      const deps = createMockDeps([kiLow, kiHigh], []);

      const result = await matchKnowledgeResources(createMockAgentOutputs(), deps);

      expect(result.length).toBe(1);
      expect(result[0].knowledgeItems.length).toBe(2);
      expect(result[0].knowledgeItems[0].id).toBe('ki-high');
      expect(result[0].knowledgeItems[0].matchScore).toBeGreaterThan(result[0].knowledgeItems[1].matchScore);
    });

    it('should boost professional insights matching primaryType', async () => {
      const piMatch = createMockProfessionalInsight({ id: 'pi-style-match', applicableStyles: ['architect'], applicableControlLevels: [], priority: 5 });
      const piNoMatch = createMockProfessionalInsight({ id: 'pi-no-match', applicableStyles: ['speedrunner'], applicableControlLevels: [], priority: 5 });
      const deps = createMockDeps([createMockKnowledgeItem()], [piNoMatch, piMatch]);

      const result = await matchKnowledgeResources(createMockAgentOutputs(), deps);

      expect(result.length).toBe(1);
      expect(result[0].professionalInsights.length).toBe(2);
      expect(result[0].professionalInsights[0].id).toBe('pi-style-match');
      expect(result[0].professionalInsights[0].matchScore).toBeGreaterThan(result[0].professionalInsights[1].matchScore);
    });

    it('should boost professional insights matching controlLevel', async () => {
      const piMatch = createMockProfessionalInsight({ id: 'pi-control-match', applicableStyles: [], applicableControlLevels: ['navigator'], priority: 5 });
      const piNoMatch = createMockProfessionalInsight({ id: 'pi-no-control', applicableStyles: [], applicableControlLevels: ['explorer'], priority: 5 });
      const deps = createMockDeps([createMockKnowledgeItem()], [piNoMatch, piMatch]);

      const result = await matchKnowledgeResources(createMockAgentOutputs(), deps);

      expect(result.length).toBe(1);
      expect(result[0].professionalInsights[0].id).toBe('pi-control-match');
    });

    it('should handle subCategory matching', async () => {
      const ki = createMockKnowledgeItem({ applicableDimensions: ['KnowledgeGap'], subCategories: { KnowledgeGap: ['typescript', 'generics'] } as Record<string, string[]>, tags: [], relevance: { score: 0.5, confidence: 0.9, reasoning: 'Test' } });
      const kiNoSub = createMockKnowledgeItem({ id: 'ki-no-sub', applicableDimensions: ['KnowledgeGap'], subCategories: undefined, tags: [], relevance: { score: 0.5, confidence: 0.9, reasoning: 'Test' } });
      const deps = createMockDeps([kiNoSub, ki], []);

      const result = await matchKnowledgeResources(createMockAgentOutputs(), deps);

      expect(result.length).toBe(1);
      expect(result[0].knowledgeItems[0].id).toBe('ki-1');
    });

    it('should handle multiple dimensions', async () => {
      const kiKnowledge = createMockKnowledgeItem({ id: 'ki-knowledge', applicableDimensions: ['KnowledgeGap'] });
      const kiWorkflow = createMockKnowledgeItem({ id: 'ki-workflow', applicableDimensions: ['WorkflowHabit'] });
      const deps: KnowledgeMatcherDeps = {
        knowledgeRepo: { search: vi.fn().mockResolvedValue({ success: true, data: { items: [kiKnowledge, kiWorkflow], total: 2, hasMore: false } }) } as KnowledgeMatcherDeps['knowledgeRepo'],
        professionalInsightRepo: { findApplicable: vi.fn().mockResolvedValue({ success: true, data: [] }) } as KnowledgeMatcherDeps['professionalInsightRepo'],
      };
      const outputs = createMockAgentOutputs({
        learningBehavior: {
          knowledgeGaps: [{ topic: 'TypeScript', questionCount: 3, depth: 'shallow', example: 'generics' }],
          learningProgress: [],
          recommendedResources: [],
          repeatedMistakePatterns: [{ category: 'debugging', mistakeType: 'missing_logs', occurrenceCount: 4, exampleUtteranceIds: [], recommendation: 'Add logging' }],
          topInsights: [],
          overallLearningScore: 70,
          confidenceScore: 0.8,
        },
      });

      const result = await matchKnowledgeResources(outputs, deps);

      expect(result.length).toBe(2);
      expect(result.map(r => r.dimension)).toContain('KnowledgeGap');
      expect(result.map(r => r.dimension)).toContain('WorkflowHabit');
    });

    it('should sort items by matchScore descending', async () => {
      const items = [
        createMockKnowledgeItem({ id: 'ki-low', applicableDimensions: ['KnowledgeGap'], tags: [], relevance: { score: 0.2, confidence: 0.9, reasoning: 'Low' } }),
        createMockKnowledgeItem({ id: 'ki-high', applicableDimensions: ['KnowledgeGap'], tags: ['typescript'], relevance: { score: 0.9, confidence: 0.9, reasoning: 'High' } }),
        createMockKnowledgeItem({ id: 'ki-mid', applicableDimensions: ['KnowledgeGap'], tags: [], relevance: { score: 0.5, confidence: 0.9, reasoning: 'Mid' } }),
      ];
      const deps = createMockDeps(items, []);

      const result = await matchKnowledgeResources(createMockAgentOutputs(), deps);

      expect(result[0].knowledgeItems[0].id).toBe('ki-high');
      expect(result[0].knowledgeItems[2].id).toBe('ki-low');
      const scores = result[0].knowledgeItems.map(i => i.matchScore);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }
    });

    it('should propagate errors from knowledge repo (No Fallback Policy)', async () => {
      const deps: KnowledgeMatcherDeps = {
        knowledgeRepo: { search: vi.fn().mockResolvedValue({ success: false, error: new Error('Connection failed') }) } as KnowledgeMatcherDeps['knowledgeRepo'],
        professionalInsightRepo: { findApplicable: vi.fn() } as KnowledgeMatcherDeps['professionalInsightRepo'],
      };

      await expect(matchKnowledgeResources(createMockAgentOutputs(), deps)).rejects.toThrow('Knowledge repo search failed');
    });

    it('should propagate errors from professional insight repo (No Fallback Policy)', async () => {
      const deps: KnowledgeMatcherDeps = {
        knowledgeRepo: { search: vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0, hasMore: false } }) } as KnowledgeMatcherDeps['knowledgeRepo'],
        professionalInsightRepo: { findApplicable: vi.fn().mockResolvedValue({ success: false, error: new Error('Insight repo down') }) } as KnowledgeMatcherDeps['professionalInsightRepo'],
      };

      await expect(matchKnowledgeResources(createMockAgentOutputs(), deps)).rejects.toThrow('Professional insight repo failed');
    });

    it('should handle missing TypeClassifier output gracefully', async () => {
      const pi = createMockProfessionalInsight({ applicableStyles: ['architect'], applicableControlLevels: ['navigator'], priority: 5 });
      const deps = createMockDeps([createMockKnowledgeItem()], [pi]);

      const result = await matchKnowledgeResources(createMockAgentOutputs({ typeClassifier: undefined }), deps);

      expect(result.length).toBe(1);
      expect(result[0].professionalInsights[0].matchScore).toBe(5);
    });

    it('should cap matchScore at 10', async () => {
      const pi = createMockProfessionalInsight({ applicableStyles: ['architect'], applicableControlLevels: ['navigator'], priority: 9 });
      const deps = createMockDeps([createMockKnowledgeItem()], [pi]);

      const result = await matchKnowledgeResources(createMockAgentOutputs(), deps);

      expect(result[0].professionalInsights[0].matchScore).toBe(10);
    });
  });
});
