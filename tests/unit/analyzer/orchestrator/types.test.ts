/**
 * Orchestrator Types Tests
 *
 * Tests for orchestrator type definitions and utility functions.
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateWorkerTokenUsage,
  DEFAULT_ORCHESTRATOR_CONFIG,
  PHASE_CONFIGS,
  type WorkerResult,
  type WorkerContext,
  type AggregatedTokenUsage,
  type Phase,
} from '../../../../src/lib/analyzer/orchestrator/types.js';
import type { TokenUsage } from '../../../../src/lib/analyzer/clients/gemini-client.js';

describe('Orchestrator Types', () => {
  describe('PHASE_CONFIGS', () => {
    it('should define Phase 1 as Data Extraction with parallel execution', () => {
      const phase1 = PHASE_CONFIGS[1];

      expect(phase1.phase).toBe(1);
      expect(phase1.name).toBe('Data Extraction');
      expect(phase1.parallel).toBe(true);
    });

    it('should define Phase 2 as Insight Generation with parallel execution', () => {
      const phase2 = PHASE_CONFIGS[2];

      expect(phase2.phase).toBe(2);
      expect(phase2.name).toBe('Insight Generation');
      expect(phase2.parallel).toBe(true);
    });

    it('should define Phase 3 as Content Generation with sequential execution', () => {
      const phase3 = PHASE_CONFIGS[3];

      expect(phase3.phase).toBe(3);
      expect(phase3.name).toBe('Content Generation');
      expect(phase3.parallel).toBe(false);
    });

    it('should have all three phases defined', () => {
      const phases = Object.keys(PHASE_CONFIGS);

      expect(phases).toHaveLength(3);
      expect(phases).toContain('1');
      expect(phases).toContain('2');
      expect(phases).toContain('3');
    });
  });

  describe('DEFAULT_ORCHESTRATOR_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_ORCHESTRATOR_CONFIG.model).toBe('gemini-3-flash-preview');
      expect(DEFAULT_ORCHESTRATOR_CONFIG.temperature).toBe(1.0);
      expect(DEFAULT_ORCHESTRATOR_CONFIG.maxOutputTokens).toBe(65536);
      expect(DEFAULT_ORCHESTRATOR_CONFIG.maxRetries).toBe(2);
      expect(DEFAULT_ORCHESTRATOR_CONFIG.continueOnWorkerFailure).toBe(true);
      expect(DEFAULT_ORCHESTRATOR_CONFIG.verbose).toBe(false);
    });

    it('should not include geminiApiKey', () => {
      expect('geminiApiKey' in DEFAULT_ORCHESTRATOR_CONFIG).toBe(false);
    });
  });

  describe('aggregateWorkerTokenUsage', () => {
    it('should aggregate token usage from multiple workers', () => {
      const results: Record<string, WorkerResult<unknown>> = {
        worker1: {
          data: {},
          usage: {
            promptTokens: 1000,
            completionTokens: 500,
            totalTokens: 1500,
          },
        },
        worker2: {
          data: {},
          usage: {
            promptTokens: 2000,
            completionTokens: 800,
            totalTokens: 2800,
          },
        },
        worker3: {
          data: {},
          usage: {
            promptTokens: 1500,
            completionTokens: 700,
            totalTokens: 2200,
          },
        },
      };

      const aggregated = aggregateWorkerTokenUsage(results);

      expect(aggregated.totalPromptTokens).toBe(4500); // 1000 + 2000 + 1500
      expect(aggregated.totalCompletionTokens).toBe(2000); // 500 + 800 + 700
      expect(aggregated.totalTokens).toBe(6500); // 1500 + 2800 + 2200
    });

    it('should include per-worker breakdown', () => {
      const results: Record<string, WorkerResult<unknown>> = {
        worker1: {
          data: {},
          usage: {
            promptTokens: 1000,
            completionTokens: 500,
            totalTokens: 1500,
          },
        },
        worker2: {
          data: {},
          usage: {
            promptTokens: 2000,
            completionTokens: 800,
            totalTokens: 2800,
          },
        },
      };

      const aggregated = aggregateWorkerTokenUsage(results);

      expect(aggregated.byWorker).toEqual({
        worker1: {
          promptTokens: 1000,
          completionTokens: 500,
          totalTokens: 1500,
        },
        worker2: {
          promptTokens: 2000,
          completionTokens: 800,
          totalTokens: 2800,
        },
      });
    });

    it('should skip workers with null usage', () => {
      const results: Record<string, WorkerResult<unknown>> = {
        worker1: {
          data: {},
          usage: {
            promptTokens: 1000,
            completionTokens: 500,
            totalTokens: 1500,
          },
        },
        worker2: {
          data: {},
          usage: null,
        },
        worker3: {
          data: {},
          usage: {
            promptTokens: 500,
            completionTokens: 250,
            totalTokens: 750,
          },
        },
      };

      const aggregated = aggregateWorkerTokenUsage(results);

      expect(aggregated.totalPromptTokens).toBe(1500); // Only worker1 + worker3
      expect(aggregated.totalCompletionTokens).toBe(750);
      expect(aggregated.totalTokens).toBe(2250);
      expect(aggregated.byWorker).not.toHaveProperty('worker2');
    });

    it('should return zero totals for empty results', () => {
      const results: Record<string, WorkerResult<unknown>> = {};

      const aggregated = aggregateWorkerTokenUsage(results);

      expect(aggregated.totalPromptTokens).toBe(0);
      expect(aggregated.totalCompletionTokens).toBe(0);
      expect(aggregated.totalTokens).toBe(0);
      expect(aggregated.byWorker).toEqual({});
    });

    it('should return zero totals when all workers have null usage', () => {
      const results: Record<string, WorkerResult<unknown>> = {
        worker1: {
          data: {},
          usage: null,
        },
        worker2: {
          data: {},
          usage: null,
        },
      };

      const aggregated = aggregateWorkerTokenUsage(results);

      expect(aggregated.totalPromptTokens).toBe(0);
      expect(aggregated.totalCompletionTokens).toBe(0);
      expect(aggregated.totalTokens).toBe(0);
      expect(aggregated.byWorker).toEqual({});
    });

    it('should handle single worker result', () => {
      const results: Record<string, WorkerResult<unknown>> = {
        onlyWorker: {
          data: {},
          usage: {
            promptTokens: 1000,
            completionTokens: 500,
            totalTokens: 1500,
          },
        },
      };

      const aggregated = aggregateWorkerTokenUsage(results);

      expect(aggregated.totalPromptTokens).toBe(1000);
      expect(aggregated.totalCompletionTokens).toBe(500);
      expect(aggregated.totalTokens).toBe(1500);
      expect(aggregated.byWorker.onlyWorker).toEqual({
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
      });
    });

    it('should handle zero token values', () => {
      const results: Record<string, WorkerResult<unknown>> = {
        worker1: {
          data: {},
          usage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        },
      };

      const aggregated = aggregateWorkerTokenUsage(results);

      expect(aggregated.totalPromptTokens).toBe(0);
      expect(aggregated.totalCompletionTokens).toBe(0);
      expect(aggregated.totalTokens).toBe(0);
      expect(aggregated.byWorker.worker1).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    });

    it('should maintain correct structure of AggregatedTokenUsage', () => {
      const results: Record<string, WorkerResult<unknown>> = {
        worker1: {
          data: {},
          usage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        },
      };

      const aggregated = aggregateWorkerTokenUsage(results);

      // Type check: should have all required properties
      expect(aggregated).toHaveProperty('totalPromptTokens');
      expect(aggregated).toHaveProperty('totalCompletionTokens');
      expect(aggregated).toHaveProperty('totalTokens');
      expect(aggregated).toHaveProperty('byWorker');

      // Type check: byWorker should be a record
      expect(typeof aggregated.byWorker).toBe('object');
    });
  });

  describe('WorkerResult type', () => {
    it('should allow successful result with data and usage', () => {
      const result: WorkerResult<{ value: number }> = {
        data: { value: 42 },
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      };

      expect(result.data.value).toBe(42);
      expect(result.usage?.totalTokens).toBe(150);
      expect(result.error).toBeUndefined();
    });

    it('should allow failed result with error and null usage', () => {
      const error = new Error('Worker failed');
      const result: WorkerResult<{ value: number }> = {
        data: { value: 0 },
        usage: null,
        error,
      };

      expect(result.data.value).toBe(0);
      expect(result.usage).toBeNull();
      expect(result.error).toBe(error);
    });

    it('should allow result without error field', () => {
      const result: WorkerResult<string> = {
        data: 'success',
        usage: {
          promptTokens: 50,
          completionTokens: 25,
          totalTokens: 75,
        },
      };

      expect(result.data).toBe('success');
      expect(result.error).toBeUndefined();
    });
  });

  describe('WorkerContext type', () => {
    it('should support Phase 1 context without Phase 1 outputs', () => {
      const context: WorkerContext = {
        sessions: [],
        metrics: {
          avgPromptLength: 100,
          avgTurnsPerSession: 5,
          totalSessions: 3,
          totalMessages: 15,
        },
        tier: 'premium',
      };

      expect(context.tier).toBe('premium');
      expect(context.moduleAOutput).toBeUndefined();
      expect(context.moduleCOutput).toBeUndefined();
    });

    it('should support Phase 2 context with Phase 1 outputs', () => {
      const context: WorkerContext = {
        sessions: [],
        metrics: {
          avgPromptLength: 100,
          avgTurnsPerSession: 5,
          totalSessions: 3,
          totalMessages: 15,
        },
        tier: 'premium',
        moduleAOutput: {
          typeResult: {
            primaryType: 'architect',
            controlLevel: 'cartographer',
            architectScore: 85,
            scientistScore: 60,
            collaboratorScore: 70,
            speedrunnerScore: 40,
            craftsmanScore: 50,
          },
        } as any,
        moduleCOutput: {} as any,
      };

      expect(context.moduleAOutput).toBeDefined();
      expect(context.moduleCOutput).toBeDefined();
    });
  });
});
