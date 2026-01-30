/**
 * WorkflowHabitWorker Tests
 *
 * Tests for Phase 2 WorkflowHabitWorker.
 * Detects planning habits and critical thinking moments.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerContext, Phase2WorkerContext } from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { WorkflowHabitOutput } from '../../../../src/lib/models/workflow-habit-data.js';
import type { Phase1Output } from '../../../../src/lib/models/phase1-output.js';

// Mock the GeminiClient
vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

// Import after mocking
import {
  WorkflowHabitWorker,
  createWorkflowHabitWorker,
} from '../../../../src/lib/analyzer/workers/workflow-habit-worker.js';
import type { OrchestratorConfig } from '../../../../src/lib/analyzer/orchestrator/types.js';
import { GeminiClient } from '../../../../src/lib/analyzer/clients/gemini-client.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockPhase1Output(): Phase1Output {
  return {
    developerUtterances: [
      {
        id: 'session-1_0',
        text: '/plan Let me think about this feature implementation',
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'session-1',
        turnIndex: 0,
        characterCount: 50,
        wordCount: 8,
        hasCodeBlock: false,
        hasQuestion: false,
        isSessionStart: true,
        isContinuation: false,
        precedingAIToolCalls: [],
      },
      {
        id: 'session-1_2',
        text: 'Break this into smaller tasks: 1. Setup 2. Implementation 3. Testing',
        timestamp: '2024-01-01T10:05:00Z',
        sessionId: 'session-1',
        turnIndex: 2,
        characterCount: 70,
        wordCount: 10,
        hasCodeBlock: false,
        hasQuestion: false,
        isSessionStart: false,
        isContinuation: false,
        precedingAIToolCalls: [],
      },
      {
        id: 'session-1_4',
        text: 'Wait, that assumption might be wrong. Let me verify first.',
        timestamp: '2024-01-01T10:10:00Z',
        sessionId: 'session-1',
        turnIndex: 4,
        characterCount: 55,
        wordCount: 10,
        hasCodeBlock: false,
        hasQuestion: false,
        isSessionStart: false,
        isContinuation: false,
        precedingAIToolCalls: ['Edit'],
      },
    ],
    aiResponses: [
      {
        id: 'session-1_1',
        sessionId: 'session-1',
        turnIndex: 1,
        responseType: 'plan',
        toolsUsed: [],
        textSnippet: 'Here is my plan for implementing...',
        fullTextLength: 500,
        wasSuccessful: true,
      },
      {
        id: 'session-1_3',
        sessionId: 'session-1',
        turnIndex: 3,
        responseType: 'code_change',
        toolsUsed: ['Edit'],
        textSnippet: 'Starting with task 1: Setup...',
        fullTextLength: 300,
        wasSuccessful: true,
      },
    ],
    sessionMetrics: {
      totalSessions: 1,
      totalMessages: 5,
      totalDeveloperUtterances: 3,
      totalAIResponses: 2,
      avgMessagesPerSession: 5,
      avgDeveloperMessageLength: 58,
      questionRatio: 0,
      codeBlockRatio: 0,
      dateRange: {
        earliest: '2024-01-01T10:00:00Z',
        latest: '2024-01-01T10:10:00Z',
      },
    },
  };
}

function createMockContext(tier: 'free' | 'premium' = 'premium'): Phase2WorkerContext {
  return {
    sessions: [],
    metrics: {
      totalSessions: 1,
      totalTurns: 5,
      averageTurnsPerSession: 5,
      sessionDurations: [600000],
      averageSessionDuration: 600000,
    },
    tier,
    phase1Output: createMockPhase1Output(),
  };
}

function createMockLLMOutput(): any {
  return {
    planningHabitsData: 'uses_plan_command:often:session-1_0|/plan Let me think:high;task_decomposition:sometimes:session-1_2|Break this into smaller tasks:medium',
    criticalThinkingMomentsData: 'verification:session-1_4|Wait that assumption might be wrong:Caught potential issue early',
    overallWorkflowScore: 82,
    summary: 'Developer shows strong planning habits with /plan command usage and task decomposition.',
    confidenceScore: 0.85,
    strengthsData: 'Planning mindset|Uses /plan command effectively|session-1_0',
    growthAreasData: '',
  };
}

function createMockOutput(): WorkflowHabitOutput {
  return {
    planningHabits: [
      {
        type: 'uses_plan_command',
        frequency: 'often',
        examples: ['/plan Let me think'],
        effectiveness: 'high',
      },
      {
        type: 'task_decomposition',
        frequency: 'sometimes',
        examples: ['Break this into smaller tasks'],
        effectiveness: 'medium',
      },
    ],
    criticalThinkingMoments: [
      {
        type: 'verification',
        quote: 'Wait that assumption might be wrong',
        result: 'Caught potential issue early',
        utteranceId: 'session-1_4',
      },
    ],
    overallWorkflowScore: 82,
    summary: 'Developer shows strong planning habits with /plan command usage and task decomposition.',
    confidenceScore: 0.85,
    strengths: [],
    growthAreas: [],
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('WorkflowHabitWorker', () => {
  let worker: WorkflowHabitWorker;
  let context: Phase2WorkerContext;
  let mockGenerateStructured: any;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createMockContext('premium');

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

    worker = new WorkflowHabitWorker(config);
  });

  describe('worker properties', () => {
    it('should have correct name', () => {
      expect(worker.name).toBe('WorkflowHabit');
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
      const worker = new WorkflowHabitWorker(config);
      expect(worker).toBeDefined();
      expect(worker.name).toBe('WorkflowHabit');
    });
  });

  describe('canRun()', () => {
    it('should return true when phase1Output present with utterances', () => {
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
        'Phase 1 output required for WorkflowHabitWorker'
      );
    });

    it('should execute analysis and return result', async () => {
      const mockLLMOutput = createMockLLMOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockLLMOutput,
        usage: {
          promptTokens: 650,
          completionTokens: 325,
          totalTokens: 975,
        },
      });

      const result = await worker.execute(context);

      expect(mockGenerateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          maxOutputTokens: 16384,
        })
      );
      expect(result.data).toBeDefined();
      expect(result.data.overallWorkflowScore).toBe(82);
      expect(result.usage).toEqual({
        promptTokens: 650,
        completionTokens: 325,
        totalTokens: 975,
      });
      expect(result.error).toBeUndefined();
    });

    it('should parse planning habits from LLM output', async () => {
      const mockLLMOutput = createMockLLMOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockLLMOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await worker.execute(context);

      expect(result.data.planningHabits).toBeDefined();
      expect(Array.isArray(result.data.planningHabits)).toBe(true);
      expect(result.data.planningHabits.length).toBeGreaterThan(0);
    });

    it('should parse critical thinking moments from LLM output', async () => {
      const mockLLMOutput = createMockLLMOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockLLMOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await worker.execute(context);

      expect(result.data.criticalThinkingMoments).toBeDefined();
      expect(Array.isArray(result.data.criticalThinkingMoments)).toBe(true);
    });

    it('should log progress when verbose enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseConfig: OrchestratorConfig = {
        geminiApiKey: 'test-key',
        verbose: true,
      };
      const verboseWorker = new WorkflowHabitWorker(verboseConfig);

      const mockLLMOutput = createMockLLMOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockLLMOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await verboseWorker.execute(context);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[WorkflowHabit] Analyzing workflow habits and critical thinking...'
      );
      expect(consoleSpy).toHaveBeenCalledWith('[WorkflowHabit] Utterances: 3');
      expect(consoleSpy).toHaveBeenCalledWith('[WorkflowHabit] Workflow score: 82');

      consoleSpy.mockRestore();
    });

    it('should throw on analysis failure (NO FALLBACK policy)', async () => {
      const error = new Error('LLM API error');
      mockGenerateStructured.mockRejectedValue(error);

      await expect(worker.execute(context)).rejects.toThrow('LLM API error');
    });
  });

  describe('factory function', () => {
    it('should create worker with config', () => {
      const config: OrchestratorConfig = {
        geminiApiKey: 'test-key',
      };
      const worker = createWorkflowHabitWorker(config);
      expect(worker).toBeInstanceOf(WorkflowHabitWorker);
      expect(worker.name).toBe('WorkflowHabit');
    });
  });
});
