/**
 * TrustVerificationWorker Tests
 *
 * Tests for Phase 2 TrustVerificationWorker.
 * Detects anti-patterns and verification behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerContext, Phase2WorkerContext } from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { TrustVerificationOutput } from '../../../../src/lib/models/trust-verification-data.js';
import type { Phase1Output } from '../../../../src/lib/models/phase1-output.js';

// Mock the GeminiClient
vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

// Import after mocking
import {
  TrustVerificationWorker,
  createTrustVerificationWorker,
} from '../../../../src/lib/analyzer/workers/trust-verification-worker.js';
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
        text: 'Fix the bug please',
        timestamp: '2024-01-01T10:00:00Z',
        sessionId: 'session-1',
        turnIndex: 0,
        characterCount: 18,
        wordCount: 4,
        hasCodeBlock: false,
        hasQuestion: false,
        isSessionStart: true,
        isContinuation: false,
        precedingAIHadError: false,
        precedingAIToolCalls: [],
      },
      {
        id: 'session-1_2',
        text: 'That didnt work, try again',
        timestamp: '2024-01-01T10:05:00Z',
        sessionId: 'session-1',
        turnIndex: 2,
        characterCount: 26,
        wordCount: 5,
        hasCodeBlock: false,
        hasQuestion: false,
        isSessionStart: false,
        isContinuation: false,
        precedingAIHadError: true,
        precedingAIToolCalls: ['Edit'],
      },
      {
        id: 'session-1_4',
        text: 'Wait, let me verify this works before we continue',
        timestamp: '2024-01-01T10:10:00Z',
        sessionId: 'session-1',
        turnIndex: 4,
        characterCount: 49,
        wordCount: 9,
        hasCodeBlock: false,
        hasQuestion: false,
        isSessionStart: false,
        isContinuation: false,
        precedingAIHadError: false,
        precedingAIToolCalls: ['Edit'],
      },
    ],
    aiResponses: [
      {
        id: 'session-1_1',
        sessionId: 'session-1',
        turnIndex: 1,
        responseType: 'code_change',
        toolsUsed: ['Edit'],
        textSnippet: 'I made the following changes...',
        fullTextLength: 200,
        hadError: true,
        wasSuccessful: false,
      },
      {
        id: 'session-1_3',
        sessionId: 'session-1',
        turnIndex: 3,
        responseType: 'code_change',
        toolsUsed: ['Edit'],
        textSnippet: 'Let me try a different approach...',
        fullTextLength: 250,
        hadError: false,
        wasSuccessful: true,
      },
    ],
    sessionMetrics: {
      totalSessions: 1,
      totalMessages: 5,
      totalDeveloperUtterances: 3,
      totalAIResponses: 2,
      avgMessagesPerSession: 5,
      avgDeveloperMessageLength: 31,
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
    antiPatternsData: 'error_loop:2:moderate:session-1_2|That didnt work try again;blind_retry:1:mild:session-1_0|Fix the bug please',
    verificationBehaviorLevel: 'moderate',
    verificationBehaviorDescription: 'Shows some verification habits',
    verificationBehaviorIndicatorsData: 'verification_before_continue:session-1_4',
    patternTypesData: 'iterative_refinement;error_recovery',
    overallTrustHealthScore: 72,
    summary: 'Developer shows mixed trust patterns with some verification behavior.',
    confidenceScore: 0.78,
    strengthsData: 'Verification mindset|Shows awareness of verification needs|session-1_4',
    growthAreasData: 'Error recovery|Could improve error handling patterns|session-1_2|Consider debugging before retrying|sometimes|moderate|65',
  };
}

function createMockOutput(): TrustVerificationOutput {
  return {
    antiPatterns: [
      {
        type: 'error_loop',
        frequency: 2,
        severity: 'moderate',
        examples: [{ utteranceId: 'session-1_2', quote: 'That didnt work try again' }],
        improvement: 'Consider understanding the error before retrying',
      },
    ],
    verificationBehavior: {
      level: 'moderate',
      description: 'Shows some verification habits',
      indicators: ['verification_before_continue'],
    },
    patternTypes: ['iterative_refinement', 'error_recovery'],
    overallTrustHealthScore: 72,
    summary: 'Developer shows mixed trust patterns with some verification behavior.',
    confidenceScore: 0.78,
    strengths: [],
    growthAreas: [],
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('TrustVerificationWorker', () => {
  let worker: TrustVerificationWorker;
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

    worker = new TrustVerificationWorker(config);
  });

  describe('worker properties', () => {
    it('should have correct name', () => {
      expect(worker.name).toBe('TrustVerification');
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
      const worker = new TrustVerificationWorker(config);
      expect(worker).toBeDefined();
      expect(worker.name).toBe('TrustVerification');
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
        'Phase 1 output required for TrustVerificationWorker'
      );
    });

    it('should execute analysis and return result', async () => {
      const mockLLMOutput = createMockLLMOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockLLMOutput,
        usage: {
          promptTokens: 700,
          completionTokens: 350,
          totalTokens: 1050,
        },
      });

      const result = await worker.execute(context);

      expect(mockGenerateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          maxOutputTokens: 16384,
        })
      );
      expect(result.data).toBeDefined();
      expect(result.data.overallTrustHealthScore).toBe(72);
      expect(result.usage).toEqual({
        promptTokens: 700,
        completionTokens: 350,
        totalTokens: 1050,
      });
      expect(result.error).toBeUndefined();
    });

    it('should parse anti-patterns from LLM output', async () => {
      const mockLLMOutput = createMockLLMOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockLLMOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await worker.execute(context);

      expect(result.data.antiPatterns).toBeDefined();
      expect(Array.isArray(result.data.antiPatterns)).toBe(true);
    });

    it('should parse verification behavior from LLM output', async () => {
      const mockLLMOutput = createMockLLMOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockLLMOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await worker.execute(context);

      expect(result.data.verificationBehavior).toBeDefined();
      // Level comes from LLM and gets parsed - just verify it exists and is a string
      expect(typeof result.data.verificationBehavior.level).toBe('string');
    });

    it('should log progress when verbose enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseConfig: OrchestratorConfig = {
        geminiApiKey: 'test-key',
        verbose: true,
      };
      const verboseWorker = new TrustVerificationWorker(verboseConfig);

      const mockLLMOutput = createMockLLMOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockLLMOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await verboseWorker.execute(context);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[TrustVerification] Analyzing trust patterns and verification behavior...'
      );
      expect(consoleSpy).toHaveBeenCalledWith('[TrustVerification] Utterances: 3');
      expect(consoleSpy).toHaveBeenCalledWith('[TrustVerification] AI Responses: 2');

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
      const worker = createTrustVerificationWorker(config);
      expect(worker).toBeInstanceOf(TrustVerificationWorker);
      expect(worker.name).toBe('TrustVerification');
    });
  });
});
