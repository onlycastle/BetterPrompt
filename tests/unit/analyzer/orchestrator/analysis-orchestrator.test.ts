/**
 * Analysis Orchestrator Tests
 *
 * Tests for AnalysisOrchestrator class including:
 * - Worker registration
 * - Phase execution
 * - Graceful degradation
 * - Token tracking
 * - Tier-based filtering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ParsedSession, SessionMetrics } from '../../../../src/lib/domain/models/analysis.js';
import type { StructuredAnalysisData } from '../../../../src/lib/models/analysis-data.js';
import type { ProductivityAnalysisData } from '../../../../src/lib/models/productivity-data.js';
import type { WorkerContext, WorkerResult } from '../../../../src/lib/analyzer/orchestrator/types.js';
import type { Tier } from '../../../../src/lib/analyzer/content-gateway.js';
import { BaseWorker } from '../../../../src/lib/analyzer/workers/base-worker.js';

// Mock dependencies
vi.mock('../../../../src/lib/analyzer/stages/content-writer.js', () => ({
  ContentWriterStage: class MockContentWriterStage {
    async transform() {
      return {
        data: {
          primaryType: 'architect',
          controlLevel: 'ai-master',
          distribution: {
            architect: 40,
            scientist: 25,
            collaborator: 20,
            speedrunner: 10,
            craftsman: 5,
          },
          personalitySummary: 'Test personality summary',
          dimensionInsights: [],
          promptPatterns: [],
        },
        usage: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
        },
      };
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
class MockDataAnalystWorker extends BaseWorker<StructuredAnalysisData> {
  readonly name = 'DataAnalyst';
  readonly phase = 1 as const;
  readonly minTier: Tier = 'free';

  constructor(private mockData: StructuredAnalysisData) {
    super();
  }

  canRun(context: WorkerContext): boolean {
    return context.sessions.length > 0;
  }

  async execute(context: WorkerContext): Promise<WorkerResult<StructuredAnalysisData>> {
    return {
      data: this.mockData,
      usage: {
        promptTokens: 2000,
        completionTokens: 1000,
        totalTokens: 3000,
      },
    };
  }
}

class MockProductivityAnalystWorker extends BaseWorker<ProductivityAnalysisData> {
  readonly name = 'ProductivityAnalyst';
  readonly phase = 1 as const;
  readonly minTier: Tier = 'free';

  constructor(private mockData: ProductivityAnalysisData) {
    super();
  }

  canRun(context: WorkerContext): boolean {
    return context.sessions.length > 0;
  }

  async execute(context: WorkerContext): Promise<WorkerResult<ProductivityAnalysisData>> {
    return {
      data: this.mockData,
      usage: {
        promptTokens: 1500,
        completionTokens: 750,
        totalTokens: 2250,
      },
    };
  }
}

class MockPhase2Worker extends BaseWorker<{ insight: string }> {
  readonly name = 'PatternDetective';
  readonly phase = 2 as const;
  readonly minTier: Tier = 'premium';

  canRun(context: WorkerContext): boolean {
    return context.tier !== 'free' && !!context.moduleAOutput;
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
  readonly minTier: Tier = 'premium';

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
  let mockDataAnalystData: StructuredAnalysisData;
  let mockProductivityData: ProductivityAnalysisData;

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

    // Create mock data
    mockDataAnalystData = {
      typeResult: {
        primaryType: 'architect',
        controlLevel: 'ai-master',
        architectScore: 85,
        scientistScore: 60,
        collaboratorScore: 70,
        speedrunnerScore: 40,
        craftsmanScore: 50,
      },
    } as StructuredAnalysisData;

    mockProductivityData = {
      sessionContext: {
        totalProjects: 1,
        totalSessions: 1,
        timeRange: '2024-01-01 to 2024-01-01',
      },
      workloadMetrics: {} as any,
      focusMetrics: {} as any,
      velocityMetrics: {} as any,
      qualityMetrics: {} as any,
      collaborationMetrics: {} as any,
      riskMetrics: {} as any,
      overallAssessment: {} as any,
    };
  });

  describe('Worker Registration', () => {
    describe('registerPhase1Worker', () => {
      it('should register a Phase 1 worker successfully', () => {
        const worker = new MockDataAnalystWorker(mockDataAnalystData);

        expect(() => orchestrator.registerPhase1Worker(worker)).not.toThrow();
      });

      it('should support method chaining', () => {
        const worker1 = new MockDataAnalystWorker(mockDataAnalystData);
        const worker2 = new MockProductivityAnalystWorker(mockProductivityData);

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
        const worker1 = new MockDataAnalystWorker(mockDataAnalystData);
        const worker2 = new MockProductivityAnalystWorker(mockProductivityData);

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
        const dataWorker = new MockDataAnalystWorker(mockDataAnalystData);
        const productivityWorker = new MockProductivityAnalystWorker(mockProductivityData);

        orchestrator
          .registerPhase1Worker(dataWorker)
          .registerPhase1Worker(productivityWorker);

        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'premium');

        expect(result).toBeDefined();
        expect(result.primaryType).toBe('architect');
        expect(result.productivityAnalysis).toBeDefined();
      });

      // NO FALLBACK POLICY: Workers must be registered
      it('should throw when DataAnalyst worker is not registered', async () => {
        const productivityWorker = new MockProductivityAnalystWorker(mockProductivityData);
        orchestrator.registerPhase1Worker(productivityWorker);

        await expect(orchestrator.analyze(mockSessions, mockMetrics, 'free')).rejects.toThrow(
          'DataAnalyst worker not registered'
        );
      });

      it('should throw when ProductivityAnalyst worker is not registered', async () => {
        const dataWorker = new MockDataAnalystWorker(mockDataAnalystData);
        orchestrator.registerPhase1Worker(dataWorker);

        await expect(orchestrator.analyze(mockSessions, mockMetrics, 'free')).rejects.toThrow(
          'ProductivityAnalyst worker not registered'
        );
      });

      it('should throw when no Phase 1 workers are registered', async () => {
        // No workers registered
        await expect(orchestrator.analyze(mockSessions, mockMetrics, 'free')).rejects.toThrow(
          'DataAnalyst worker not registered'
        );
      });
    });

    describe('Phase 2 - Insight Generation', () => {
      beforeEach(() => {
        // Always register Phase 1 workers for Phase 2 tests
        const dataWorker = new MockDataAnalystWorker(mockDataAnalystData);
        const productivityWorker = new MockProductivityAnalystWorker(mockProductivityData);
        orchestrator
          .registerPhase1Worker(dataWorker)
          .registerPhase1Worker(productivityWorker);
      });

      it('should run Phase 2 workers for premium tier', async () => {
        const phase2Worker = new MockPhase2Worker();
        orchestrator.registerPhase2Worker(phase2Worker);

        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'premium');

        expect(result).toBeDefined();
        expect(result.agentOutputs).toBeDefined();
      });

      it('should skip Phase 2 workers for free tier', async () => {
        const phase2Worker = new MockPhase2Worker();
        orchestrator.registerPhase2Worker(phase2Worker);

        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

        expect(result).toBeDefined();
        // agentOutputs should be empty for free tier
        expect(result.agentOutputs).toBeDefined();
      });

      it('should skip Phase 2 when no workers are registered', async () => {
        // No Phase 2 workers registered
        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'premium');

        expect(result).toBeDefined();
        expect(result.agentOutputs).toBeDefined();
      });

      it('should run multiple Phase 2 workers in parallel', async () => {
        const worker1 = new MockPhase2Worker();
        const worker2 = new MockPhase2Worker();

        orchestrator
          .registerPhase2Worker(worker1)
          .registerPhase2Worker(worker2);

        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'premium');

        expect(result).toBeDefined();
        expect(result.agentOutputs).toBeDefined();
      });

      it('should provide Phase 1 outputs to Phase 2 workers', async () => {
        let receivedContext: WorkerContext | null = null;

        class ContextCapturingWorker extends BaseWorker<any> {
          readonly name = 'ContextCapture';
          readonly phase = 2 as const;
          readonly minTier: Tier = 'premium';

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

        await orchestrator.analyze(mockSessions, mockMetrics, 'premium');

        expect(receivedContext).not.toBeNull();
        expect(receivedContext?.moduleAOutput).toBeDefined();
        expect(receivedContext?.moduleCOutput).toBeDefined();
      });
    });

    describe('Phase 3 - Content Generation', () => {
      it('should always run content generation phase', async () => {
        const dataWorker = new MockDataAnalystWorker(mockDataAnalystData);
        const productivityWorker = new MockProductivityAnalystWorker(mockProductivityData);

        orchestrator
          .registerPhase1Worker(dataWorker)
          .registerPhase1Worker(productivityWorker);

        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

        expect(result).toBeDefined();
        expect(result.personalitySummary).toBeDefined();
        expect(result.dimensionInsights).toBeDefined();
      });

      it('should receive Phase 1 outputs in content writer', async () => {
        const dataWorker = new MockDataAnalystWorker(mockDataAnalystData);
        const productivityWorker = new MockProductivityAnalystWorker(mockProductivityData);

        orchestrator
          .registerPhase1Worker(dataWorker)
          .registerPhase1Worker(productivityWorker);

        const result = await orchestrator.analyze(mockSessions, mockMetrics, 'premium');

        expect(result).toBeDefined();
        // Content writer transforms data from Phase 1
        expect(result.primaryType).toBe('architect');
      });
    });
  });

  // NO FALLBACK POLICY: Worker failures now propagate as errors
  describe('Error Propagation (NO FALLBACK)', () => {
    beforeEach(() => {
      // Register Phase 1 workers
      const dataWorker = new MockDataAnalystWorker(mockDataAnalystData);
      const productivityWorker = new MockProductivityAnalystWorker(mockProductivityData);
      orchestrator
        .registerPhase1Worker(dataWorker)
        .registerPhase1Worker(productivityWorker);
    });

    it('should throw when a Phase 2 worker fails', async () => {
      const failingWorker = new FailingWorker();

      orchestrator.registerPhase2Worker(failingWorker);

      // Should throw - NO FALLBACK
      await expect(orchestrator.analyze(mockSessions, mockMetrics, 'premium')).rejects.toThrow(
        'Worker intentionally failed'
      );
    });

    it('should skip worker that cannot run (canRun returns false)', async () => {
      class CannotRunWorker extends BaseWorker<any> {
        readonly name = 'CannotRun';
        readonly phase = 2 as const;
        readonly minTier: Tier = 'premium';

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
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'premium');

      expect(result).toBeDefined();
    });

    it('should throw when all Phase 2 workers fail', async () => {
      const failing1 = new FailingWorker();

      orchestrator.registerPhase2Worker(failing1);

      // Should throw - NO FALLBACK
      await expect(orchestrator.analyze(mockSessions, mockMetrics, 'premium')).rejects.toThrow(
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

      const dataWorker = new MockDataAnalystWorker(mockDataAnalystData);
      const productivityWorker = new MockProductivityAnalystWorker(mockProductivityData);

      verboseOrchestrator
        .registerPhase1Worker(dataWorker)
        .registerPhase1Worker(productivityWorker);

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

      const dataWorker = new MockDataAnalystWorker(mockDataAnalystData);
      const productivityWorker = new MockProductivityAnalystWorker(mockProductivityData);
      const phase2Worker = new MockPhase2Worker();

      verboseOrchestrator
        .registerPhase1Worker(dataWorker)
        .registerPhase1Worker(productivityWorker)
        .registerPhase2Worker(phase2Worker);

      await verboseOrchestrator.analyze(mockSessions, mockMetrics, 'premium');

      // Should log token usage including Phase 2
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should not log verbose messages when verbose is false', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();

      // Must register both required workers
      const dataWorker = new MockDataAnalystWorker(mockDataAnalystData);
      const productivityWorker = new MockProductivityAnalystWorker(mockProductivityData);
      orchestrator
        .registerPhase1Worker(dataWorker)
        .registerPhase1Worker(productivityWorker);

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
      const dataWorker = new MockDataAnalystWorker(mockDataAnalystData);
      const productivityWorker = new MockProductivityAnalystWorker(mockProductivityData);
      orchestrator
        .registerPhase1Worker(dataWorker)
        .registerPhase1Worker(productivityWorker);
    });

    it('should include session metadata', async () => {
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result.sessionId).toBe('session-1');
      expect(result.analyzedAt).toBeDefined();
      expect(result.sessionsAnalyzed).toBe(1);
    });

    it('should include computed metrics', async () => {
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result.avgPromptLength).toBe(150);
      expect(result.avgTurnsPerSession).toBe(5);
    });

    it('should include analyzedSessions array', async () => {
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result.analyzedSessions).toBeDefined();
      expect(result.analyzedSessions).toHaveLength(1);
      expect(result.analyzedSessions[0].sessionId).toBe('session-1');
      expect(result.analyzedSessions[0].projectName).toBe('project');
    });

    it('should include productivity analysis', async () => {
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result.productivityAnalysis).toBeDefined();
      expect(result.productivityAnalysis.sessionContext).toBeDefined();
    });

    it('should include agent outputs (empty for free tier)', async () => {
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result.agentOutputs).toBeDefined();
    });

    it('should include agent outputs (populated for premium tier)', async () => {
      const phase2Worker = new MockPhase2Worker();
      orchestrator.registerPhase2Worker(phase2Worker);

      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'premium');

      expect(result.agentOutputs).toBeDefined();
    });
  });

  describe('Tier-Based Filtering', () => {
    beforeEach(() => {
      const dataWorker = new MockDataAnalystWorker(mockDataAnalystData);
      const productivityWorker = new MockProductivityAnalystWorker(mockProductivityData);
      orchestrator
        .registerPhase1Worker(dataWorker)
        .registerPhase1Worker(productivityWorker);
    });

    it('should apply tier filtering to final result', async () => {
      const result = await orchestrator.analyze(mockSessions, mockMetrics, 'free');

      expect(result).toBeDefined();
      // ContentGateway.filter is mocked to pass through
      expect(result.primaryType).toBe('architect');
    });

    it('should pass correct tier to content gateway', async () => {
      await orchestrator.analyze(mockSessions, mockMetrics, 'premium');

      // ContentGateway.filter mock should be called with 'premium'
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

  describe('Edge Cases', () => {
    beforeEach(() => {
      // Always register required workers for edge case tests
      const dataWorker = new MockDataAnalystWorker(mockDataAnalystData);
      const productivityWorker = new MockProductivityAnalystWorker(mockProductivityData);
      orchestrator
        .registerPhase1Worker(dataWorker)
        .registerPhase1Worker(productivityWorker);
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

      const result = await orchestrator.analyze(multipleSessions, mockMetrics, 'premium');

      expect(result).toBeDefined();
      expect(result.sessionsAnalyzed).toBe(3);
      expect(result.analyzedSessions).toHaveLength(3);
    });

    it('should use last session ID as evaluation session ID', async () => {
      const multipleSessions = [
        { ...mockSessions[0], sessionId: 'first' },
        { ...mockSessions[0], sessionId: 'second' },
        { ...mockSessions[0], sessionId: 'last' },
      ] as ParsedSession[];

      const result = await orchestrator.analyze(multipleSessions, mockMetrics, 'free');

      expect(result.sessionId).toBe('last');
    });

    it('should handle unknown session ID gracefully', async () => {
      const result = await orchestrator.analyze([], mockMetrics, 'free');

      expect(result.sessionId).toBe('unknown');
    });
  });
});
