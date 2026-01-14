/**
 * Memory Job Queue Tests
 *
 * Comprehensive test suite for the in-memory job queue implementation.
 *
 * @module tests/unit/memory-queue
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMemoryJobQueue } from '../../src/infrastructure/jobs/memory-queue.js';
import type {
  IJobQueuePort,
  JobHandler,
  JobContext,
} from '../../src/application/ports/job-queue.js';
import type {
  Job,
  JobResult,
  CreateJobInput,
  YouTubeTranscriptPayload,
  KnowledgeLearnPayload,
} from '../../src/domain/models/index.js';

describe('MemoryJobQueue', () => {
  let queue: IJobQueuePort;

  beforeEach(() => {
    queue = createMemoryJobQueue({
      concurrency: 2,
      defaultRetries: 3,
      pollInterval: 50,
      jobTimeout: 1000,
      retryDelay: 100, // Fixed delay for faster tests
    });
  });

  afterEach(async () => {
    // Remove all event listeners to prevent process hanging
    if ('removeAllListeners' in queue) {
      (queue as any).removeAllListeners();
    }

    if (queue.isRunning()) {
      await queue.stop();
    }
    await queue.clear();
  });

  // ==========================================================================
  // Basic Job Operations
  // ==========================================================================

  describe('enqueue', () => {
    it('should enqueue a job successfully', async () => {
      const input: CreateJobInput = {
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
        priority: 'normal',
      };

      const result = await queue.enqueue(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBeDefined();
        expect(result.data.type).toBe('youtube_transcript');
        expect(result.data.status).toBe('pending');
        expect(result.data.priority).toBe('normal');
      }
    });

    it('should enqueue multiple jobs in batch', async () => {
      const inputs: CreateJobInput[] = [
        {
          type: 'youtube_transcript',
          payload: {
            type: 'youtube_transcript',
            url: 'https://youtube.com/watch?v=test1',
            playlistMode: false,
          },
        },
        {
          type: 'knowledge_learn',
          payload: {
            type: 'knowledge_learn',
            query: 'test query',
          },
        },
      ];

      const result = await queue.enqueueBatch(inputs);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        expect(result.data[0].type).toBe('youtube_transcript');
        expect(result.data[1].type).toBe('knowledge_learn');
      }
    });

    it('should emit job:created event', async () => {
      const handler = vi.fn();
      queue.on('job:created', handler);

      const input: CreateJobInput = {
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      };

      await queue.enqueue(input);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'youtube_transcript',
          status: 'pending',
        })
      );

      queue.off('job:created', handler);
    });
  });

  describe('getJob', () => {
    it('should retrieve an existing job', async () => {
      const enqueueResult = await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      });

      if (!enqueueResult.success) throw new Error('Enqueue failed');

      const result = await queue.getJob(enqueueResult.data.id);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toBeNull();
        expect(result.data?.id).toBe(enqueueResult.data.id);
      }
    });

    it('should return null for non-existent job', async () => {
      const result = await queue.getJob('non-existent-id');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe('getStatus', () => {
    it('should return job status with progress', async () => {
      const enqueueResult = await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      });

      if (!enqueueResult.success) throw new Error('Enqueue failed');

      const result = await queue.getStatus(enqueueResult.data.id);

      expect(result.success).toBe(true);
      if (result.success && result.data) {
        expect(result.data.id).toBe(enqueueResult.data.id);
        expect(result.data.status).toBe('pending');
      }
    });
  });

  // ==========================================================================
  // Job Processing
  // ==========================================================================

  describe('job processing', () => {
    it('should process a job successfully', async () => {
      const handler: JobHandler<YouTubeTranscriptPayload> = vi.fn(async () => ({
        success: true,
        data: { videoId: 'test' },
      }));

      queue.registerHandler('youtube_transcript', handler);

      // Set up completion promise BEFORE enqueuing
      const completionPromise = new Promise((resolve) => {
        queue.on('job:completed', resolve);
      });

      const enqueueResult = await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      });

      if (!enqueueResult.success) throw new Error('Enqueue failed');

      await queue.start();

      // Wait for job to complete
      await completionPromise;

      expect(handler).toHaveBeenCalled();

      const jobResult = await queue.getJob(enqueueResult.data.id);
      expect(jobResult.success).toBe(true);
      if (jobResult.success && jobResult.data) {
        expect(jobResult.data.status).toBe('completed');
        expect(jobResult.data.result).toEqual({
          success: true,
          data: { videoId: 'test' },
        });
      }
    });

    it('should handle job failure and retry', async () => {
      let attempts = 0;
      const handler: JobHandler<YouTubeTranscriptPayload> = vi.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return { success: true, data: { videoId: 'test' } };
      });

      queue.registerHandler('youtube_transcript', handler);

      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      });

      await queue.start();

      // Wait for job to complete after retries
      await new Promise((resolve) => {
        queue.on('job:completed', resolve);
      });

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const handler: JobHandler<YouTubeTranscriptPayload> = vi.fn(async () => {
        throw new Error('Permanent failure');
      });

      queue.registerHandler('youtube_transcript', handler);

      // Set up failure promise BEFORE enqueuing
      const failurePromise = new Promise((resolve) => {
        queue.on('job:failed', resolve);
      });

      const enqueueResult = await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      });

      if (!enqueueResult.success) throw new Error('Enqueue failed');

      await queue.start();

      // Wait for job to fail
      await failurePromise;

      expect(handler).toHaveBeenCalledTimes(4); // 1 initial + 3 retries

      const jobResult = await queue.getJob(enqueueResult.data.id);
      expect(jobResult.success).toBe(true);
      if (jobResult.success && jobResult.data) {
        expect(jobResult.data.status).toBe('failed');
        expect(jobResult.data.error).toBeDefined();
      }
    });

    it('should update progress during processing', async () => {
      const progressUpdates: number[] = [];

      const handler: JobHandler<YouTubeTranscriptPayload> = async (_, ctx) => {
        await ctx.updateProgress(0, 100, 'Starting');
        await ctx.updateProgress(50, 100, 'Halfway');
        await ctx.updateProgress(100, 100, 'Complete');
        return { success: true, data: { videoId: 'test' } };
      };

      queue.registerHandler('youtube_transcript', handler);

      queue.on('job:progress', (payload) => {
        if (payload.progress) {
          progressUpdates.push(payload.progress.current);
        }
      });

      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      });

      await queue.start();

      await new Promise((resolve) => {
        queue.on('job:completed', resolve);
      });

      expect(progressUpdates).toEqual([0, 50, 100]);
    });

    it('should respect concurrency limits', async () => {
      let activeJobs = 0;
      let maxActiveJobs = 0;

      const handler: JobHandler<YouTubeTranscriptPayload> = async () => {
        activeJobs++;
        maxActiveJobs = Math.max(maxActiveJobs, activeJobs);
        await new Promise((resolve) => setTimeout(resolve, 100));
        activeJobs--;
        return { success: true, data: { videoId: 'test' } };
      };

      queue.registerHandler('youtube_transcript', handler);

      // Enqueue 5 jobs
      for (let i = 0; i < 5; i++) {
        await queue.enqueue({
          type: 'youtube_transcript',
          payload: {
            type: 'youtube_transcript',
            url: `https://youtube.com/watch?v=test${i}`,
            playlistMode: false,
          },
        });
      }

      await queue.start();

      // Wait for all jobs to complete
      let completedCount = 0;
      await new Promise<void>((resolve) => {
        queue.on('job:completed', () => {
          completedCount++;
          if (completedCount === 5) resolve();
        });
      });

      expect(maxActiveJobs).toBeLessThanOrEqual(2); // Concurrency is 2
    });

    it('should process jobs by priority', async () => {
      const processedJobs: string[] = [];

      const handler: JobHandler<YouTubeTranscriptPayload> = async (payload) => {
        processedJobs.push(payload.url);
        return { success: true, data: { videoId: 'test' } };
      };

      queue.registerHandler('youtube_transcript', handler);

      // Set up completion tracking BEFORE enqueuing
      let completedCount = 0;
      const allCompletedPromise = new Promise<void>((resolve) => {
        queue.on('job:completed', () => {
          completedCount++;
          if (completedCount === 3) resolve();
        });
      });

      // Enqueue jobs with different priorities (before starting)
      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'low-priority',
          playlistMode: false,
        },
        priority: 'low',
      });

      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'high-priority',
          playlistMode: false,
        },
        priority: 'high',
      });

      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'urgent-priority',
          playlistMode: false,
        },
        priority: 'urgent',
      });

      await queue.start();

      // Wait for all jobs to complete
      await allCompletedPromise;

      // Urgent should be processed first, then high, then low
      expect(processedJobs[0]).toBe('urgent-priority');
      expect(processedJobs[1]).toBe('high-priority');
      expect(processedJobs[2]).toBe('low-priority');
    });
  });

  // ==========================================================================
  // Job Control
  // ==========================================================================

  describe('cancel', () => {
    it('should cancel a pending job', async () => {
      const enqueueResult = await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      });

      if (!enqueueResult.success) throw new Error('Enqueue failed');

      const cancelResult = await queue.cancel(enqueueResult.data.id);
      expect(cancelResult.success).toBe(true);

      const jobResult = await queue.getJob(enqueueResult.data.id);
      expect(jobResult.success).toBe(true);
      if (jobResult.success && jobResult.data) {
        expect(jobResult.data.status).toBe('cancelled');
      }
    });

    it('should cancel a processing job', async () => {
      let cancelled = false;

      const handler: JobHandler<YouTubeTranscriptPayload> = async (_, ctx) => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (ctx.isCancelled()) {
          cancelled = true;
        }
        return { success: true, data: { videoId: 'test' } };
      };

      queue.registerHandler('youtube_transcript', handler);

      // Set up started promise BEFORE enqueuing
      const startedPromise = new Promise((resolve) => {
        queue.on('job:started', resolve);
      });

      // Set up cancelled promise BEFORE enqueuing
      const cancelledPromise = new Promise((resolve) => {
        queue.on('job:cancelled', resolve);
      });

      const enqueueResult = await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      });

      if (!enqueueResult.success) throw new Error('Enqueue failed');

      await queue.start();

      // Wait for job to start
      await startedPromise;

      // Cancel it
      await queue.cancel(enqueueResult.data.id);

      // Wait for cancellation to complete
      await cancelledPromise;

      expect(cancelled).toBe(true);
    });
  });

  describe('retry', () => {
    it('should retry a failed job', async () => {
      const handler: JobHandler<YouTubeTranscriptPayload> = vi.fn(async () => {
        throw new Error('Failure');
      });

      queue.registerHandler('youtube_transcript', handler);

      // Set up failure promise BEFORE enqueuing
      const failurePromise = new Promise((resolve) => {
        queue.on('job:failed', resolve);
      });

      const enqueueResult = await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      });

      if (!enqueueResult.success) throw new Error('Enqueue failed');

      await queue.start();

      // Wait for job to fail (after all retries)
      await failurePromise;

      // The job should now be in failed state
      const jobResult = await queue.getJob(enqueueResult.data.id);
      expect(jobResult.success).toBe(true);
      if (jobResult.success && jobResult.data) {
        expect(jobResult.data.status).toBe('failed');
      }
    });
  });

  describe('updatePriority', () => {
    it('should update priority of pending job', async () => {
      const enqueueResult = await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
        priority: 'normal',
      });

      if (!enqueueResult.success) throw new Error('Enqueue failed');

      const updateResult = await queue.updatePriority(enqueueResult.data.id, 'high');
      expect(updateResult.success).toBe(true);

      const jobResult = await queue.getJob(enqueueResult.data.id);
      expect(jobResult.success).toBe(true);
      if (jobResult.success && jobResult.data) {
        expect(jobResult.data.priority).toBe('high');
      }
    });
  });

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  describe('queries', () => {
    it('should list jobs by status', async () => {
      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test1',
          playlistMode: false,
        },
      });

      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test2',
          playlistMode: false,
        },
      });

      const result = await queue.listByStatus('pending');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
      }
    });

    it('should list jobs by type', async () => {
      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      });

      await queue.enqueue({
        type: 'knowledge_learn',
        payload: {
          type: 'knowledge_learn',
          query: 'test',
        },
      });

      const result = await queue.listByType('youtube_transcript');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].type).toBe('youtube_transcript');
      }
    });

    it('should list jobs by user', async () => {
      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
        userId: 'user-1',
      });

      await queue.enqueue({
        type: 'knowledge_learn',
        payload: {
          type: 'knowledge_learn',
          query: 'test',
        },
        userId: 'user-2',
      });

      const result = await queue.listByUser('user-1');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].userId).toBe('user-1');
      }
    });
  });

  // ==========================================================================
  // Statistics
  // ==========================================================================

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const handler: JobHandler<YouTubeTranscriptPayload> = async () => ({
        success: true,
        data: { videoId: 'test' },
      });

      queue.registerHandler('youtube_transcript', handler);

      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test1',
          playlistMode: false,
        },
      });

      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test2',
          playlistMode: false,
        },
      });

      const stats = await queue.getStats();

      expect(stats.pending).toBe(2);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(0);
    });
  });

  // ==========================================================================
  // Queue Control
  // ==========================================================================

  describe('queue control', () => {
    it('should start and stop the queue', async () => {
      expect(queue.isRunning()).toBe(false);

      await queue.start();
      expect(queue.isRunning()).toBe(true);

      await queue.stop();
      expect(queue.isRunning()).toBe(false);
    });

    it('should pause and resume the queue', async () => {
      const handler: JobHandler<YouTubeTranscriptPayload> = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { success: true, data: { videoId: 'test' } };
      };

      queue.registerHandler('youtube_transcript', handler);

      // Set up completion promise BEFORE enqueuing
      const completionPromise = new Promise((resolve) => {
        queue.on('job:completed', resolve);
      });

      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      });

      await queue.start();
      await queue.pause();

      // Job should not process while paused
      await new Promise((resolve) => setTimeout(resolve, 200));

      const stats = await queue.getStats();
      expect(stats.processing).toBe(0);

      await queue.resume();

      // Job should process after resume
      await completionPromise;
    });

    it('should emit queue:empty event', async () => {
      const handler: JobHandler<YouTubeTranscriptPayload> = async () => ({
        success: true,
        data: { videoId: 'test' },
      });

      queue.registerHandler('youtube_transcript', handler);

      const emptyHandler = vi.fn();
      queue.on('queue:empty', emptyHandler);

      await queue.enqueue({
        type: 'youtube_transcript',
        payload: {
          type: 'youtube_transcript',
          url: 'https://youtube.com/watch?v=test',
          playlistMode: false,
        },
      });

      await queue.start();

      // Wait for job to complete and queue to be empty
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(emptyHandler).toHaveBeenCalled();

      queue.off('queue:empty', emptyHandler);
    });
  });
});
