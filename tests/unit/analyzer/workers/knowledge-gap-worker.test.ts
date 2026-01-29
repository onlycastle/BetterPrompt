/**
 * KnowledgeGapWorker Tests
 *
 * Tests for Phase 2 KnowledgeGapWorker (Wow Agent 3).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerContext, Phase2WorkerContext } from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { KnowledgeGapOutput } from '../../../../src/lib/models/agent-outputs.js';
import type { Phase1Output } from '../../../../src/lib/models/phase1-output.js';

// Mock the GeminiClient
vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

// Import after mocking
import {
  KnowledgeGapWorker,
  createKnowledgeGapWorker,
} from '../../../../src/lib/analyzer/workers/knowledge-gap-worker.js';
import type { OrchestratorConfig } from '../../../../src/lib/analyzer/orchestrator/types.js';
import { GeminiClient } from '../../../../src/lib/analyzer/clients/gemini-client.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockContext(tier: 'free' | 'premium' = 'premium'): Phase2WorkerContext {
  return {
    sessions: [],
    metrics: {
      totalSessions: 1,
      totalTurns: 10,
      averageTurnsPerSession: 10,
      sessionDurations: [3600000],
      averageSessionDuration: 3600000,
    },
    tier,
    phase1Output: {
      developerUtterances: [
        {
          id: 'session-1_0',
          text: 'How do React hooks work?',
          timestamp: '2024-01-01T10:00:00Z',
          sessionId: 'session-1',
          turnIndex: 0,
          characterCount: 25,
          wordCount: 5,
          hasCodeBlock: false,
          hasQuestion: true,
          isSessionStart: true,
          isContinuation: false,
        },
        {
          id: 'session-1_2',
          text: 'Can you explain async/await patterns?',
          timestamp: '2024-01-01T10:05:00Z',
          sessionId: 'session-1',
          turnIndex: 2,
          characterCount: 38,
          wordCount: 5,
          hasCodeBlock: false,
          hasQuestion: true,
          isSessionStart: false,
          isContinuation: false,
        },
      ],
      aiResponses: [
        {
          id: 'session-1_1',
          sessionId: 'session-1',
          turnIndex: 1,
          responseType: 'explanation',
          toolsUsed: [],
          textSnippet: 'React hooks are functions that let you use state...',
          fullTextLength: 500,
        },
      ],
      sessionMetrics: {
        totalSessions: 1,
        totalMessages: 10,
        totalDeveloperUtterances: 2,
        totalAIResponses: 1,
        avgMessagesPerSession: 10,
        avgDeveloperMessageLength: 31.5,
        questionRatio: 1.0,
        codeBlockRatio: 0.0,
        dateRange: {
          earliest: '2024-01-01T10:00:00Z',
          latest: '2024-01-01T10:05:00Z',
        },
      },
    },
  };
}

function createMockOutput(): KnowledgeGapOutput {
  return {
    knowledgeGapsData:
      'async/await:7:shallow:Promise chaining not understood;TypeScript generics:4:moderate:constraint syntax unclear',
    learningProgressData:
      'React hooks:shallow:moderate:useEffect cleanup questions decreased;CSS Grid:novice:intermediate:fewer layout questions',
    recommendedResourcesData:
      'TypeScript generics:docs:typescriptlang.org;async/await:tutorial:javascript.info',
    topInsights: [
      'async/await questions appeared 7 times - fundamental concept learning needed',
      'React hooks understanding: shallow -> moderate (progress over 5 sessions)',
      'Recommended: TypeScript generics official documentation',
    ],
    overallKnowledgeScore: 68,
    confidenceScore: 0.82,
    // New fields added by parseKnowledgeGapLLMOutput() (parsed from undefined strengthsData/growthAreasData)
    strengths: [],
    growthAreas: [],
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('KnowledgeGapWorker', () => {
  let worker: KnowledgeGapWorker;
  let context: Phase2WorkerContext;
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

    const config: OrchestratorConfig = {
      geminiApiKey: 'test-key',
      verbose: false,
    };

    worker = new KnowledgeGapWorker(config);
  });

  describe('worker properties', () => {
    it('should have correct name', () => {
      expect(worker.name).toBe('KnowledgeGap');
    });

    it('should be phase 2 worker', () => {
      expect(worker.phase).toBe(2);
    });
  });

  describe('constructor', () => {
    it('should create worker with config', () => {
      const config: OrchestratorConfig = {
        geminiApiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.0,
        verbose: true,
      };
      const worker = new KnowledgeGapWorker(config);
      expect(worker).toBeDefined();
      expect(worker.name).toBe('KnowledgeGap');
    });
  });

  describe('canRun()', () => {
    it('should return true when phase1Output present', () => {
      expect(worker.canRun(context)).toBe(true);
    });

    it('should return true for any tier (tier filtering at ContentGateway)', () => {
      const freeContext = createMockContext('free');
      expect(worker.canRun(freeContext)).toBe(true);
    });

    it('should return false when phase1Output missing', () => {
      const contextWithoutPhase1 = {
        ...context,
        phase1Output: undefined,
      };
      expect(worker.canRun(contextWithoutPhase1)).toBe(false);
    });

    it('should return false when developerUtterances empty', () => {
      const contextWithEmptyUtterances = {
        ...context,
        phase1Output: {
          ...context.phase1Output!,
          developerUtterances: [],
        },
      };
      expect(worker.canRun(contextWithEmptyUtterances)).toBe(false);
    });
  });

  describe('execute()', () => {
    it('should throw when phase1Output missing', async () => {
      const contextWithoutPhase1 = {
        ...context,
        phase1Output: undefined,
      };

      await expect(worker.execute(contextWithoutPhase1)).rejects.toThrow(
        'Phase 1 output required for KnowledgeGapWorker'
      );
    });

    it('should execute analysis and return result', async () => {
      const mockOutput = createMockOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: {
          promptTokens: 550,
          completionTokens: 275,
          totalTokens: 825,
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
        promptTokens: 550,
        completionTokens: 275,
        totalTokens: 825,
      });
      expect(result.error).toBeUndefined();
    });

    it('should log progress when verbose enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseConfig: OrchestratorConfig = {
        geminiApiKey: 'test-key',
        verbose: true,
      };
      const verboseWorker = new KnowledgeGapWorker(verboseConfig);

      const mockOutput = createMockOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await verboseWorker.execute(context);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[KnowledgeGap] Analyzing knowledge gaps and learning progress...'
      );
      expect(consoleSpy).toHaveBeenCalledWith('[KnowledgeGap] Utterances: 2');
      expect(consoleSpy).toHaveBeenCalledWith('[KnowledgeGap] Knowledge score: 68');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[KnowledgeGap] Found 3 knowledge insights'
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
      const config: OrchestratorConfig = {
        geminiApiKey: 'test-key',
      };
      const worker = createKnowledgeGapWorker(config);
      expect(worker).toBeInstanceOf(KnowledgeGapWorker);
      expect(worker.name).toBe('KnowledgeGap');
    });
  });
});
