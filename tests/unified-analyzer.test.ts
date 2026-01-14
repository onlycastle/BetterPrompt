/**
 * Unified Analyzer Tests (Phase 3)
 *
 * Tests the complete analysis pipeline including:
 * - Pattern-based dimension analysis
 * - Type detection
 * - Insight generation and injection
 * - UnifiedReport generation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ParsedSession, ParsedMessage } from '../src/models/index.js';
import type { DimensionName, UnifiedReport } from '../src/models/unified-report.js';
import {
  UnifiedAnalyzer,
  createUnifiedAnalyzer,
  analyzeUnified,
  type UnifiedAnalyzerConfig,
} from '../src/analyzer/unified-analyzer.js';
import { MockKnowledgeSource, createKnowledgeLinker } from '../src/analyzer/knowledge-linker.js';

// ============================================
// Test Helpers
// ============================================

function createMockMessage(
  role: 'user' | 'assistant',
  content: string,
  toolCalls: { name: string; input: Record<string, unknown> }[] = []
): ParsedMessage {
  return {
    role,
    content,
    timestamp: new Date(),
    toolCalls,
  };
}

function createMockSession(messages: ParsedMessage[], overrides?: Partial<ParsedSession>): ParsedSession {
  const userMessages = messages.filter((m) => m.role === 'user');
  const assistantMessages = messages.filter((m) => m.role === 'assistant');

  return {
    sessionId: 'test-session-123',
    projectPath: '/test/project',
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T12:00:00Z'),
    durationSeconds: 7200,
    messages,
    stats: {
      messageCount: messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      toolCalls: messages.reduce((sum, m) => sum + (m.toolCalls?.length || 0), 0),
      totalTokens: 5000,
    },
    ...overrides,
  };
}

function createTypicalSession(): ParsedSession {
  return createMockSession([
    createMockMessage('user', 'Let me break this down step by step. First, I need to understand the current architecture.'),
    createMockMessage('assistant', 'I\'ll help you understand the architecture. Let me read the relevant files.', [
      { name: 'Read', input: { path: '/src/index.ts' } },
      { name: 'Glob', input: { pattern: '**/*.ts' } },
    ]),
    createMockMessage('user', 'Can you explain how the authentication flow works? I want to make sure I understand before making changes.'),
    createMockMessage('assistant', 'Here\'s how the authentication flow works...', [
      { name: 'Read', input: { path: '/src/auth/index.ts' } },
    ]),
    createMockMessage('user', 'Great, that makes sense. Now let\'s implement the new feature. Here are my requirements: 1. Add OAuth support 2. Keep backward compatibility 3. Add proper error handling'),
    createMockMessage('assistant', 'I\'ll implement the OAuth feature with those requirements.', [
      { name: 'Write', input: { path: '/src/auth/oauth.ts' } },
      { name: 'Edit', input: { path: '/src/auth/index.ts' } },
    ]),
    createMockMessage('user', 'Looks good! Can you also add tests for this?'),
    createMockMessage('assistant', 'I\'ll add comprehensive tests.', [
      { name: 'Write', input: { path: '/tests/auth/oauth.test.ts' } },
      { name: 'Bash', input: { command: 'npm test' } },
    ]),
  ]);
}

function createMinimalSession(): ParsedSession {
  return createMockSession([
    createMockMessage('user', 'Fix the bug'),
    createMockMessage('assistant', 'Done.', [
      { name: 'Edit', input: { path: '/src/bug.ts' } },
    ]),
  ]);
}

function createAnalyzerWithMockKB(config?: Partial<UnifiedAnalyzerConfig>): UnifiedAnalyzer {
  const mockKnowledgeSource = new MockKnowledgeSource();
  const knowledgeLinker = createKnowledgeLinker(mockKnowledgeSource);
  return createUnifiedAnalyzer({
    knowledgeLinker,
    ...config,
  });
}

// ============================================
// UnifiedAnalyzer Class Tests
// ============================================

describe('UnifiedAnalyzer', () => {
  describe('constructor', () => {
    it('should create analyzer with default config', () => {
      const analyzer = createUnifiedAnalyzer();
      expect(analyzer).toBeInstanceOf(UnifiedAnalyzer);
    });

    it('should create analyzer with custom config', () => {
      const analyzer = createAnalyzerWithMockKB({
        tier: 'premium',
        skipInsights: false,
      });
      expect(analyzer).toBeInstanceOf(UnifiedAnalyzer);
    });

    it('should create analyzer with skipInsights option', () => {
      const analyzer = createUnifiedAnalyzer({ skipInsights: true });
      expect(analyzer).toBeInstanceOf(UnifiedAnalyzer);
    });
  });

  describe('analyze', () => {
    let analyzer: UnifiedAnalyzer;

    beforeEach(() => {
      analyzer = createAnalyzerWithMockKB();
    });

    it('should analyze a typical session and return UnifiedReport', async () => {
      const session = createTypicalSession();
      const result = await analyzer.analyze([session]);

      expect(result.report).toBeDefined();
      expect(result.report.id).toBeDefined();
      expect(result.report.createdAt).toBeDefined();
      expect(result.report.sessionsAnalyzed).toBe(1);
    });

    it('should include all 6 dimensions', async () => {
      const session = createTypicalSession();
      const result = await analyzer.analyze([session]);

      expect(result.report.dimensions).toHaveLength(6);

      const dimensionNames = result.report.dimensions.map((d) => d.name);
      expect(dimensionNames).toContain('aiCollaboration');
      expect(dimensionNames).toContain('contextEngineering');
      expect(dimensionNames).toContain('toolMastery');
      expect(dimensionNames).toContain('burnoutRisk');
      expect(dimensionNames).toContain('aiControl');
      expect(dimensionNames).toContain('skillResilience');
    });

    it('should inject insights into dimensions', async () => {
      const session = createTypicalSession();
      const result = await analyzer.analyze([session]);

      // At least some dimensions should have insights
      const dimensionsWithInsights = result.report.dimensions.filter(
        (d) => d.insights.length > 0
      );
      expect(dimensionsWithInsights.length).toBeGreaterThan(0);
    });

    it('should generate profile with coding style', async () => {
      const session = createTypicalSession();
      const result = await analyzer.analyze([session]);

      expect(result.report.profile).toBeDefined();
      expect(result.report.profile.primaryType).toBeDefined();
      expect(result.report.profile.controlLevel).toBeDefined();
      expect(result.report.profile.matrixName).toBeDefined();
      expect(result.report.profile.distribution).toBeDefined();
    });

    it('should generate summary with strengths and growth areas', async () => {
      const session = createTypicalSession();
      const result = await analyzer.analyze([session]);

      expect(result.report.summary).toBeDefined();
      expect(result.report.summary.topStrengths.length).toBeGreaterThan(0);
      expect(result.report.summary.topGrowthAreas.length).toBeGreaterThan(0);
      expect(result.report.summary.overallMessage).toBeDefined();
    });

    it('should include evidence quotes', async () => {
      const session = createTypicalSession();
      const result = await analyzer.analyze([session]);

      expect(result.report.evidence).toBeDefined();
      expect(result.report.evidence.length).toBeGreaterThan(0);
    });

    it('should generate recommendations', async () => {
      const session = createTypicalSession();
      const result = await analyzer.analyze([session]);

      expect(result.report.recommendations).toBeDefined();
      expect(result.report.recommendations.length).toBeGreaterThan(0);
    });

    it('should return raw analysis results', async () => {
      const session = createTypicalSession();
      const result = await analyzer.analyze([session]);

      expect(result.dimensions).toBeDefined();
      expect(result.typeResult).toBeDefined();
      expect(result.insights).toBeDefined();
    });

    it('should throw error for empty sessions', async () => {
      await expect(analyzer.analyze([])).rejects.toThrow(
        'At least one session is required'
      );
    });

    it('should handle multiple sessions', async () => {
      const sessions = [createTypicalSession(), createMinimalSession()];
      const result = await analyzer.analyze(sessions);

      expect(result.report.sessionsAnalyzed).toBeGreaterThanOrEqual(1);
    });

    it('should respect tier option', async () => {
      const session = createTypicalSession();
      const result = await analyzer.analyze([session], { tier: 'premium' });

      expect(result.report.tier).toBe('premium');
    });
  });

  describe('analyze with skipInsights', () => {
    it('should skip insight generation when skipInsights is true', async () => {
      const analyzer = createAnalyzerWithMockKB({ skipInsights: true });
      const session = createTypicalSession();
      const result = await analyzer.analyze([session]);

      // Dimensions should have empty insights
      const hasInsights = result.report.dimensions.some((d) => d.insights.length > 0);
      expect(hasInsights).toBe(false);
    });
  });

  describe('generateInsights', () => {
    let analyzer: UnifiedAnalyzer;

    beforeEach(() => {
      analyzer = createAnalyzerWithMockKB();
    });

    it('should generate insights for dimension results', async () => {
      const session = createTypicalSession();
      const result = await analyzer.analyze([session]);

      const insights = await analyzer.generateInsights(result.report.dimensions, [session]);

      expect(insights).toBeInstanceOf(Map);
      expect(insights.size).toBeGreaterThan(0);
    });
  });
});

// ============================================
// Factory Function Tests
// ============================================

describe('createUnifiedAnalyzer', () => {
  it('should create a UnifiedAnalyzer instance', () => {
    const analyzer = createUnifiedAnalyzer();
    expect(analyzer).toBeInstanceOf(UnifiedAnalyzer);
  });

  it('should accept custom config', () => {
    const analyzer = createUnifiedAnalyzer({
      tier: 'enterprise',
      skipInsights: true,
    });
    expect(analyzer).toBeInstanceOf(UnifiedAnalyzer);
  });
});

describe('analyzeUnified', () => {
  it('should analyze sessions and return UnifiedReport', async () => {
    const mockKnowledgeSource = new MockKnowledgeSource();
    const knowledgeLinker = createKnowledgeLinker(mockKnowledgeSource);
    const session = createTypicalSession();

    const report = await analyzeUnified([session], { knowledgeLinker });

    expect(report).toBeDefined();
    expect(report.id).toBeDefined();
    expect(report.dimensions).toHaveLength(6);
    expect(report.profile).toBeDefined();
  });
});

// ============================================
// Type Detection Tests
// ============================================

describe('Type Detection Integration', () => {
  it('should detect architect type for structured prompts', async () => {
    const session = createMockSession([
      createMockMessage(
        'user',
        'Let me outline the requirements first. We need: 1. User authentication 2. Data validation 3. Error handling 4. Comprehensive logging 5. Unit tests'
      ),
      createMockMessage('assistant', 'I understand.', [
        { name: 'Task', input: { task: 'plan implementation' } },
        { name: 'Plan', input: {} },
      ]),
    ]);

    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    // Architect or similar planning type should be detected
    expect(result.typeResult.primaryType).toBeDefined();
    expect(result.typeResult.distribution.architect).toBeGreaterThan(0);
  });

  it('should detect speedrunner type for short prompts', async () => {
    const session = createMockSession([
      createMockMessage('user', 'fix it'),
      createMockMessage('assistant', 'Done.', [
        { name: 'Bash', input: { command: 'npm run fix' } },
        { name: 'Write', input: { path: '/fix.ts' } },
      ]),
      createMockMessage('user', 'next'),
      createMockMessage('assistant', 'Done.', [
        { name: 'Bash', input: { command: 'npm test' } },
      ]),
    ]);

    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    expect(result.typeResult.distribution.speedrunner).toBeGreaterThan(0);
  });

  it('should detect scientist type for question-heavy sessions', async () => {
    const session = createMockSession([
      createMockMessage('user', 'Why does this function return null? How does this work? What is the purpose of this variable?'),
      createMockMessage('assistant', 'Let me explain...', [
        { name: 'Read', input: { path: '/src/function.ts' } },
        { name: 'Grep', input: { pattern: 'null' } },
      ]),
      createMockMessage('user', 'Why is that? How can we improve it? What are the alternatives?'),
      createMockMessage('assistant', 'Here are the reasons...', [
        { name: 'Read', input: { path: '/src/another.ts' } },
      ]),
    ]);

    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    expect(result.typeResult.distribution.scientist).toBeGreaterThan(0);
  });
});

// ============================================
// Dimension Analysis Tests
// ============================================

describe('Dimension Analysis Integration', () => {
  it('should calculate all 6 dimensions', async () => {
    const session = createTypicalSession();
    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    expect(result.dimensions.aiCollaboration).toBeDefined();
    expect(result.dimensions.contextEngineering).toBeDefined();
    expect(result.dimensions.burnoutRisk).toBeDefined();
    expect(result.dimensions.toolMastery).toBeDefined();
    expect(result.dimensions.aiControl).toBeDefined();
    expect(result.dimensions.skillResilience).toBeDefined();
  });

  it('should mark high-scoring dimensions as strengths', async () => {
    const session = createTypicalSession();
    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    // Dimensions with score >= 70 should be marked as strengths
    for (const dim of result.report.dimensions) {
      if (dim.score >= 70) {
        expect(dim.isStrength).toBe(true);
      } else {
        expect(dim.isStrength).toBe(false);
      }
    }
  });

  it('should include dimension breakdown', async () => {
    const session = createTypicalSession();
    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    for (const dim of result.report.dimensions) {
      expect(dim.breakdown).toBeDefined();
      expect(Object.keys(dim.breakdown).length).toBeGreaterThan(0);
    }
  });

  it('should include dimension highlights', async () => {
    const session = createTypicalSession();
    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    for (const dim of result.report.dimensions) {
      expect(dim.highlights).toBeDefined();
      expect(dim.highlights.strengths).toBeDefined();
      expect(dim.highlights.growthAreas).toBeDefined();
    }
  });
});

// ============================================
// Insight Integration Tests
// ============================================

describe('Insight Integration', () => {
  it('should return insights map keyed by dimension name', async () => {
    const session = createTypicalSession();
    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    expect(result.insights).toBeInstanceOf(Map);

    for (const key of result.insights.keys()) {
      expect([
        'aiCollaboration',
        'contextEngineering',
        'toolMastery',
        'burnoutRisk',
        'aiControl',
        'skillResilience',
      ]).toContain(key);
    }
  });

  it('should include interpretation in generated insights', async () => {
    const session = createTypicalSession();
    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    for (const insight of result.insights.values()) {
      expect(insight.interpretation).toBeDefined();
      expect(insight.interpretation.length).toBeGreaterThan(0);
    }
  });
});

// ============================================
// Report Validation Tests
// ============================================

describe('Report Validation', () => {
  it('should generate valid UUID for report id', async () => {
    const session = createTypicalSession();
    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(result.report.id).toMatch(uuidRegex);
  });

  it('should generate ISO datetime for createdAt', async () => {
    const session = createTypicalSession();
    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    expect(result.report.createdAt).toMatch(isoDateRegex);
  });

  it('should have valid tier value', async () => {
    const session = createTypicalSession();
    const analyzer = createAnalyzerWithMockKB({ tier: 'pro' });
    const result = await analyzer.analyze([session]);

    expect(['free', 'pro', 'premium', 'enterprise']).toContain(result.report.tier);
  });

  it('should have dimension scores in valid range', async () => {
    const session = createTypicalSession();
    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    for (const dim of result.report.dimensions) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
    }
  });

  it('should have valid dimension levels', async () => {
    const session = createTypicalSession();
    const analyzer = createAnalyzerWithMockKB();
    const result = await analyzer.analyze([session]);

    for (const dim of result.report.dimensions) {
      expect(['novice', 'developing', 'proficient', 'expert']).toContain(dim.level);
    }
  });
});
