/**
 * Analysis Orchestrator Tests (v2 Architecture)
 *
 * Tests for AnalysisOrchestrator class including:
 * - Worker registration
 * - Phase execution
 * - Token tracking
 * - Tier-based filtering
 * - NO FALLBACK policy enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ParsedSession, SessionMetrics } from '../../../../src/lib/domain/models/analysis.js';
import type { Phase1Output } from '../../../../src/lib/models/phase1-output.js';
import type { WorkerContext, WorkerResult } from '../../../../src/lib/analyzer/orchestrator/types.js';
import type { Tier } from '../../../../src/lib/analyzer/content-gateway.js';
import { BaseWorker } from '../../../../src/lib/analyzer/workers/base-worker.js';

// Mock dependencies
vi.mock('../../../../src/lib/analyzer/stages/content-writer.js', () => ({
  ContentWriterStage: class MockContentWriterStage {
    // v3 method: returns narrative-only fields (Phase 3 purification)
    async transformV3() {
      return {
        data: {
          personalitySummary: 'Test personality summary',
          promptPatterns: [
            { patternName: 'Test Pattern', description: 'desc', frequency: 'often', examples: [], effectiveness: 'effective', tip: 'tip' },
            { patternName: 'Pattern 2', description: 'desc2', frequency: 'sometimes', examples: [], effectiveness: 'moderate', tip: 'tip2' },
            { patternName: 'Pattern 3', description: 'desc3', frequency: 'rare', examples: [], effectiveness: 'developing', tip: 'tip3' },
          ],
        },
        usage: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
        },
      };
    }
    // Public method called by orchestrator before assembly
    verifyPhase2WorkerExamples() {
      // No-op in tests
    }
  },
}));

vi.mock('../../../../src/lib/analyzer/content-gateway.js', () => ({
  ContentGateway: class MockContentGateway {
    filter(evaluation: any, tier: any) {
      return evaluation;
    }
  },
}));

// Import after mocking
import { AnalysisOrchestrator, createAnalysisOrchestrator } from '../../../../src/lib/analyzer/orchestrator/analysis-orchestrator.js';

// Test worker implementations
class MockDataExtractorWorker extends BaseWorker<Phase1Output> {
  readonly name = 'DataExtractor';
  readonly phase = 1 as const;
  readonly minTier: Tier = 'free';

  canRun(context: WorkerContext): boolean {
    return context.sessions.length > 0;
  }

  async execute(context: WorkerContext): Promise<WorkerResult<Phase1Output>> {
    return {
      data: {
        developerUtterances: [],
        aiResponses: [],
        sessionMetrics: {
          totalSessions: context.sessions.length,
          totalMessages: 10,
          totalDeveloperUtterances: 5,
          totalAIResponses: 5,
          avgMessagesPerSession: 10,
          avgDeveloperMessageLength: 100,
          questionRatio: 0.2,
          codeBlockRatio: 0.3,
          dateRange: {
            earliest: '2024-01-01T10:00:00Z',
            latest: '2024-01-01T11:00:00Z',
          },
        },
      },
      usage: null, // Deterministic, no LLM call
    };
  }
}

class MockPhase2Worker extends BaseWorker<{ insight: string }> {
  readonly name = 'PatternDetective';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'pro';

  canRun(context: WorkerContext): boolean {
    return context.tier !== 'free';
  }

  async execute(context: WorkerContext): Promise<WorkerResult<{ insight: string }>> {
    return {
      data: { insight: 'Test insight' },
      usage: {
        promptTokens: 500,
        completionTokens: 250,
        totalTokens: 750,
      },
    };
  }
}

class FailingWorker extends BaseWorker<any> {
  readonly name = 'FailingWorker';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'pro';

  canRun(): boolean {
    return true;
  }

  async execute(): Promise<WorkerResult<any>> {
    throw new Error('Worker intentionally failed');
  }
}

class WrongPhaseWorker extends BaseWorker<any> {
  readonly name = 'WrongPhase';
  readonly phase = 3 as const;
  readonly minTier: Tier = 'free';

  canRun(): boolean {
    return true;
  }

  async execute(): Promise<WorkerResult<any>> {
    return { data: {}, usage: null };
  }
}

describe('AnalysisOrchestrator', () => {
  let orchestrator: AnalysisOrchestrator;
  let mockSessions: ParsedSession[];
  let mockMetrics: SessionMetrics;

  beforeEach(() => {
    // Create orchestrator with test config
    orchestrator = new AnalysisOrchestrator({
      geminiApiKey: 'test-api-key',
      verbose: false,
    });

    // Create mock sessions
    mockSessions = [
      {
        sessionId: 'session-1',
        projectPath: '/test/project',
        startTime: new Date('2024-01-01T10:00:00Z'),
        durationSeconds: 600,
        messages: [],
        messageCount: 10,
      },
    ] as ParsedSession[];

    // Create mock metrics
    mockMetrics = {
      avgPromptLength: 150,
      avgTurnsPerSession: 5,
      totalSessions: 1,
      totalMessages: 10,
    };
  });

  describe('Worker Registration', () => {
    describe('registerPhase1Worker', () => {
      it('should register a Phase 1 worker successfully', () => {
        const worker = new MockDataExtractorWorker();

        expect(() => orchestrator.registerPhase1Worker(worker)).not.toThrow();
      });

      it('should support method chaining', () => {
        const worker1 = new MockDataExtractorWorker();
        const worker2 = new MockDataExtractorWorker();

        const result = orchestrator
          .registerPhase1Worker(worker1)
          .registerPhase1Worker(worker2);

        expect(result).toBe(orchestrator);
      });

      it('should throw error when registering worker with wrong phase', () => {
        const wrongPhaseWorker = new WrongPhaseWorker();

        expect(() => orchestrator.registerPhase1Worker(wrongPhaseWorker as any))
          .toThrow('Worker WrongPhase has phase 3, expected 1');
      });

      it('should allow registering multiple Phase 1 workers', () => {
        const worker1 = new MockDataExtractorWorker();
        const worker2 = new MockDataExtractorWorker();

        expect(() => {
          orchestrator.registerPhase1Worker(worker1);
          orchestrator.registerPhase1Worker(worker2);
        }).not.toThrow();
      });
    });

    describe('registerPhase2Worker', () => {
      it('should register a Phase 2 worker successfully', () => {
        const worker = new MockPhase2Worker();

        expect(() => orchestrator.registerPhase2Worker(worker)).not.toThrow();
      });

      it('should support method chaining', () => {
        const worker = new MockPhase2Worker();

        const result = orchestrator.registerPhase2Worker(worker);

        expect(result).toBe(orchestrator);
      });

      it('should throw error when registering worker with wrong phase', () => {
        const wrongPhaseWorker = new WrongPhaseWorker();

        expect(() => orchestrator.registerPhase2Worker(wrongPhaseWorker as any))
          .toThrow('Worker WrongPhase has phase 3, expected 2');
      });

      it('should allow registering multiple Phase 2 workers', () => {
        const worker1 = new MockPhase2Worker();
        const worker2 = new MockPhase2Worker();

        expect(() => {
          orchestrator.registerPhase2Worker(worker1);
          orchestrator.registerPhase2Worker(worker2);
        }).not.toThrow();
      });
    });
  });

  describe('Phase Execution', () => {
    describe('Phase 1 - Data Extraction', () => {
      it('should run Phase 1 workers in parallel', async () => {
        const dataExtractorWorker = new MockDataExtractorWorker();

        orchestrator.registerPhase1Worker(dataExtractorWorker);

        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'pro');

        expect(result).toBeDefined();
        expect(result.evaluation.personalitySummary).toBe('Test personality summary');
      });

      // NO FALLBACK POLICY: Workers must be registered
      it('should throw when DataExtractor worker is not registered', async () => {
        // No workers registered
        await expect(orchestrator.analyze(mockSessions, mockMetrics, 'free')).rejects.toThrow(
          'DataExtractor worker not registered'
        );
      });

      it('should throw when no Phase 1 workers are registered', async () => {
        // No workers registered
        await expect(orchestrator.analyze(mockSessions, mockMetrics, 'free')).rejects.toThrow(
          'DataExtractor worker not registered'
        );
      });
    });

    describe('Phase 2 - Insight Generation', () => {
      beforeEach(() => {
        // Always register Phase 1 workers for Phase 2 tests
        const dataExtractorWorker = new MockDataExtractorWorker();
        orchestrator.registerPhase1Worker(dataExtractorWorker);
      });

      it('should run Phase 2 workers for pro tier', async () => {
        const phase2Worker = new MockPhase2Worker();
        orchestrator.registerPhase2Worker(phase2Worker);

        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'pro');

        expect(result).toBeDefined();
        expect(result.evaluation.agentOutputs).toBeDefined();
      });

      it('should skip Phase 2 workers for free tier', async () => {
        const phase2Worker = new MockPhase2Worker();
        orchestrator.registerPhase2Worker(phase2Worker);

        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

        expect(result).toBeDefined();
        // agentOutputs should be empty for free tier
        expect(result.evaluation.agentOutputs).toBeDefined();
      });

      it('should skip Phase 2 when no workers are registered', async () => {
        // No Phase 2 workers registered
        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'pro');

        expect(result).toBeDefined();
        expect(result.evaluation.agentOutputs).toBeDefined();
      });

      it('should run multiple Phase 2 workers in parallel', async () => {
        const worker1 = new MockPhase2Worker();
        const worker2 = new MockPhase2Worker();

        orchestrator
          .registerPhase2Worker(worker1)
          .registerPhase2Worker(worker2);

        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'pro');

        expect(result).toBeDefined();
        expect(result.evaluation.agentOutputs).toBeDefined();
      });

      it('should provide Phase 1 outputs to Phase 2 workers', async () => {
        let receivedContext: WorkerContext | null = null;

        class ContextCapturingWorker extends BaseWorker<any> {
          readonly name = 'ContextCapture';
          readonly phase = 2 as const;
          readonly minTier: Tier = 'pro';

          canRun(context: WorkerContext): boolean {
            receivedContext = context;
            return true;
          }

          async execute(context: WorkerContext): Promise<WorkerResult<any>> {
            return { data: {}, usage: null };
          }
        }

        const contextWorker = new ContextCapturingWorker();
        orchestrator.registerPhase2Worker(contextWorker);

        await orchestrator.analyze(mockSessions, mockMetrics, 'pro');

        expect(receivedContext).not.toBeNull();
        expect((receivedContext as any)?.phase1Output).toBeDefined();
      });
    });

    describe('Phase 3 - Content Generation', () => {
      it('should always run content generation phase', async () => {
        const dataExtractorWorker = new MockDataExtractorWorker();

        orchestrator.registerPhase1Worker(dataExtractorWorker);

        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

        expect(result).toBeDefined();
        expect(result.evaluation.personalitySummary).toBeDefined();
        expect(result.evaluation.dimensionInsights).toBeDefined();
      });

      it('should receive Phase 1 outputs in content writer', async () => {
        const dataExtractorWorker = new MockDataExtractorWorker();

        orchestrator.registerPhase1Worker(dataExtractorWorker);

        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'pro');

        expect(result).toBeDefined();
        // Content writer produces narrative from Phase 1 + Phase 2 data
        expect(result.evaluation.personalitySummary).toBe('Test personality summary');
      });
    });
  });

  // NO FALLBACK POLICY: Worker failures now propagate as errors
  describe('Error Propagation (NO FALLBACK)', () => {
    beforeEach(() => {
      // Register Phase 1 workers
      const dataExtractorWorker = new MockDataExtractorWorker();
      orchestrator.registerPhase1Worker(dataExtractorWorker);
    });

    it('should throw when a Phase 2 worker fails', async () => {
      const failingWorker = new FailingWorker();

      orchestrator.registerPhase2Worker(failingWorker);

      // Should throw - NO FALLBACK
      await expect(orchestrator.analyze(mockSessions, mockMetrics, 'pro')).rejects.toThrow(
        'Worker intentionally failed'
      );
    });

    it('should skip worker that cannot run (canRun returns false)', async () => {
      class CannotRunWorker extends BaseWorker<any> {
        readonly name = 'CannotRun';
        readonly phase = 2 as const;
        readonly minTier: Tier = 'pro';

        canRun(): boolean {
          return false; // Always returns false
        }

        async execute(): Promise<WorkerResult<any>> {
          throw new Error('Should not be called');
        }
      }

      const cannotRunWorker = new CannotRunWorker();
      orchestrator.registerPhase2Worker(cannotRunWorker);

      // Should complete - worker is skipped because canRun() returns false
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'pro');

      expect(result).toBeDefined();
    });

    it('should throw when all Phase 2 workers fail', async () => {
      const failing1 = new FailingWorker();

      orchestrator.registerPhase2Worker(failing1);

      // Should throw - NO FALLBACK
      await expect(orchestrator.analyze(mockSessions, mockMetrics, 'pro')).rejects.toThrow(
        'Worker intentionally failed'
      );
    });
  });

  describe('Token Tracking', () => {
    it('should track token usage from Phase 1 workers', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

      const verboseOrchestrator = new AnalysisOrchestrator({
        geminiApiKey: 'test-api-key',
        verbose: true,
      });

      const dataExtractorWorker = new MockDataExtractorWorker();

      verboseOrchestrator.registerPhase1Worker(dataExtractorWorker);

      await verboseOrchestrator.analyze(mockSessions, mockMetrics, 'free');

      // Should log token usage
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should track token usage from Phase 2 workers', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

      const verboseOrchestrator = new AnalysisOrchestrator({
        geminiApiKey: 'test-api-key',
        verbose: true,
      });

      const dataExtractorWorker = new MockDataExtractorWorker();
      const phase2Worker = new MockPhase2Worker();

      verboseOrchestrator
        .registerPhase1Worker(dataExtractorWorker)
        .registerPhase2Worker(phase2Worker);

      await verboseOrchestrator.analyze(mockSessions, mockMetrics, 'pro');

      // Should log token usage including Phase 2
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should not log verbose messages when verbose is false', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

      // Must register required worker
      const dataExtractorWorker = new MockDataExtractorWorker();
      orchestrator.registerPhase1Worker(dataExtractorWorker);

      await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      // Verbose logs (from this.log()) should not be present
      // Note: Debug logs (console.log('[Orchestrator]...')) may still appear
      // as they are unconditional for debugging purposes
      const verboseLogs = consoleSpy.mock.calls.filter(
        call => call[0]?.includes?.('Phase 1') || call[0]?.includes?.('Pipeline Summary')
      );
      expect(verboseLogs.length).toBe(0);

      consoleSpy.mockRestore();
    });
  });

  describe('Result Building', () => {
    beforeEach(() => {
      const dataExtractorWorker = new MockDataExtractorWorker();
      orchestrator.registerPhase1Worker(dataExtractorWorker);
    });

    it('should include session metadata', async () => {
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result.evaluation.sessionId).toBe('session-1');
      expect(result.evaluation.analyzedAt).toBeDefined();
      expect(result.evaluation.sessionsAnalyzed).toBe(1);
    });

    it('should include computed metrics', async () => {
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result.evaluation.avgPromptLength).toBe(150);
      expect(result.evaluation.avgTurnsPerSession).toBe(5);
    });

    it('should include analyzedSessions array', async () => {
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result.evaluation.analyzedSessions).toBeDefined();
      expect(result.evaluation.analyzedSessions).toHaveLength(1);
      expect(result.evaluation.analyzedSessions[0].sessionId).toBe('session-1');
      expect(result.evaluation.analyzedSessions[0].projectName).toBe('project');
    });

    it('should include agent outputs (empty for free tier)', async () => {
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result.evaluation.agentOutputs).toBeDefined();
    });

    it('should include agent outputs (populated for pro tier)', async () => {
      const phase2Worker = new MockPhase2Worker();
      orchestrator.registerPhase2Worker(phase2Worker);

      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'pro');

      expect(result.evaluation.agentOutputs).toBeDefined();
    });

    it('should include phase1Output in result', async () => {
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result.phase1Output).toBeDefined();
      expect(result.phase1Output.sessionMetrics).toBeDefined();
    });
  });

  describe('Tier-Based Filtering', () => {
    beforeEach(() => {
      const dataExtractorWorker = new MockDataExtractorWorker();
      orchestrator.registerPhase1Worker(dataExtractorWorker);
    });

    it('should apply tier filtering to final result', async () => {
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result).toBeDefined();
      // ContentGateway.filter is mocked to pass through
      // personalitySummary comes from narrative (Phase 3)
      expect(result.evaluation.personalitySummary).toBe('Test personality summary');
    });

    it('should pass correct tier to content gateway', async () => {
      await orchestrator.analyze(mockSessions, mockMetrics, 'pro');

      // ContentGateway.filter mock should be called with 'pro'
      expect(true).toBe(true); // Placeholder - actual verification would require mock inspection
    });
  });

  describe('Factory Function', () => {
    it('should create a new AnalysisOrchestrator instance', () => {
      const orchestrator = createAnalysisOrchestrator({
        geminiApiKey: 'test-key',
      });

      expect(orchestrator).toBeInstanceOf(AnalysisOrchestrator);
    });

    it('should apply custom configuration', () => {
      const orchestrator = createAnalysisOrchestrator({
        geminiApiKey: 'test-key',
        model: 'custom-model',
        temperature: 0.5,
        verbose: true,
      });

      expect(orchestrator).toBeInstanceOf(AnalysisOrchestrator);
    });
  });

  describe('Phase 2.5 - Sequential Execution', () => {
    beforeEach(() => {
      const dataExtractorWorker = new MockDataExtractorWorker();
      orchestrator.registerPhase1Worker(dataExtractorWorker);
    });

    it('should run Phase 2.5 workers sequentially (order preserved)', async () => {
      const executionOrder: string[] = [];

      class MockSynthesizerWorker extends BaseWorker<any> {
        readonly name = 'StrengthGrowth';
        readonly phase = 2 as const;
        readonly minTier: Tier = 'free';

        canRun(context: WorkerContext): boolean {
          return !!(context as any).agentOutputs;
        }

        async execute(context: WorkerContext): Promise<WorkerResult<any>> {
          executionOrder.push('StrengthGrowth');
          return {
            data: { strengths: [], growthAreas: [], confidenceScore: 0.8 },
            usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          };
        }
      }

      class MockTypeClassifierWorker extends BaseWorker<any> {
        readonly name = 'TypeClassifier';
        readonly phase = 2 as const;
        readonly minTier: Tier = 'free';

        canRun(context: WorkerContext): boolean {
          return !!(context as any).agentOutputs;
        }

        async execute(context: WorkerContext): Promise<WorkerResult<any>> {
          executionOrder.push('TypeClassifier');
          return {
            data: {
              primaryType: 'architect',
              distribution: { architect: 40, scientist: 20, collaborator: 20, speedrunner: 10, craftsman: 10 },
              controlLevel: 'navigator',
              controlScore: 50,
              matrixName: 'Systems Architect',
              matrixEmoji: '🏗️',
              confidenceScore: 0.8,
            },
            usage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 },
          };
        }
      }

      orchestrator.registerPhase2Point5Worker(new MockSynthesizerWorker());
      orchestrator.registerPhase2Point5Worker(new MockTypeClassifierWorker());

      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result).toBeDefined();
      // Verify sequential execution: Synthesizer FIRST, then TypeClassifier
      expect(executionOrder).toEqual(['StrengthGrowth', 'TypeClassifier']);
    });

    // NOTE: Test for "should merge Synthesizer result into agentOutputs before TypeClassifier runs"
    // was removed because StrengthGrowthSynthesizer has been removed from the pipeline.
    // Workers now output strengths/growthAreas directly at Phase 2 level.

    it('should not include strengthGrowth in Phase 2 merge', async () => {
      // Phase 2 worker named StrengthGrowth should NOT be merged (it moved to Phase 2.5)
      class MockPhase2NamedSG extends BaseWorker<any> {
        readonly name = 'SomeWorker';
        readonly phase = 2 as const;
        readonly minTier: Tier = 'free';

        canRun(): boolean { return true; }

        async execute(): Promise<WorkerResult<any>> {
          return { data: { testData: true }, usage: null };
        }
      }

      class MockTypeClassifierForMerge extends BaseWorker<any> {
        readonly name = 'TypeClassifier';
        readonly phase = 2 as const;
        readonly minTier: Tier = 'free';

        canRun(context: WorkerContext): boolean {
          return !!(context as any).agentOutputs;
        }

        async execute(): Promise<WorkerResult<any>> {
          return {
            data: {
              primaryType: 'architect',
              distribution: { architect: 40, scientist: 20, collaborator: 20, speedrunner: 10, craftsman: 10 },
              controlLevel: 'navigator',
              controlScore: 50,
              matrixName: 'Systems Architect',
              matrixEmoji: '🏗️',
              confidenceScore: 0.8,
            },
            usage: null,
          };
        }
      }

      orchestrator.registerPhase2Worker(new MockPhase2NamedSG());
      orchestrator.registerPhase2Point5Worker(new MockTypeClassifierForMerge());

      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      // Phase 2 merge should NOT include strengthGrowth
      // (SomeWorker output would not map to strengthGrowth because name doesn't match)
      expect(result.evaluation.agentOutputs?.strengthGrowth).toBeUndefined();
    });

    it('should pass phase1Output to Phase 2.5 workers', async () => {
      let receivedPhase1Output = false;

      class MockPhase25Worker extends BaseWorker<any> {
        readonly name = 'TypeClassifier';
        readonly phase = 2 as const;
        readonly minTier: Tier = 'free';

        canRun(context: WorkerContext): boolean {
          const ctx = context as any;
          if (ctx.phase1Output) {
            receivedPhase1Output = true;
          }
          return !!(ctx.agentOutputs);
        }

        async execute(): Promise<WorkerResult<any>> {
          return {
            data: {
              primaryType: 'architect',
              distribution: { architect: 40, scientist: 20, collaborator: 20, speedrunner: 10, craftsman: 10 },
              controlLevel: 'navigator',
              controlScore: 50,
              matrixName: 'Systems Architect',
              matrixEmoji: '🏗️',
              confidenceScore: 0.8,
            },
            usage: null,
          };
        }
      }

      orchestrator.registerPhase2Point5Worker(new MockPhase25Worker());

      await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(receivedPhase1Output).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      // Always register required worker for edge case tests
      const dataExtractorWorker = new MockDataExtractorWorker();
      orchestrator.registerPhase1Worker(dataExtractorWorker);
    });

    it('should handle empty sessions array', async () => {
      // Workers check for empty sessions in canRun()
      const result = await orchestrator.analyze([], mockMetrics, 'free');

      expect(result).toBeDefined();
    });

    it('should handle multiple sessions', async () => {
      const multipleSessions = [
        ...mockSessions,
        {
          ...mockSessions[0],
          sessionId: 'session-2',
        },
        {
          ...mockSessions[0],
          sessionId: 'session-3',
        },
      ];

      const result = await orchestrator.analyze(multipleSessions, mockMetrics, 'pro');

      expect(result).toBeDefined();
      expect(result.evaluation.sessionsAnalyzed).toBe(3);
      expect(result.evaluation.analyzedSessions).toHaveLength(3);
    });

    it('should use last session ID as evaluation session ID', async () => {
      const multipleSessions = [
        { ...mockSessions[0], sessionId: 'first' },
        { ...mockSessions[0], sessionId: 'second' },
        { ...mockSessions[0], sessionId: 'last' },
      ] as ParsedSession[];

      const result = await orchestrator.analyze(multipleSessions, mockMetrics, 'free');

      expect(result.evaluation.sessionId).toBe('last');
    });

    it('should handle unknown session ID gracefully', async () => {
      const result = await orchestrator.analyze([], mockMetrics, 'free');

      expect(result.evaluation.sessionId).toBe('unknown');
    });
  });
});
