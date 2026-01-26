/**
 * ContextEfficiencyWorker Tests
 *
 * Tests for Phase 2 ContextEfficiencyWorker (Wow Agent 4).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerContext } from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { ContextEfficiencyOutput } from '../../../../src/lib/models/agent-outputs.js';
import type { Phase1Output } from '../../../../src/lib/models/phase1-output.js';

// Mock the GeminiClient
vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

// Import after mocking
import {
  ContextEfficiencyWorker,
  createContextEfficiencyWorker,
} from '../../../../src/lib/analyzer/workers/context-efficiency-worker.js';
import type { OrchestratorConfig } from '../../../../src/lib/analyzer/orchestrator/types.js';
import { GeminiClient } from '../../../../src/lib/analyzer/clients/gemini-client.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockContext(tier: 'free' | 'premium' | 'enterprise' = 'premium'): WorkerContext {
  const phase1Output: Phase1Output = {
    developerUtterances: [
      {
        id: 'session-1_0',
        text: 'Here is the project structure again...',
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'session-1',
        turnIndex: 0,
        characterCount: 40,
        wordCount: 6,
        hasCodeBlock: false,
        hasQuestion: false,
        isSessionStart: true,
        isContinuation: false,
      },
      {
        id: 'session-1_2',
        text: 'Can you review this code?',
        timestamp: '2024-01-01T10:05:00Z',
        sessionId: 'session-1',
        turnIndex: 2,
        characterCount: 26,
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
        toolsUsed: ['Read', 'Grep'],
        textSnippet: 'I can see the project structure...',
        fullTextLength: 150,
        hadError: false,
        wasSuccessful: true,
      },
    ],
    sessionMetrics: {
      totalSessions: 1,
      totalMessages: 3,
      totalDeveloperUtterances: 2,
      totalAIResponses: 1,
      avgMessagesPerSession: 3,
      avgDeveloperMessageLength: 33,
      questionRatio: 0.5,
      codeBlockRatio: 0,
      dateRange: {
        earliest: '2024-01-01T10:00:00Z',
        latest: '2024-01-01T10:05:00Z',
      },
    },
  };

  return {
    sessions: [
      {
        sessionId: 'session-1',
        startedAt: new Date('2024-01-01T10:00:00Z'),
        turns: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Here is the project structure again...' }],
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
    phase1Output,
  };
}

function createMockOutput(): ContextEfficiencyOutput {
  return {
    contextUsagePatternData: 'session1:85:92;session2:78:88;session3:91:95',
    inefficiencyPatternsData:
      'late_compact:15:high:always compacts at 90%+;context_bloat:8:medium:never uses /clear',
    promptLengthTrendData: 'early:150;mid:280;late:450',
    redundantInfoData: 'project_structure:5;tech_stack:3;file_paths:7',
    topInsights: [
      'Average 85% context fill before compact - consider earlier compaction',
      'Prompt length increases 2.3x in late session',
      'Project structure explained 5 times - set in context once',
    ],
    overallEfficiencyScore: 65,
    avgContextFillPercent: 84,
    confidenceScore: 0.79,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ContextEfficiencyWorker', () => {
  let worker: ContextEfficiencyWorker;
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

    const config: OrchestratorConfig = {
      geminiApiKey: 'test-key',
      verbose: false,
    };

    worker = new ContextEfficiencyWorker(config);
  });

  describe('worker properties', () => {
    it('should have correct name', () => {
      expect(worker.name).toBe('ContextEfficiency');
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
      const config: OrchestratorConfig = {
        geminiApiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.0,
        verbose: true,
      };
      const worker = new ContextEfficiencyWorker(config);
      expect(worker).toBeDefined();
      expect(worker.name).toBe('ContextEfficiency');
    });
  });

  describe('canRun()', () => {
    it('should return true for premium tier with phase1Output', () => {
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
        'Phase 1 output required for ContextEfficiencyWorker'
      );
    });

    it('should execute analysis and return result', async () => {
      const mockOutput = createMockOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: {
          promptTokens: 650,
          completionTokens: 325,
          totalTokens: 975,
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
        promptTokens: 650,
        completionTokens: 325,
        totalTokens: 975,
      });
      expect(result.error).toBeUndefined();
    });

    it('should log progress when verbose enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseConfig: OrchestratorConfig = {
        geminiApiKey: 'test-key',
        verbose: true,
      };
      const verboseWorker = new ContextEfficiencyWorker(verboseConfig);

      const mockOutput = createMockOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await verboseWorker.execute(context);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ContextEfficiency] Analyzing context efficiency and productivity...'
      );
      expect(consoleSpy).toHaveBeenCalledWith('[ContextEfficiency] Utterances: 2');
      expect(consoleSpy).toHaveBeenCalledWith('[ContextEfficiency] Efficiency score: 65');
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ContextEfficiency] Avg context fill: 84%'
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
      const worker = createContextEfficiencyWorker(config);
      expect(worker).toBeInstanceOf(ContextEfficiencyWorker);
      expect(worker.name).toBe('ContextEfficiency');
    });
  });
});
