/**
 * Tests for Insight Generator (Phase 2)
 *
 * Tests the insight generation system including:
 * - Dimension quote extraction
 * - Insight prompt generation
 * - InsightGenerator class functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ParsedSession, ParsedMessage } from '../src/models/index.js';
import type {
  DimensionName,
  DimensionResult,
  EvidenceQuote,
} from '../src/models/unified-report.js';

// ============================================
// Import modules under test
// ============================================

import {
  extractDimensionQuotes,
  extractAllDimensionQuotes,
  toConversationInsight,
  toEvidenceQuote,
  type ExtractedQuote,
} from '../src/analyzer/dimension-quote-extractor.js';

import {
  generateAdvice,
  generateQuoteAdvice,
  formatProfessionalInsight,
  getDimensionDescription,
  generateInterpretation,
  buildInsightPrompt,
} from '../src/analyzer/insight-prompts.js';

import {
  InsightGenerator,
  createInsightGenerator,
  type GeneratedInsights,
} from '../src/analyzer/insight-generator.js';

import type { LinkedInsight } from '../src/analyzer/knowledge-linker.js';

// ============================================
// Test Helpers
// ============================================

function createMockSession(messages: Partial<ParsedMessage>[]): ParsedSession {
  return {
    sessionId: 'test-session-123',
    projectPath: '/test/project',
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T12:00:00Z'),
    messages: messages.map((m, i) => ({
      role: m.role ?? 'user',
      content: m.content ?? '',
      timestamp: m.timestamp ?? new Date(`2024-01-01T10:${String(i).padStart(2, '0')}:00Z`),
      toolCalls: m.toolCalls ?? [],
    })),
    stats: {
      messageCount: messages.length,
      userMessages: messages.filter((m) => m.role === 'user').length,
      assistantMessages: messages.filter((m) => m.role === 'assistant').length,
      toolCalls: 0,
      totalTokens: 1000,
    },
  };
}

function createMockDimensionResult(
  name: DimensionName,
  score: number
): DimensionResult {
  return {
    name,
    displayName: name,
    score,
    level: score >= 85 ? 'expert' : score >= 70 ? 'proficient' : score >= 50 ? 'developing' : 'novice',
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

function createMockLinkedInsight(): LinkedInsight {
  return {
    id: 'pi-test',
    title: 'Test Insight',
    keyTakeaway: 'This is a key takeaway for testing.',
    actionableAdvice: ['Do this first', 'Then do this', 'Finally do this'],
    source: {
      type: 'research',
      author: 'Test Author',
      url: 'https://example.com/test',
    },
    priority: 8,
  };
}

// ============================================
// dimension-quote-extractor.ts Tests
// ============================================

describe('dimension-quote-extractor', () => {
  describe('extractDimensionQuotes', () => {
    it('should extract aiCollaboration positive quotes', () => {
      const session = createMockSession([
        { role: 'user', content: "Let's start with planning the architecture before we implement anything." },
        { role: 'assistant', content: 'Good idea!' },
      ]);

      const quotes = extractDimensionQuotes([session], 'aiCollaboration', 5);

      expect(quotes.length).toBeGreaterThan(0);
      expect(quotes[0].dimension).toBe('aiCollaboration');
      expect(quotes[0].sentiment).toBe('positive');
    });

    it('should extract aiCollaboration negative quotes (minimal guidance)', () => {
      const session = createMockSession([
        { role: 'user', content: 'do it' },
        { role: 'assistant', content: 'Done!' },
      ]);

      const quotes = extractDimensionQuotes([session], 'aiCollaboration', 5);

      expect(quotes.length).toBeGreaterThan(0);
      expect(quotes[0].sentiment).toBe('negative');
    });

    it('should extract contextEngineering positive quotes', () => {
      const session = createMockSession([
        { role: 'user', content: "Here's the context: this file handles user authentication using JWT tokens." },
        { role: 'assistant', content: 'I understand.' },
      ]);

      const quotes = extractDimensionQuotes([session], 'contextEngineering', 5);

      expect(quotes.length).toBeGreaterThan(0);
      expect(quotes[0].sentiment).toBe('positive');
    });

    it('should extract aiControl positive quotes (corrections)', () => {
      const session = createMockSession([
        { role: 'user', content: "Wait, that looks wrong. Use a different approach instead." },
        { role: 'assistant', content: 'You are right.' },
      ]);

      const quotes = extractDimensionQuotes([session], 'aiControl', 5);

      expect(quotes.length).toBeGreaterThan(0);
      expect(quotes[0].sentiment).toBe('positive');
    });

    it('should extract aiControl negative quotes (passive acceptance)', () => {
      const session = createMockSession([
        { role: 'user', content: 'ok' },
        { role: 'assistant', content: 'Great!' },
      ]);

      const quotes = extractDimensionQuotes([session], 'aiControl', 5);

      expect(quotes.length).toBeGreaterThan(0);
      expect(quotes[0].sentiment).toBe('negative');
    });

    it('should extract burnoutRisk negative quotes (frustration)', () => {
      const session = createMockSession([
        { role: 'user', content: "I'm frustrated, nothing works anymore" },
        { role: 'assistant', content: 'Let me help.' },
      ]);

      const quotes = extractDimensionQuotes([session], 'burnoutRisk', 5);

      expect(quotes.length).toBeGreaterThan(0);
      expect(quotes[0].sentiment).toBe('negative');
    });

    it('should respect maxQuotes limit', () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        role: 'user' as const,
        content: `Let's start with step ${i + 1} of the plan before implementing.`,
      }));

      const session = createMockSession(messages);
      const quotes = extractDimensionQuotes([session], 'aiCollaboration', 3);

      expect(quotes.length).toBeLessThanOrEqual(3);
    });

    it('should filter duplicates', () => {
      const session = createMockSession([
        { role: 'user', content: "Let's start with planning the approach first." },
        { role: 'user', content: "Let's start with planning the approach first." },
        { role: 'user', content: "Let's start with planning the approach first." },
      ]);

      const quotes = extractDimensionQuotes([session], 'aiCollaboration', 10);

      expect(quotes.length).toBe(1);
    });
  });

  describe('extractAllDimensionQuotes', () => {
    it('should return a map with all 6 dimensions', () => {
      const session = createMockSession([
        { role: 'user', content: "Let's start with the plan first." },
      ]);

      const result = extractAllDimensionQuotes([session], 3);

      expect(result.size).toBe(6);
      expect(result.has('aiCollaboration')).toBe(true);
      expect(result.has('contextEngineering')).toBe(true);
      expect(result.has('toolMastery')).toBe(true);
      expect(result.has('burnoutRisk')).toBe(true);
      expect(result.has('aiControl')).toBe(true);
      expect(result.has('skillResilience')).toBe(true);
    });
  });

  describe('toConversationInsight', () => {
    it('should convert ExtractedQuote to ConversationInsight', () => {
      const quote: ExtractedQuote = {
        quote: 'Test quote',
        messageIndex: 5,
        dimension: 'aiCollaboration',
        sentiment: 'positive',
        explanation: 'Test explanation',
      };

      const insight = toConversationInsight(quote, 'This is good advice.');

      expect(insight.quote).toBe('Test quote');
      expect(insight.messageIndex).toBe(5);
      expect(insight.advice).toBe('This is good advice.');
      expect(insight.sentiment).toBe('praise');
    });

    it('should map negative sentiment to encouragement', () => {
      const quote: ExtractedQuote = {
        quote: 'Test',
        messageIndex: 0,
        dimension: 'aiControl',
        sentiment: 'negative',
        explanation: 'Passive',
      };

      const insight = toConversationInsight(quote, 'Try this.');

      expect(insight.sentiment).toBe('encouragement');
    });
  });

  describe('toEvidenceQuote', () => {
    it('should convert ExtractedQuote to EvidenceQuote', () => {
      const quote: ExtractedQuote = {
        quote: 'Test quote',
        messageIndex: 3,
        timestamp: '2024-01-01T10:00:00Z',
        dimension: 'contextEngineering',
        sentiment: 'positive',
        explanation: 'Good context',
      };

      const evidence = toEvidenceQuote(quote, 'strength', 'Custom analysis');

      expect(evidence.quote).toBe('Test quote');
      expect(evidence.messageIndex).toBe(3);
      expect(evidence.category).toBe('strength');
      expect(evidence.dimension).toBe('contextEngineering');
      expect(evidence.sentiment).toBe('positive');
      expect(evidence.analysis).toBe('Custom analysis');
    });
  });
});

// ============================================
// insight-prompts.ts Tests
// ============================================

describe('insight-prompts', () => {
  describe('generateAdvice', () => {
    it('should return reinforcement advice for strengths', () => {
      const advice = generateAdvice('aiCollaboration', 85, true);

      expect(typeof advice).toBe('string');
      expect(advice.length).toBeGreaterThan(20);
    });

    it('should return improvement advice for growth areas', () => {
      const advice = generateAdvice('aiCollaboration', 40, false);

      expect(typeof advice).toBe('string');
      expect(advice.length).toBeGreaterThan(20);
    });

    it('should work for all dimensions', () => {
      const dimensions: DimensionName[] = [
        'aiCollaboration',
        'contextEngineering',
        'toolMastery',
        'burnoutRisk',
        'aiControl',
        'skillResilience',
      ];

      for (const dim of dimensions) {
        const reinforcement = generateAdvice(dim, 80, true);
        const improvement = generateAdvice(dim, 40, false);

        expect(reinforcement.length).toBeGreaterThan(0);
        expect(improvement.length).toBeGreaterThan(0);
      }
    });
  });

  describe('generateQuoteAdvice', () => {
    it('should include strength prefix for positive sentiment', () => {
      const quote: ExtractedQuote = {
        quote: 'Good planning',
        messageIndex: 0,
        dimension: 'aiCollaboration',
        sentiment: 'positive',
        explanation: 'Shows planning',
      };

      const advice = generateQuoteAdvice('aiCollaboration', quote, true);

      expect(advice).toContain('This shows your strength');
    });

    it('should include notice prefix for negative sentiment', () => {
      const quote: ExtractedQuote = {
        quote: 'do it',
        messageIndex: 0,
        dimension: 'aiCollaboration',
        sentiment: 'negative',
        explanation: 'Minimal guidance',
      };

      const advice = generateQuoteAdvice('aiCollaboration', quote, false);

      expect(advice).toContain('Notice');
    });
  });

  describe('formatProfessionalInsight', () => {
    it('should format insight with key takeaway and action items', () => {
      const insight = createMockLinkedInsight();
      const formatted = formatProfessionalInsight(insight);

      expect(formatted).toContain('This is a key takeaway');
      expect(formatted).toContain('Try this:');
      expect(formatted).toContain('Do this first');
    });

    it('should limit action items to 2', () => {
      const insight = createMockLinkedInsight();
      const formatted = formatProfessionalInsight(insight);

      // Should not contain the third action item directly
      expect(formatted).not.toContain('Finally do this');
    });
  });

  describe('getDimensionDescription', () => {
    it('should return strength description for isStrength=true', () => {
      const desc = getDimensionDescription('aiCollaboration', true);

      expect(desc).toContain('excel');
    });

    it('should return growth description for isStrength=false', () => {
      const desc = getDimensionDescription('aiCollaboration', false);

      expect(desc).toContain('investment');
    });
  });

  describe('generateInterpretation', () => {
    it('should include level descriptor', () => {
      const interpretation = generateInterpretation('contextEngineering', 90, 'expert', true);

      expect(interpretation).toContain('expert-level mastery');
    });

    it('should include dimension name', () => {
      const interpretation = generateInterpretation('toolMastery', 60, 'developing', false);

      expect(interpretation.toLowerCase()).toContain('tool mastery');
    });
  });

  describe('buildInsightPrompt', () => {
    it('should build a complete prompt with quotes and insights', () => {
      const quotes: ExtractedQuote[] = [
        {
          quote: 'Test quote',
          messageIndex: 0,
          dimension: 'aiCollaboration',
          sentiment: 'positive',
          explanation: 'Good behavior',
        },
      ];
      const insights = [createMockLinkedInsight()];

      const prompt = buildInsightPrompt('aiCollaboration', 85, quotes, insights);

      expect(prompt).toContain('AI Collaboration Mastery');
      expect(prompt).toContain('85/100');
      expect(prompt).toContain('STRENGTH');
      expect(prompt).toContain('Test quote');
      expect(prompt).toContain('Test Insight');
    });

    it('should mark growth areas correctly', () => {
      const prompt = buildInsightPrompt('skillResilience', 40, [], []);

      expect(prompt).toContain('GROWTH AREA');
    });
  });
});

// ============================================
// insight-generator.ts Tests
// ============================================

describe('InsightGenerator', () => {
  let generator: InsightGenerator;

  beforeEach(() => {
    generator = new InsightGenerator();
  });

  describe('generateForDimension', () => {
    it('should generate insights for a strength dimension', async () => {
      const session = createMockSession([
        { role: 'user', content: "Let's start with planning before we code." },
      ]);

      const result = await generator.generateForDimension(
        'aiCollaboration',
        85,
        [session]
      );

      expect(result.dimension).toBe('aiCollaboration');
      expect(result.interpretation).toContain('expert-level mastery');
      expect(Array.isArray(result.insights)).toBe(true);
      expect(Array.isArray(result.evidence)).toBe(true);
    });

    it('should generate insights for a growth dimension', async () => {
      const session = createMockSession([
        { role: 'user', content: 'do it' },
      ]);

      const result = await generator.generateForDimension(
        'aiCollaboration',
        40,
        [session]
      );

      expect(result.dimension).toBe('aiCollaboration');
      expect(result.interpretation).toContain('beginning your journey');
    });

    it('should include research-based insights when available', async () => {
      const session = createMockSession([
        { role: 'user', content: "I know how to do this from my experience." },
      ]);

      const result = await generator.generateForDimension(
        'skillResilience',
        40,
        [session]
      );

      // MockKnowledgeSource provides professional insights
      const hasResearch = result.insights.some((i) => i.researchBased !== undefined);
      expect(hasResearch).toBe(true);
    });
  });

  describe('generateForAllDimensions', () => {
    it('should generate insights for all 6 dimensions', async () => {
      const dimensions: DimensionResult[] = [
        createMockDimensionResult('aiCollaboration', 85),
        createMockDimensionResult('contextEngineering', 75),
        createMockDimensionResult('toolMastery', 60),
        createMockDimensionResult('burnoutRisk', 45),
        createMockDimensionResult('aiControl', 80),
        createMockDimensionResult('skillResilience', 30),
      ];

      const session = createMockSession([
        { role: 'user', content: "Let's plan this out first." },
      ]);

      const results = await generator.generateForAllDimensions(dimensions, [session]);

      expect(results.size).toBe(6);
      expect(results.has('aiCollaboration')).toBe(true);
      expect(results.has('skillResilience')).toBe(true);
    });

    it('should preserve dimension level from input', async () => {
      const dimensions: DimensionResult[] = [
        createMockDimensionResult('aiCollaboration', 90),
      ];

      const session = createMockSession([]);
      const results = await generator.generateForAllDimensions(dimensions, [session]);
      const aiCollab = results.get('aiCollaboration');

      expect(aiCollab).toBeDefined();
      expect(aiCollab!.interpretation).toBeDefined();
    });
  });

  describe('generateEvidence', () => {
    it('should generate evidence quotes from sessions', async () => {
      const dimensions: DimensionResult[] = [
        createMockDimensionResult('aiCollaboration', 85),
        createMockDimensionResult('contextEngineering', 40),
      ];

      const session = createMockSession([
        { role: 'user', content: "Let's start with the plan." },
        { role: 'user', content: "Here's the context for this file." },
      ]);

      const evidence = await generator.generateEvidence(dimensions, [session], 10);

      expect(Array.isArray(evidence)).toBe(true);
    });

    it('should respect maxEvidence limit', async () => {
      const dimensions: DimensionResult[] = [
        createMockDimensionResult('aiCollaboration', 85),
        createMockDimensionResult('contextEngineering', 85),
        createMockDimensionResult('toolMastery', 85),
      ];

      const messages = Array.from({ length: 50 }, (_, i) => ({
        role: 'user' as const,
        content: `Let's start with step ${i + 1} of the planning process.`,
      }));

      const session = createMockSession(messages);
      const evidence = await generator.generateEvidence(dimensions, [session], 5);

      expect(evidence.length).toBeLessThanOrEqual(5);
    });

    it('should sort by category (strength first)', async () => {
      const dimensions: DimensionResult[] = [
        createMockDimensionResult('aiCollaboration', 85), // strength
        createMockDimensionResult('burnoutRisk', 30), // growth (frustration)
      ];

      const session = createMockSession([
        { role: 'user', content: "Let's plan this carefully first." },
        { role: 'user', content: "I'm frustrated, this keeps failing." },
      ]);

      const evidence = await generator.generateEvidence(dimensions, [session], 10);

      if (evidence.length >= 2) {
        // First items should be strengths
        const firstStrength = evidence.findIndex((e) => e.category === 'strength');
        const firstGrowth = evidence.findIndex((e) => e.category === 'growth');

        if (firstStrength !== -1 && firstGrowth !== -1) {
          expect(firstStrength).toBeLessThan(firstGrowth);
        }
      }
    });
  });

  describe('configuration', () => {
    it('should respect maxInsightsPerDimension config', async () => {
      const customGenerator = new InsightGenerator(undefined, {
        maxInsightsPerDimension: 1,
      });

      const session = createMockSession([
        { role: 'user', content: "Let's plan this out." },
      ]);

      const result = await customGenerator.generateForDimension(
        'skillResilience',
        40,
        [session]
      );

      expect(result.insights.length).toBeLessThanOrEqual(1);
    });

    it('should respect includeResearchInsights config', async () => {
      const customGenerator = new InsightGenerator(undefined, {
        includeResearchInsights: false,
      });

      const session = createMockSession([
        { role: 'user', content: "I understand how this works from experience." },
      ]);

      const result = await customGenerator.generateForDimension(
        'skillResilience',
        40,
        [session]
      );

      const hasResearch = result.insights.some((i) => i.researchBased !== undefined);
      expect(hasResearch).toBe(false);
    });
  });
});

describe('createInsightGenerator', () => {
  it('should create an InsightGenerator instance', () => {
    const generator = createInsightGenerator();

    expect(generator).toBeInstanceOf(InsightGenerator);
  });

  it('should accept custom config', () => {
    const generator = createInsightGenerator(undefined, {
      maxInsightsPerDimension: 5,
      maxQuotesPerDimension: 10,
    });

    expect(generator).toBeInstanceOf(InsightGenerator);
  });
});
