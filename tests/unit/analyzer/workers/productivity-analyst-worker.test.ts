/**
 * ProductivityAnalystWorker Tests
 *
 * Tests for Phase 1 ProductivityAnalystWorker that wraps ProductivityAnalystStage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerContext } from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { ProductivityAnalysisData } from '../../../../src/lib/models/productivity-data.js';
import type { StructuredAnalysisData } from '../../../../src/lib/models/analysis-data.js';

// Mock the ProductivityAnalystStage
vi.mock('../../../../src/lib/analyzer/stages/productivity-analyst.js', () => ({
  ProductivityAnalystStage: vi.fn().mockImplementation(() => ({
    analyze: vi.fn(),
  })),
}));

// Import after mocking
import {
  ProductivityAnalystWorker,
  createProductivityAnalystWorker,
  type ProductivityAnalystWorkerConfig,
} from '../../../../src/lib/analyzer/workers/productivity-analyst-worker.js';
import { ProductivityAnalystStage } from '../../../../src/lib/analyzer/stages/productivity-analyst.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockContext(includeModuleA = true): WorkerContext {
  const baseContext: WorkerContext = {
    sessions: [
      {
        sessionId: 'session-1',
        startedAt: new Date('2024-01-01T10:00:00Z'),
        turns: [],
      },
    ],
    metrics: {
      totalSessions: 1,
      totalTurns: 10,
      averageTurnsPerSession: 10,
      sessionDurations: [3600000],
      averageSessionDuration: 3600000,
    },
    tier: 'free',
  };

  if (includeModuleA) {
    baseContext.moduleAOutput = {
      typeAnalysis: {
        primaryType: 'architect',
        controlLevel: 'cartographer',
        distribution: {
          architect: 40,
          scientist: 20,
          collaborator: 20,
          speedrunner: 10,
          craftsman: 10,
        },
        reasoning: 'Test reasoning',
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
    };
  }

  return baseContext;
}

function createMockProductivityData(): ProductivityAnalysisData {
  return {
    iterationCyclesData: 'cycle_1:4:error_fix:resolved:efficient:Fixed the bug',
    learningSignalsData: 'React hooks:new_api:deep:0.8:Asked about cleanup',
    efficiencyMetricsData: 'firstTrySuccessRate:0.75:good',
    iterationSummary: {
      totalCycles: 5,
      avgTurnsPerCycle: 3.5,
      efficientCycleRate: 0.8,
      mostCommonTrigger: 'error_fix',
      predominantResolution: 'resolved',
    },
    learningVelocity: {
      signalsPerSession: 2.5,
      avgDepth: 'moderate',
      learningStyle: 'balanced',
      overallTransferability: 0.7,
    },
    keyIndicators: {
      firstTrySuccessRate: 0.75,
      contextSwitchFrequency: 2,
      productiveTurnRatio: 0.85,
      avgTurnsToFirstSolution: 3,
    },
    collaborationEfficiency: {
      requestClarity: 0.8,
      specificationCompleteness: 0.75,
      proactiveVsReactiveRatio: 1.5,
      contextProvisionFrequency: 0.7,
    },
    overallProductivityScore: 78,
    confidenceScore: 0.85,
    summary: 'Strong productivity with efficient iteration patterns',
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('ProductivityAnalystWorker', () => {
  let worker: ProductivityAnalystWorker;
  let context: WorkerContext;
  let mockAnalyze: any;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createMockContext(true);

    // Set up mock for analyze method
    mockAnalyze = vi.fn();
    vi.mocked(ProductivityAnalystStage).mockImplementation(
      () =>
        ({
          analyze: mockAnalyze,
        }) as any
    );

    worker = new ProductivityAnalystWorker();
  });

  describe('worker properties', () => {
    it('should have correct name', () => {
      expect(worker.name).toBe('ProductivityAnalyst');
    });

    it('should be phase 1 worker', () => {
      expect(worker.phase).toBe(1);
    });

    it('should require free tier', () => {
      expect(worker.minTier).toBe('free');
    });
  });

  describe('constructor', () => {
    it('should create worker with default config', () => {
      const worker = new ProductivityAnalystWorker();
      expect(worker).toBeDefined();
      expect(worker.name).toBe('ProductivityAnalyst');
    });

    it('should create worker with custom config', () => {
      const config: ProductivityAnalystWorkerConfig = {
        apiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.0,
        maxOutputTokens: 8192,
        maxRetries: 3,
        verbose: true,
      };
      const worker = new ProductivityAnalystWorker(config);
      expect(worker).toBeDefined();
    });

    it('should pass config to stage', () => {
      const config: ProductivityAnalystWorkerConfig = {
        apiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.5,
        maxRetries: 5,
      };

      const worker = new ProductivityAnalystWorker(config);
      const MockedStage = vi.mocked(ProductivityAnalystStage);

      expect(MockedStage).toHaveBeenCalledWith({
        apiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.5,
        maxRetries: 5,
      });
    });
  });

  describe('canRun()', () => {
    it('should return true when sessions and moduleAOutput exist', () => {
      expect(worker.canRun(context)).toBe(true);
    });

    it('should return false when no sessions', () => {
      context.sessions = [];
      expect(worker.canRun(context)).toBe(false);
    });

    it('should return false when moduleAOutput missing', () => {
      const contextWithoutModuleA = createMockContext(false);
      expect(worker.canRun(contextWithoutModuleA)).toBe(false);
    });

    it('should return true for all tier levels', () => {
      const freeTierContext = { ...context, tier: 'free' as const };
      const premiumTierContext = { ...context, tier: 'premium' as const };
      const enterpriseTierContext = { ...context, tier: 'enterprise' as const };

      expect(worker.canRun(freeTierContext)).toBe(true);
      expect(worker.canRun(premiumTierContext)).toBe(true);
      expect(worker.canRun(enterpriseTierContext)).toBe(true);
    });
  });

  describe('execute()', () => {
    it('should return default data when moduleAOutput missing', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseWorker = new ProductivityAnalystWorker({ verbose: true });
      const contextWithoutModuleA = createMockContext(false);

      const result = await verboseWorker.execute(contextWithoutModuleA);

      expect(result.data).toBeDefined();
      expect(result.data.overallProductivityScore).toBe(50);
      expect(result.usage).toBeNull();
      expect(result.error).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No Module A output available')
      );

      consoleSpy.mockRestore();
    });

    it('should execute stage and return result', async () => {
      const mockData = createMockProductivityData();
      mockAnalyze.mockResolvedValue({
        data: mockData,
        usage: {
          promptTokens: 800,
          completionTokens: 400,
          totalTokens: 1200,
        },
      });

      const result = await worker.execute(context);

      expect(mockAnalyze).toHaveBeenCalledWith(context.sessions, context.moduleAOutput);
      expect(result.data).toEqual(mockData);
      expect(result.usage).toEqual({
        promptTokens: 800,
        completionTokens: 400,
        totalTokens: 1200,
      });
      expect(result.error).toBeUndefined();
    });

    it('should log progress when verbose enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseWorker = new ProductivityAnalystWorker({ verbose: true });

      const mockData = createMockProductivityData();
      mockAnalyze.mockResolvedValue({
        data: mockData,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await verboseWorker.execute(context);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ProductivityAnalystWorker] Analyzing productivity metrics...'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ProductivityAnalystWorker] Productivity score: 78'
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ProductivityAnalystWorker] Iteration cycles detected: 5'
      );

      consoleSpy.mockRestore();
    });

    it('should return default data when stage execution fails', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseWorker = new ProductivityAnalystWorker({ verbose: true });

      const error = new Error('Stage execution failed');
      mockAnalyze.mockRejectedValue(error);

      const result = await verboseWorker.execute(context);

      expect(result.data).toBeDefined();
      expect(result.data.overallProductivityScore).toBe(50);
      expect(result.usage).toBeNull();
      expect(result.error).toBeUndefined(); // Returns success with default data
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Analysis failed: Error: Stage execution failed')
      );

      consoleSpy.mockRestore();
    });

    it('should handle result with null usage as default data scenario', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseWorker = new ProductivityAnalystWorker({ verbose: true });

      const mockData = createMockProductivityData();
      mockAnalyze.mockResolvedValue({
        data: mockData,
        usage: null, // Indicates insufficient data
      });

      const result = await verboseWorker.execute(context);

      expect(result.data).toEqual(mockData);
      expect(result.usage).toBeNull();
      expect(result.error).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[ProductivityAnalystWorker] Using default data (insufficient data or error)'
      );

      consoleSpy.mockRestore();
    });

    it('should return default data for non-Error throws', async () => {
      mockAnalyze.mockRejectedValue('string error');

      const result = await worker.execute(context);

      expect(result.data).toBeDefined();
      expect(result.data.overallProductivityScore).toBe(50);
      expect(result.usage).toBeNull();
      expect(result.error).toBeUndefined();
    });
  });

  describe('factory function', () => {
    it('should create worker with default config', () => {
      const worker = createProductivityAnalystWorker();
      expect(worker).toBeInstanceOf(ProductivityAnalystWorker);
      expect(worker.name).toBe('ProductivityAnalyst');
    });

    it('should create worker with custom config', () => {
      const config: ProductivityAnalystWorkerConfig = {
        apiKey: 'test-key',
        verbose: true,
      };
      const worker = createProductivityAnalystWorker(config);
      expect(worker).toBeInstanceOf(ProductivityAnalystWorker);
    });
  });
});
