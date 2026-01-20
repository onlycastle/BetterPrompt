/**
 * PatternDetectiveWorker Tests
 *
 * Tests for Phase 2 PatternDetectiveWorker (Wow Agent 1).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerContext } from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { PatternDetectiveOutput } from '../../../../src/lib/models/agent-outputs.js';

// Mock the GeminiClient
vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

// Mock the session formatter
vi.mock('../../../../src/lib/analyzer/shared/session-formatter.js', () => ({
  formatSessionsForAnalysis: vi.fn().mockReturnValue('formatted sessions'),
}));

// Import after mocking
import {
  PatternDetectiveWorker,
  createPatternDetectiveWorker,
  type PatternDetectiveWorkerConfig,
} from '../../../../src/lib/analyzer/workers/pattern-detective-worker.js';
import { GeminiClient } from '../../../../src/lib/analyzer/clients/gemini-client.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockContext(tier: 'free' | 'premium' | 'enterprise' = 'premium'): WorkerContext {
  return {
    sessions: [
      {
        sessionId: 'session-1',
        startedAt: new Date('2024-01-01T10:00:00Z'),
        turns: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Can you help me with React?' }],
          },
        ],
      },
    ],
    metrics: {
      totalSessions: 1,
      totalTurns: 10,
      averageTurnsPerSession: 10,
      sessionDurations: [3600000],
      averageSessionDuration: 3600000,
    },
    tier,
    moduleAOutput: {
      typeAnalysis: {
        primaryType: 'architect',
        controlLevel: 'ai-master',
        distribution: {
          architect: 40,
          scientist: 20,
          collaborator: 20,
          speedrunner: 10,
          craftsman: 10,
        },
        reasoning: 'Test',
      },
      extractedQuotes: [],
      detectedPatterns: [],
      dimensionSignals: [
        { dimension: 'aiCollaboration', strengthSignals: [], growthSignals: [] },
        { dimension: 'contextEngineering', strengthSignals: [], growthSignals: [] },
        { dimension: 'toolMastery', strengthSignals: [], growthSignals: [] },
        { dimension: 'burnoutRisk', strengthSignals: [], growthSignals: [] },
        { dimension: 'aiControl', strengthSignals: [], growthSignals: [] },
        { dimension: 'skillResilience', strengthSignals: [], growthSignals: [] },
      ],
      analysisMetadata: {
        totalQuotesAnalyzed: 0,
        coverageScores: [],
        confidenceScore: 0.8,
      },
    },
  };
}

function createMockOutput(): PatternDetectiveOutput {
  return {
    repeatedQuestionsData: 'React hooks:5:useEffect cleanup;TypeScript generics:3:constraints',
    conversationStyleData: 'vague_request:23:just do it;proactive_context:15:provides context',
    requestStartPatternsData: 'Can you...:45;fix this:12;help me:8',
    topInsights: [
      'React hooks questions appeared 5 times',
      '67% of requests lack specific context',
      '"Just do it" pattern detected 23 times',
    ],
    overallStyleSummary: 'Direct communicator with room for more context',
    confidenceScore: 0.85,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('PatternDetectiveWorker', () => {
  let worker: PatternDetectiveWorker;
  let context: WorkerContext;
  let mockGenerateStructured: any;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createMockContext('premium');

    // Set up mock for generateStructured method
    mockGenerateStructured = vi.fn();
    vi.mocked(GeminiClient).mockImplementation(
      () =>
        ({
          generateStructured: mockGenerateStructured,
        }) as any
    );

    const config: PatternDetectiveWorkerConfig = {
      geminiApiKey: 'test-key',
      verbose: false,
    };

    worker = new PatternDetectiveWorker(config);
  });

  describe('worker properties', () => {
    it('should have correct name', () => {
      expect(worker.name).toBe('PatternDetective');
    });

    it('should be phase 2 worker', () => {
      expect(worker.phase).toBe(2);
    });

    it('should require premium tier', () => {
      expect(worker.minTier).toBe('premium');
    });
  });

  describe('constructor', () => {
    it('should create worker with config', () => {
      const config: PatternDetectiveWorkerConfig = {
        geminiApiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.0,
        verbose: true,
      };
      const worker = new PatternDetectiveWorker(config);
      expect(worker).toBeDefined();
      expect(worker.name).toBe('PatternDetective');
    });

    it('should use default model if not specified', () => {
      const config: PatternDetectiveWorkerConfig = {
        geminiApiKey: 'test-key',
      };
      const worker = new PatternDetectiveWorker(config);
      const MockedClient = vi.mocked(GeminiClient);

      expect(MockedClient).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-3-flash-preview',
        })
      );
    });
  });

  describe('canRun()', () => {
    it('should return true for premium tier with moduleAOutput', () => {
      expect(worker.canRun(context)).toBe(true);
    });

    it('should return true for enterprise tier', () => {
      const enterpriseContext = createMockContext('enterprise');
      expect(worker.canRun(enterpriseContext)).toBe(true);
    });

    it('should return false for free tier', () => {
      const freeContext = createMockContext('free');
      expect(worker.canRun(freeContext)).toBe(false);
    });

    it('should return false when moduleAOutput missing', () => {
      const contextWithoutModuleA = {
        ...context,
        moduleAOutput: undefined,
      };
      expect(worker.canRun(contextWithoutModuleA)).toBe(false);
    });

    it('should return false when sessions empty', () => {
      context.sessions = [];
      expect(worker.canRun(context)).toBe(false);
    });
  });

  describe('execute()', () => {
    it('should return error when moduleAOutput missing', async () => {
      const contextWithoutModuleA = {
        ...context,
        moduleAOutput: undefined,
      };

      const result = await worker.execute(contextWithoutModuleA);

      expect(result.data).toBeDefined();
      expect(result.data.topInsights).toEqual([]);
      expect(result.data.confidenceScore).toBe(0);
      expect(result.usage).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Module A output required');
    });

    it('should execute analysis and return result', async () => {
      const mockOutput = createMockOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: {
          promptTokens: 500,
          completionTokens: 250,
          totalTokens: 750,
        },
      });

      const result = await worker.execute(context);

      expect(mockGenerateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          maxOutputTokens: 8192,
        })
      );
      expect(result.data).toEqual(mockOutput);
      expect(result.usage).toEqual({
        promptTokens: 500,
        completionTokens: 250,
        totalTokens: 750,
      });
      expect(result.error).toBeUndefined();
    });

    it('should log progress when verbose enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseConfig: PatternDetectiveWorkerConfig = {
        geminiApiKey: 'test-key',
        verbose: true,
      };
      const verboseWorker = new PatternDetectiveWorker(verboseConfig);

      const mockOutput = createMockOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await verboseWorker.execute(context);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[PatternDetectiveWorker] Analyzing conversation patterns...'
      );
      expect(consoleSpy).toHaveBeenCalledWith('[PatternDetectiveWorker] Found 3 insights');
      expect(consoleSpy).toHaveBeenCalledWith('[PatternDetectiveWorker] Confidence: 85%');

      consoleSpy.mockRestore();
    });

    it('should handle analysis failure', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseConfig: PatternDetectiveWorkerConfig = {
        geminiApiKey: 'test-key',
        verbose: true,
      };
      const verboseWorker = new PatternDetectiveWorker(verboseConfig);

      const error = new Error('Analysis failed');
      mockGenerateStructured.mockRejectedValue(error);

      const result = await verboseWorker.execute(context);

      expect(result.data).toBeDefined();
      expect(result.data.topInsights).toEqual([]);
      expect(result.usage).toBeNull();
      expect(result.error).toBe(error);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Analysis failed: Error: Analysis failed')
      );

      consoleSpy.mockRestore();
    });

    it('should handle non-Error throws', async () => {
      mockGenerateStructured.mockRejectedValue('string error');

      const result = await worker.execute(context);

      expect(result.data).toBeDefined();
      expect(result.usage).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('string error');
    });

    it('should return default output on failure', async () => {
      mockGenerateStructured.mockRejectedValue(new Error('Failed'));

      const result = await worker.execute(context);

      expect(result.data.repeatedQuestionsData).toBe('');
      expect(result.data.conversationStyleData).toBe('');
      expect(result.data.requestStartPatternsData).toBe('');
      expect(result.data.topInsights).toEqual([]);
      expect(result.data.overallStyleSummary).toBe('Unable to analyze patterns');
      expect(result.data.confidenceScore).toBe(0);
    });
  });

  describe('factory function', () => {
    it('should create worker with config', () => {
      const config: PatternDetectiveWorkerConfig = {
        geminiApiKey: 'test-key',
      };
      const worker = createPatternDetectiveWorker(config);
      expect(worker).toBeInstanceOf(PatternDetectiveWorker);
      expect(worker.name).toBe('PatternDetective');
    });
  });
});
