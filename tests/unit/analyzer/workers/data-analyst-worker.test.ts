/**
 * DataAnalystWorker Tests
 *
 * Tests for Phase 1 DataAnalystWorker that wraps DataAnalystStage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorkerContext, WorkerResult } from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { StructuredAnalysisData } from '../../../../src/lib/models/analysis-data.js';

// Mock the DataAnalystStage
vi.mock('../../../../src/lib/analyzer/stages/data-analyst.js', () => ({
  DataAnalystStage: vi.fn().mockImplementation(() => ({
    analyze: vi.fn(),
  })),
}));

// Import after mocking
import {
  DataAnalystWorker,
  createDataAnalystWorker,
  type DataAnalystWorkerConfig,
} from '../../../../src/lib/analyzer/workers/data-analyst-worker.js';
import { DataAnalystStage } from '../../../../src/lib/analyzer/stages/data-analyst.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockContext(): WorkerContext {
  return {
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
}

function createMockAnalysisData(): StructuredAnalysisData {
  return {
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
      reasoning: 'Test reasoning',
    },
    extractedQuotes: [
      {
        quote: 'Let me plan this carefully',
        sessionDate: '2024-01-01',
        dimension: 'aiCollaboration',
        signal: 'strength',
        behavioralMarker: 'Strategic planning',
        confidence: 0.9,
      },
    ],
    detectedPatterns: [
      {
        patternId: 'pattern-1',
        patternType: 'communication_style',
        frequency: 5,
        examples: ['Example 1', 'Example 2'],
        significance: 'Shows strong planning habits',
      },
    ],
    dimensionSignals: [
      { dimension: 'aiCollaboration', strengthSignals: ['planning'], growthSignals: [] },
      { dimension: 'contextEngineering', strengthSignals: [], growthSignals: [] },
      { dimension: 'toolMastery', strengthSignals: [], growthSignals: [] },
      { dimension: 'burnoutRisk', strengthSignals: [], growthSignals: [] },
      { dimension: 'aiControl', strengthSignals: [], growthSignals: [] },
      { dimension: 'skillResilience', strengthSignals: [], growthSignals: [] },
    ],
    analysisMetadata: {
      totalQuotesAnalyzed: 1,
      coverageScores: [
        { dimension: 'aiCollaboration', score: 0.8 },
        { dimension: 'contextEngineering', score: 0.6 },
        { dimension: 'toolMastery', score: 0.5 },
        { dimension: 'burnoutRisk', score: 0.4 },
        { dimension: 'aiControl', score: 0.7 },
        { dimension: 'skillResilience', score: 0.6 },
      ],
      confidenceScore: 0.85,
    },
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('DataAnalystWorker', () => {
  let worker: DataAnalystWorker;
  let context: WorkerContext;
  let mockAnalyze: any;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createMockContext();

    // Set up mock for analyze method
    mockAnalyze = vi.fn();
    vi.mocked(DataAnalystStage).mockImplementation(
      () =>
        ({
          analyze: mockAnalyze,
        }) as any
    );

    worker = new DataAnalystWorker();
  });

  describe('worker properties', () => {
    it('should have correct name', () => {
      expect(worker.name).toBe('DataAnalyst');
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
      const worker = new DataAnalystWorker();
      expect(worker).toBeDefined();
      expect(worker.name).toBe('DataAnalyst');
    });

    it('should create worker with custom config', () => {
      const config: DataAnalystWorkerConfig = {
        apiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.0,
        maxOutputTokens: 8192,
        maxRetries: 3,
        verbose: true,
      };
      const worker = new DataAnalystWorker(config);
      expect(worker).toBeDefined();
    });

    it('should pass config to stage', () => {
      const config: DataAnalystWorkerConfig = {
        apiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.5,
        maxRetries: 5,
      };

      const worker = new DataAnalystWorker(config);
      const MockedStage = vi.mocked(DataAnalystStage);

      expect(MockedStage).toHaveBeenCalledWith({
        apiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.5,
        maxRetries: 5,
      });
    });
  });

  describe('canRun()', () => {
    it('should return true when sessions and metrics exist', () => {
      expect(worker.canRun(context)).toBe(true);
    });

    it('should return false when no sessions', () => {
      context.sessions = [];
      expect(worker.canRun(context)).toBe(false);
    });

    it('should return false when metrics undefined', () => {
      const contextWithoutMetrics = {
        ...context,
        metrics: undefined as any,
      };
      expect(worker.canRun(contextWithoutMetrics)).toBe(false);
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
    it('should throw when metrics missing', async () => {
      const contextWithoutMetrics = {
        ...context,
        metrics: undefined as any,
      };

      await expect(worker.execute(contextWithoutMetrics)).rejects.toThrow(
        'Metrics required for data analysis'
      );
    });

    it('should execute stage and return result', async () => {
      const mockData = createMockAnalysisData();
      mockAnalyze.mockResolvedValue({
        data: mockData,
        usage: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
        },
      });

      const result = await worker.execute(context);

      expect(mockAnalyze).toHaveBeenCalledWith(context.sessions, context.metrics);
      expect(result.data).toEqual(mockData);
      expect(result.usage).toEqual({
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      });
      expect(result.error).toBeUndefined();
    });

    it('should log progress when verbose enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseWorker = new DataAnalystWorker({ verbose: true });

      const mockData = createMockAnalysisData();
      mockAnalyze.mockResolvedValue({
        data: mockData,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await verboseWorker.execute(context);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[DataAnalystWorker] Analyzing sessions for behavioral patterns...'
      );
      expect(consoleSpy).toHaveBeenCalledWith('[DataAnalystWorker] Extracted 1 quotes');
      expect(consoleSpy).toHaveBeenCalledWith('[DataAnalystWorker] Detected 1 patterns');

      consoleSpy.mockRestore();
    });

    it('should throw on stage execution failure (NO FALLBACK policy)', async () => {
      const error = new Error('Stage execution failed');
      mockAnalyze.mockRejectedValue(error);

      await expect(worker.execute(context)).rejects.toThrow('Stage execution failed');
    });

    it('should throw on non-Error throws (NO FALLBACK policy)', async () => {
      mockAnalyze.mockRejectedValue('string error');

      await expect(worker.execute(context)).rejects.toBe('string error');
    });
  });

  describe('factory function', () => {
    it('should create worker with default config', () => {
      const worker = createDataAnalystWorker();
      expect(worker).toBeInstanceOf(DataAnalystWorker);
      expect(worker.name).toBe('DataAnalyst');
    });

    it('should create worker with custom config', () => {
      const config: DataAnalystWorkerConfig = {
        apiKey: 'test-key',
        verbose: true,
      };
      const worker = createDataAnalystWorker(config);
      expect(worker).toBeInstanceOf(DataAnalystWorker);
    });
  });
});
