/**
 * AntiPatternSpotterWorker Tests
 *
 * Tests for Phase 2 AntiPatternSpotterWorker (Wow Agent 2).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerContext } from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { AntiPatternSpotterOutput } from '../../../../src/lib/models/agent-outputs.js';

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
  AntiPatternSpotterWorker,
  createAntiPatternSpotterWorker,
  type AntiPatternSpotterWorkerConfig,
} from '../../../../src/lib/analyzer/workers/anti-pattern-spotter-worker.js';
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
            content: [{ type: 'text', text: 'Fix this error' }],
          },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Sure, try this approach' }],
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

function createMockOutput(): AntiPatternSpotterOutput {
  return {
    errorLoopsData: 'TypeScript type error:8:4.2:same error in 3 sessions',
    learningAvoidanceData: 'copy_paste_no_read:code copied without understanding:high',
    repeatedMistakesData: 'ESLint ignore abuse:12:session1,session3,session7',
    topInsights: [
      'ESLint errors repeated 8 times with avg 4.2 turns to resolve',
      '34% of code was copied without understanding verification',
      'Same approach persisted 3+ times in 8 cases',
    ],
    overallHealthScore: 72,
    confidenceScore: 0.78,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('AntiPatternSpotterWorker', () => {
  let worker: AntiPatternSpotterWorker;
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

    const config: AntiPatternSpotterWorkerConfig = {
      geminiApiKey: 'test-key',
      verbose: false,
    };

    worker = new AntiPatternSpotterWorker(config);
  });

  describe('worker properties', () => {
    it('should have correct name', () => {
      expect(worker.name).toBe('AntiPatternSpotter');
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
      const config: AntiPatternSpotterWorkerConfig = {
        geminiApiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.0,
        verbose: true,
      };
      const worker = new AntiPatternSpotterWorker(config);
      expect(worker).toBeDefined();
      expect(worker.name).toBe('AntiPatternSpotter');
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
    it('should throw when moduleAOutput missing', async () => {
      const contextWithoutModuleA = {
        ...context,
        moduleAOutput: undefined,
      };

      await expect(worker.execute(contextWithoutModuleA)).rejects.toThrow(
        'Module A output required for AntiPatternSpotter'
      );
    });

    it('should execute analysis and return result', async () => {
      const mockOutput = createMockOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: {
          promptTokens: 600,
          completionTokens: 300,
          totalTokens: 900,
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
        promptTokens: 600,
        completionTokens: 300,
        totalTokens: 900,
      });
      expect(result.error).toBeUndefined();
    });

    it('should log progress when verbose enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseConfig: AntiPatternSpotterWorkerConfig = {
        geminiApiKey: 'test-key',
        verbose: true,
      };
      const verboseWorker = new AntiPatternSpotterWorker(verboseConfig);

      const mockOutput = createMockOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await verboseWorker.execute(context);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[AntiPatternSpotterWorker] Detecting anti-patterns and bad habits...'
      );
      expect(consoleSpy).toHaveBeenCalledWith('[AntiPatternSpotterWorker] Health score: 72');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AntiPatternSpotterWorker] Found 3 anti-pattern insights'
      );

      consoleSpy.mockRestore();
    });

    it('should throw on analysis failure (NO FALLBACK policy)', async () => {
      const error = new Error('Analysis failed');
      mockGenerateStructured.mockRejectedValue(error);

      await expect(worker.execute(context)).rejects.toThrow('Analysis failed');
    });
  });

  describe('factory function', () => {
    it('should create worker with config', () => {
      const config: AntiPatternSpotterWorkerConfig = {
        geminiApiKey: 'test-key',
      };
      const worker = createAntiPatternSpotterWorker(config);
      expect(worker).toBeInstanceOf(AntiPatternSpotterWorker);
      expect(worker.name).toBe('AntiPatternSpotter');
    });
  });
});
