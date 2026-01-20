/**
 * BaseWorker Tests
 *
 * Tests for the abstract BaseWorker class and utility functions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BaseWorker,
  runWorkerSafely,
  runWorkersInParallel,
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
    it('should pass for valid context with free tier', () => {
      const result = (mockWorker as any).checkBasicPreconditions(context);
      expect(result).toBe(true);
    });

    it('should fail for insufficient tier', () => {
      const result = (premiumWorker as any).checkBasicPreconditions(context);
      expect(result).toBe(false);
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

  describe('createFailedResult()', () => {
    it('should create failed result with error', () => {
      const error = new Error('Test error');
      const fallback = 'fallback data';
      const result = (mockWorker as any).createFailedResult(error, fallback);

      expect(result.data).toBe(fallback);
      expect(result.usage).toBeNull();
      expect(result.error).toBe(error);
    });
  });

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

    it('should return false for premium worker with free tier', () => {
      expect(premiumWorker.canRun(context)).toBe(false);
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
  });
});

describe('runWorkerSafely', () => {
  let context: WorkerContext;

  beforeEach(() => {
    context = createMockContext();
  });

  it('should return success result for successful worker', async () => {
    const worker = new MockWorker();
    const fallbackData = 'fallback';
    const result = await runWorkerSafely(worker, context, fallbackData);

    expect(result.data).toBe('mock data');
    expect(result.usage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    });
    expect(result.error).toBeUndefined();
  });

  it('should return fallback result when canRun returns false', async () => {
    const worker = new PremiumWorker();
    const fallbackData = 'fallback';
    const result = await runWorkerSafely(worker, context, fallbackData);

    expect(result.data).toBe(fallbackData);
    expect(result.usage).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('cannot run with current context');
  });

  it('should catch and return fallback for failing worker', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const worker = new FailingWorker();
    const fallbackData = 'fallback';
    const result = await runWorkerSafely(worker, context, fallbackData);

    expect(result.data).toBe(fallbackData);
    expect(result.usage).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('Worker execution failed');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should handle non-Error throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    class StringThrowWorker extends BaseWorker<string> {
      readonly name = 'StringThrowWorker';
      readonly phase = 1 as const;
      readonly minTier = 'free' as const;

      canRun(_context: WorkerContext): boolean {
        return true;
      }

      async execute(_context: WorkerContext): Promise<WorkerResult<string>> {
        throw 'string error';
      }
    }

    const worker = new StringThrowWorker();
    const fallbackData = 'fallback';
    const result = await runWorkerSafely(worker, context, fallbackData);

    expect(result.data).toBe(fallbackData);
    expect(result.usage).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error?.message).toBe('string error');
    consoleSpy.mockRestore();
  });
});

describe('runWorkersInParallel', () => {
  let context: WorkerContext;

  beforeEach(() => {
    context = createMockContext();
  });

  it('should run multiple workers in parallel', async () => {
    const worker1 = new MockWorker();
    const worker2 = new PremiumWorker();
    const workers = [worker1, worker2];

    const premiumContext = createMockContext('premium');
    const results = await runWorkersInParallel(workers, premiumContext, (name) => `fallback-${name}`);

    expect(results.size).toBe(2);
    expect(results.get('MockWorker')).toBeDefined();
    expect(results.get('PremiumWorker')).toBeDefined();
    expect(results.get('MockWorker')?.data).toBe('mock data');
    expect(results.get('PremiumWorker')?.data).toBe('premium data');
  });

  it('should handle mixed success and failure', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const successWorker = new MockWorker();
    const failWorker = new FailingWorker();
    const workers = [successWorker, failWorker];

    const results = await runWorkersInParallel(workers, context, (name) => `fallback-${name}`);

    expect(results.size).toBe(2);

    const successResult = results.get('MockWorker');
    expect(successResult?.data).toBe('mock data');
    expect(successResult?.error).toBeUndefined();

    const failResult = results.get('FailingWorker');
    expect(failResult?.data).toBe('fallback-FailingWorker');
    expect(failResult?.error).toBeDefined();

    consoleSpy.mockRestore();
  });

  it('should use fallback factory for each worker', async () => {
    const worker1 = new MockWorker();
    const worker2 = new FailingWorker();
    const workers = [worker1, worker2];
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const results = await runWorkersInParallel(
      workers,
      context,
      (name) => `custom-fallback-${name}`
    );

    expect(results.size).toBe(2);
    const failResult = results.get('FailingWorker');
    expect(failResult?.data).toBe('custom-fallback-FailingWorker');

    consoleSpy.mockRestore();
  });

  it('should handle empty worker array', async () => {
    const results = await runWorkersInParallel([], context, (name) => `fallback-${name}`);

    expect(results.size).toBe(0);
  });

  it('should complete all workers even if some fail', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    class SlowWorker extends BaseWorker<string> {
      readonly name = 'SlowWorker';
      readonly phase = 1 as const;
      readonly minTier = 'free' as const;

      canRun(_context: WorkerContext): boolean {
        return true;
      }

      async execute(_context: WorkerContext): Promise<WorkerResult<string>> {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return this.createSuccessResult('slow data', null);
      }
    }

    const workers = [new MockWorker(), new FailingWorker(), new SlowWorker()];

    const results = await runWorkersInParallel(workers, context, (name) => `fallback-${name}`);

    expect(results.size).toBe(3);
    expect(results.get('MockWorker')?.data).toBe('mock data');
    expect(results.get('FailingWorker')?.data).toBe('fallback-FailingWorker');
    expect(results.get('SlowWorker')?.data).toBe('slow data');

    consoleSpy.mockRestore();
  });
});
