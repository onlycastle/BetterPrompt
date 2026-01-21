/**
 * BaseWorker Tests
 *
 * Tests for the abstract BaseWorker class.
 *
 * NOTE: runWorkerSafely and runWorkersInParallel functions were removed
 * as part of the NO FALLBACK policy. Workers now throw errors instead
 * of returning fallback data.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BaseWorker,
  type WorkerContext,
  type WorkerResult,
} from '../../../../src/lib/analyzer/workers/base-worker.js';
import type { OrchestratorConfig } from '../../../../src/lib/analyzer/orchestrator/types.js';

// ============================================================================
// Mock Worker Implementation
// ============================================================================

class MockWorker extends BaseWorker<string> {
  readonly name = 'MockWorker';
  readonly phase = 1 as const;
  readonly minTier = 'free' as const;

  canRun(context: WorkerContext): boolean {
    return this.checkBasicPreconditions(context);
  }

  async execute(context: WorkerContext): Promise<WorkerResult<string>> {
    this.log('Executing mock worker');
    return this.createSuccessResult('mock data', {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
  }
}

class FailingWorker extends BaseWorker<string> {
  readonly name = 'FailingWorker';
  readonly phase = 1 as const;
  readonly minTier = 'free' as const;

  canRun(_context: WorkerContext): boolean {
    return true;
  }

  async execute(_context: WorkerContext): Promise<WorkerResult<string>> {
    throw new Error('Worker execution failed');
  }
}

class PremiumWorker extends BaseWorker<string> {
  readonly name = 'PremiumWorker';
  readonly phase = 2 as const;
  readonly minTier = 'premium' as const;

  canRun(context: WorkerContext): boolean {
    return this.checkBasicPreconditions(context);
  }

  async execute(context: WorkerContext): Promise<WorkerResult<string>> {
    return this.createSuccessResult('premium data', null);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function createMockContext(tier = 'free' as const): WorkerContext {
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
    tier,
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('BaseWorker', () => {
  let mockWorker: MockWorker;
  let premiumWorker: PremiumWorker;
  let context: WorkerContext;
  let config: OrchestratorConfig;

  beforeEach(() => {
    context = createMockContext();
    config = {
      geminiApiKey: 'test-api-key',
      model: 'gemini-3-flash-preview',
      temperature: 1.0,
      maxOutputTokens: 8192,
      maxRetries: 2,
      verbose: false,
    };
    mockWorker = new MockWorker(config);
    premiumWorker = new PremiumWorker(config);
  });

  describe('constructor', () => {
    it('should create worker without config', () => {
      const worker = new MockWorker();
      expect(worker.name).toBe('MockWorker');
      expect(worker.phase).toBe(1);
      expect(worker.minTier).toBe('free');
    });

    it('should create worker with config', () => {
      const worker = new MockWorker(config);
      expect(worker.name).toBe('MockWorker');
      // Client is protected, cannot test directly
    });
  });

  describe('abstract properties', () => {
    it('should have required name, phase, and minTier', () => {
      expect(mockWorker.name).toBe('MockWorker');
      expect(mockWorker.phase).toBe(1);
      expect(mockWorker.minTier).toBe('free');
    });
  });

  describe('isTierSufficient()', () => {
    it('should allow free tier for free worker', () => {
      // Use type casting to access protected method for testing
      const isSufficient = (mockWorker as any).isTierSufficient('free');
      expect(isSufficient).toBe(true);
    });

    it('should allow premium tier for free worker', () => {
      const isSufficient = (mockWorker as any).isTierSufficient('premium');
      expect(isSufficient).toBe(true);
    });

    it('should allow enterprise tier for free worker', () => {
      const isSufficient = (mockWorker as any).isTierSufficient('enterprise');
      expect(isSufficient).toBe(true);
    });

    it('should reject free tier for premium worker', () => {
      const isSufficient = (premiumWorker as any).isTierSufficient('free');
      expect(isSufficient).toBe(false);
    });

    it('should allow premium tier for premium worker', () => {
      const isSufficient = (premiumWorker as any).isTierSufficient('premium');
      expect(isSufficient).toBe(true);
    });

    it('should allow enterprise tier for premium worker', () => {
      const isSufficient = (premiumWorker as any).isTierSufficient('enterprise');
      expect(isSufficient).toBe(true);
    });
  });

  describe('checkBasicPreconditions()', () => {
    // NOTE: Tier check was removed from checkBasicPreconditions
    // All workers now run for all tiers - tier filtering happens at API/Gateway level
    it('should pass for valid context with free tier', () => {
      const result = (mockWorker as any).checkBasicPreconditions(context);
      expect(result).toBe(true);
    });

    it('should pass for premium worker with free tier (tier check removed)', () => {
      // Tier check removed - all workers always run
      // Premium agents show teasers for free users, full data after payment
      const result = (premiumWorker as any).checkBasicPreconditions(context);
      expect(result).toBe(true);
    });

    it('should fail for empty sessions', () => {
      const emptyContext: WorkerContext = {
        ...context,
        sessions: [],
      };
      const result = (mockWorker as any).checkBasicPreconditions(emptyContext);
      expect(result).toBe(false);
    });

    it('should pass for premium tier with premium worker', () => {
      const premiumContext = createMockContext('premium');
      const result = (premiumWorker as any).checkBasicPreconditions(premiumContext);
      expect(result).toBe(true);
    });
  });

  describe('log()', () => {
    it('should not log when verbose is false', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const worker = new MockWorker(config);
      (worker as any).log('test message');
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log when verbose is true', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const verboseConfig = { ...config, verbose: true };
      const worker = new MockWorker(verboseConfig);
      (worker as any).log('test message');
      expect(consoleSpy).toHaveBeenCalledWith('[MockWorker] test message');
      consoleSpy.mockRestore();
    });
  });

  // NOTE: createFailedResult was removed as part of NO FALLBACK policy
  // Workers now throw errors instead of returning fallback data

  describe('createSuccessResult()', () => {
    it('should create success result with usage', () => {
      const data = 'success data';
      const usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };
      const result = (mockWorker as any).createSuccessResult(data, usage);

      expect(result.data).toBe(data);
      expect(result.usage).toEqual(usage);
      expect(result.error).toBeUndefined();
    });

    it('should create success result with null usage', () => {
      const data = 'success data';
      const result = (mockWorker as any).createSuccessResult(data, null);

      expect(result.data).toBe(data);
      expect(result.usage).toBeNull();
      expect(result.error).toBeUndefined();
    });
  });

  describe('canRun()', () => {
    it('should return true for valid context', () => {
      expect(mockWorker.canRun(context)).toBe(true);
    });

    it('should return true for premium worker with free tier (tier check removed from checkBasicPreconditions)', () => {
      // NOTE: canRun uses checkBasicPreconditions which no longer checks tier
      // If your worker needs tier checking, implement it in canRun directly
      expect(premiumWorker.canRun(context)).toBe(true);
    });

    it('should return false for empty sessions', () => {
      const emptyContext: WorkerContext = {
        ...context,
        sessions: [],
      };
      expect(mockWorker.canRun(emptyContext)).toBe(false);
    });
  });

  describe('execute()', () => {
    it('should execute successfully', async () => {
      const result = await mockWorker.execute(context);

      expect(result.data).toBe('mock data');
      expect(result.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
      expect(result.error).toBeUndefined();
    });

    it('should throw error for failing worker (NO FALLBACK policy)', async () => {
      const failingWorker = new FailingWorker();
      await expect(failingWorker.execute(context)).rejects.toThrow('Worker execution failed');
    });
  });
});

// NOTE: runWorkerSafely and runWorkersInParallel tests removed
// These functions were removed as part of the NO FALLBACK policy.
// Workers now throw errors that propagate to the orchestrator.
// The orchestrator uses Promise.all() to fail fast on any worker error.
