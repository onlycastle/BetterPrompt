import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Create mock job queue instance that will be reused
const mockJobQueue = {
  enqueue: vi.fn(),
  getStatus: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  isRunning: vi.fn(),
};

// Mock dependencies before importing routes
vi.mock('../../../../src/search-agent/skills/transcript/index.js', () => ({
  createTranscriptSkill: vi.fn(),
  isYouTubeUrl: vi.fn(),
}));

vi.mock('../../../../src/search-agent/db/index.js', () => ({
  knowledgeDb: {
    save: vi.fn(),
  },
}));

vi.mock('../../../../src/search-agent/influencers/index.js', () => ({
  getInfluencerDetector: vi.fn(),
}));

vi.mock('../../../../src/infrastructure/jobs/index.js', () => ({
  createMemoryJobQueue: vi.fn(() => mockJobQueue),
}));

import { learnRoutes } from '../../../../src/api/routes/learn.js';
import {
  createTranscriptSkill,
  isYouTubeUrl,
} from '../../../../src/search-agent/skills/transcript/index.js';
import { knowledgeDb } from '../../../../src/search-agent/db/index.js';
import { getInfluencerDetector } from '../../../../src/search-agent/influencers/index.js';
import { createMemoryJobQueue } from '../../../../src/infrastructure/jobs/index.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/learn', learnRoutes);
  return app;
}

// Mock factories
function createMockTranscriptSkill() {
  return {
    execute: vi.fn(),
  };
}

function createMockInfluencerDetector() {
  return {
    detectFromUrl: vi.fn(),
    detectFromAuthor: vi.fn(),
  };
}


function createMockVideoResult() {
  return {
    transcript: {
      video: {
        id: 'test-video-id',
        title: 'Test Video Title',
        url: 'https://youtube.com/watch?v=test',
        channelName: 'Test Channel',
        publishedAt: '2024-01-01T00:00:00Z',
      },
      text: 'This is a test transcript...',
      duration: 300,
      fetchedAt: '2024-01-01T00:00:00Z',
    },
    analysis: {
      summary: 'This is a test summary',
      keyInsights: ['Insight 1', 'Insight 2', 'Insight 3'],
      topics: ['AI', 'coding', 'testing'],
      codeExamples: ['const test = "example";'],
      relevanceToAICoding: 0.85,
      credibilityScore: 0.9,
      actionableRecommendations: ['Recommendation 1'],
    },
  };
}

describe('Learn API Routes', () => {
  let app: express.Express;
  let localMockTranscriptSkill: ReturnType<typeof createMockTranscriptSkill>;
  let localMockInfluencerDetector: ReturnType<typeof createMockInfluencerDetector>;

  beforeEach(() => {
    app = createTestApp();
    localMockTranscriptSkill = createMockTranscriptSkill();
    localMockInfluencerDetector = createMockInfluencerDetector();

    // Setup default mocks
    vi.mocked(createTranscriptSkill).mockReturnValue(localMockTranscriptSkill as any);
    vi.mocked(getInfluencerDetector).mockReturnValue(localMockInfluencerDetector as any);

    // Default influencer detector responses
    localMockInfluencerDetector.detectFromUrl.mockResolvedValue({ found: false });
    localMockInfluencerDetector.detectFromAuthor.mockResolvedValue({ found: false });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/learn/youtube', () => {
    it('should return 400 without URL', async () => {
      const response = await request(app).post('/api/learn/youtube').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('URL is required');
    });

    it('should return 400 for non-YouTube URL', async () => {
      vi.mocked(isYouTubeUrl).mockReturnValue(false);

      const response = await request(app)
        .post('/api/learn/youtube')
        .send({ url: 'https://example.com/video' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid YouTube URL');
      expect(isYouTubeUrl).toHaveBeenCalledWith('https://example.com/video');
    });

    it('should process valid YouTube URL successfully', async () => {
      vi.mocked(isYouTubeUrl).mockReturnValue(true);

      const mockVideoResult = createMockVideoResult();
      localMockTranscriptSkill.execute.mockResolvedValue({
        success: true,
        data: {
          results: [mockVideoResult],
          errors: [],
          stats: {
            videosProcessed: 1,
            videosFailed: 0,
            totalDurationSeconds: 300,
          },
        },
      });

      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/learn/youtube')
        .send({ url: 'https://youtube.com/watch?v=test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.savedCount).toBe(1);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].title).toBe('Test Video Title');
      expect(knowledgeDb.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Video Title',
          category: 'other',
          contentType: 'insight',
          status: 'reviewed',
        })
      );
    });

    it('should handle YouTube skill execution failure', async () => {
      vi.mocked(isYouTubeUrl).mockReturnValue(true);

      localMockTranscriptSkill.execute.mockResolvedValue({
        success: false,
        error: 'Failed to fetch transcript',
      });

      const response = await request(app)
        .post('/api/learn/youtube')
        .send({ url: 'https://youtube.com/watch?v=test' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch transcript');
    });

    it('should process playlist with multiple videos', async () => {
      vi.mocked(isYouTubeUrl).mockReturnValue(true);

      const mockVideoResult1 = createMockVideoResult();
      const mockVideoResult2 = {
        ...createMockVideoResult(),
        transcript: {
          ...createMockVideoResult().transcript,
          video: {
            ...createMockVideoResult().transcript.video,
            id: 'test-video-id-2',
            title: 'Test Video Title 2',
            url: 'https://youtube.com/watch?v=test2',
          },
        },
      };

      localMockTranscriptSkill.execute.mockResolvedValue({
        success: true,
        data: {
          results: [mockVideoResult1, mockVideoResult2],
          errors: [],
          stats: {
            videosProcessed: 2,
            videosFailed: 0,
            totalDurationSeconds: 600,
          },
        },
      });

      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const response = await request(app).post('/api/learn/youtube').send({
        url: 'https://youtube.com/playlist?list=test',
        processPlaylist: true,
        maxVideos: 10,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.savedCount).toBe(2);
      expect(response.body.results).toHaveLength(2);
      expect(knowledgeDb.save).toHaveBeenCalledTimes(2);
    });

    it('should detect influencer from URL', async () => {
      vi.mocked(isYouTubeUrl).mockReturnValue(true);

      const mockVideoResult = createMockVideoResult();
      localMockTranscriptSkill.execute.mockResolvedValue({
        success: true,
        data: {
          results: [mockVideoResult],
          errors: [],
          stats: {
            videosProcessed: 1,
            videosFailed: 0,
            totalDurationSeconds: 300,
          },
        },
      });

      localMockInfluencerDetector.detectFromUrl.mockResolvedValue({
        found: true,
        influencer: {
          id: 'test-influencer',
          credibilityTier: 'tier1',
        },
      });

      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/learn/youtube')
        .send({ url: 'https://youtube.com/watch?v=test' });

      expect(response.status).toBe(200);
      expect(knowledgeDb.save).toHaveBeenCalledWith(
        expect.objectContaining({
          source: expect.objectContaining({
            influencerId: 'test-influencer',
            credibilityTier: 'tier1',
          }),
        })
      );
    });

    it('should fallback to channel name for influencer detection', async () => {
      vi.mocked(isYouTubeUrl).mockReturnValue(true);

      const mockVideoResult = createMockVideoResult();
      localMockTranscriptSkill.execute.mockResolvedValue({
        success: true,
        data: {
          results: [mockVideoResult],
          errors: [],
          stats: {
            videosProcessed: 1,
            videosFailed: 0,
            totalDurationSeconds: 300,
          },
        },
      });

      localMockInfluencerDetector.detectFromUrl.mockResolvedValue({ found: false });
      localMockInfluencerDetector.detectFromAuthor.mockResolvedValue({
        found: true,
        influencer: {
          id: 'channel-influencer',
          credibilityTier: 'tier2',
        },
      });

      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/learn/youtube')
        .send({ url: 'https://youtube.com/watch?v=test' });

      expect(response.status).toBe(200);
      expect(localMockInfluencerDetector.detectFromAuthor).toHaveBeenCalledWith('Test Channel');
      expect(knowledgeDb.save).toHaveBeenCalledWith(
        expect.objectContaining({
          source: expect.objectContaining({
            influencerId: 'channel-influencer',
            credibilityTier: 'tier2',
          }),
        })
      );
    });

    it('should handle partial failures in video processing', async () => {
      vi.mocked(isYouTubeUrl).mockReturnValue(true);

      const mockVideoResult = createMockVideoResult();
      localMockTranscriptSkill.execute.mockResolvedValue({
        success: true,
        data: {
          results: [mockVideoResult],
          errors: [{ url: 'https://youtube.com/watch?v=failed', error: 'Video unavailable' }],
          stats: {
            videosProcessed: 1,
            videosFailed: 1,
            totalDurationSeconds: 300,
          },
        },
      });

      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/learn/youtube')
        .send({ url: 'https://youtube.com/playlist?list=test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0].error).toBe('Video unavailable');
    });

    it('should handle database save errors gracefully', async () => {
      vi.mocked(isYouTubeUrl).mockReturnValue(true);

      const mockVideoResult = createMockVideoResult();
      localMockTranscriptSkill.execute.mockResolvedValue({
        success: true,
        data: {
          results: [mockVideoResult],
          errors: [],
          stats: {
            videosProcessed: 1,
            videosFailed: 0,
            totalDurationSeconds: 300,
          },
        },
      });

      vi.mocked(knowledgeDb.save).mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/learn/youtube')
        .send({ url: 'https://youtube.com/watch?v=test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.savedCount).toBe(0);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0].error).toBe('Database error');
    });

    it('should return 500 on unexpected error', async () => {
      vi.mocked(isYouTubeUrl).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app)
        .post('/api/learn/youtube')
        .send({ url: 'https://youtube.com/watch?v=test' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unexpected error');
    });

    it('should map topics to correct categories', async () => {
      vi.mocked(isYouTubeUrl).mockReturnValue(true);

      const mockVideoResult = createMockVideoResult();
      mockVideoResult.analysis.topics = ['prompt', 'engineering', 'best-practices'];

      localMockTranscriptSkill.execute.mockResolvedValue({
        success: true,
        data: {
          results: [mockVideoResult],
          errors: [],
          stats: {
            videosProcessed: 1,
            videosFailed: 0,
            totalDurationSeconds: 300,
          },
        },
      });

      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/learn/youtube')
        .send({ url: 'https://youtube.com/watch?v=test' });

      expect(response.status).toBe(200);
      expect(knowledgeDb.save).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'prompt-engineering',
        })
      );
    });
  });

  describe('POST /api/learn/url', () => {
    it('should return 400 without URL', async () => {
      const response = await request(app).post('/api/learn/url').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('URL is required');
    });

    it('should queue job when no summary provided', async () => {
      mockJobQueue.enqueue.mockResolvedValue({
        success: true,
        data: {
          id: 'test-job-id',
          status: 'pending',
        },
      });

      const response = await request(app)
        .post('/api/learn/url')
        .send({ url: 'https://example.com/article' });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.jobId).toBe('test-job-id');
      expect(response.body.status).toBe('queued');
      expect(mockJobQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'knowledge_learn',
          payload: expect.objectContaining({
            type: 'knowledge_learn',
            query: 'https://example.com/article',
            topics: ['ai-coding'],
            maxItems: 1,
          }),
          priority: 'normal',
        })
      );
    });

    it('should queue job when summary is empty string', async () => {
      mockJobQueue.enqueue.mockResolvedValue({
        success: true,
        data: {
          id: 'test-job-id',
          status: 'pending',
        },
      });

      const response = await request(app)
        .post('/api/learn/url')
        .send({ url: 'https://example.com/article', summary: '   ' });

      expect(response.status).toBe(202);
      expect(response.body.jobId).toBe('test-job-id');
      expect(mockJobQueue.enqueue).toHaveBeenCalled();
    });

    it('should use provided topics when queueing job', async () => {
      mockJobQueue.enqueue.mockResolvedValue({
        success: true,
        data: {
          id: 'test-job-id',
          status: 'pending',
        },
      });

      const response = await request(app).post('/api/learn/url').send({
        url: 'https://example.com/article',
        topics: ['prompt-engineering', 'best-practices'],
      });

      expect(response.status).toBe(202);
      expect(mockJobQueue.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            topics: ['prompt-engineering', 'best-practices'],
          }),
        })
      );
    });

    it('should return 500 when job queue fails', async () => {
      mockJobQueue.enqueue.mockResolvedValue({
        success: false,
        error: 'Queue is full',
      });

      const response = await request(app)
        .post('/api/learn/url')
        .send({ url: 'https://example.com/article' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to queue learning job');
    });

    it('should create item immediately when summary provided', async () => {
      localMockInfluencerDetector.detectFromUrl.mockResolvedValue({ found: false });
      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const response = await request(app).post('/api/learn/url').send({
        url: 'https://example.com/article',
        title: 'Test Article',
        summary: 'This is a test summary',
        topics: ['AI', 'coding'],
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.item).toBeDefined();
      expect(response.body.item.title).toBe('Test Article');
      expect(response.body.item.summary).toBe('This is a test summary');
      expect(response.body.item.tags).toEqual(['AI', 'coding']);
      expect(knowledgeDb.save).toHaveBeenCalled();
    });

    it('should detect platform from URL', async () => {
      localMockInfluencerDetector.detectFromUrl.mockResolvedValue({ found: false });
      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const testCases = [
        { url: 'https://twitter.com/user/status/123', expectedPlatform: 'twitter' },
        { url: 'https://x.com/user/status/123', expectedPlatform: 'twitter' },
        { url: 'https://reddit.com/r/test/comments/123', expectedPlatform: 'reddit' },
        { url: 'https://linkedin.com/posts/123', expectedPlatform: 'linkedin' },
        { url: 'https://youtube.com/watch?v=123', expectedPlatform: 'youtube' },
        { url: 'https://example.com/article', expectedPlatform: 'web' },
      ];

      for (const { url, expectedPlatform } of testCases) {
        vi.clearAllMocks();

        await request(app).post('/api/learn/url').send({
          url,
          summary: 'Test summary',
        });

        expect(knowledgeDb.save).toHaveBeenCalledWith(
          expect.objectContaining({
            source: expect.objectContaining({
              platform: expectedPlatform,
            }),
          })
        );
      }
    });

    it('should use default title when not provided', async () => {
      localMockInfluencerDetector.detectFromUrl.mockResolvedValue({ found: false });
      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const response = await request(app).post('/api/learn/url').send({
        url: 'https://twitter.com/user/status/123',
        summary: 'Test summary',
      });

      expect(response.status).toBe(200);
      expect(response.body.item.title).toBe('Content from twitter');
    });

    it('should use default topics when not provided', async () => {
      localMockInfluencerDetector.detectFromUrl.mockResolvedValue({ found: false });
      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const response = await request(app).post('/api/learn/url').send({
        url: 'https://example.com/article',
        summary: 'Test summary',
      });

      expect(response.status).toBe(200);
      expect(response.body.item.tags).toEqual(['ai-coding']);
    });

    it('should detect influencer and include in knowledge item', async () => {
      localMockInfluencerDetector.detectFromUrl.mockResolvedValue({
        found: true,
        influencer: {
          id: 'test-influencer',
          credibilityTier: 'tier1',
        },
      });
      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const response = await request(app).post('/api/learn/url').send({
        url: 'https://example.com/article',
        summary: 'Test summary',
      });

      expect(response.status).toBe(200);
      expect(response.body.item.source.influencerId).toBe('test-influencer');
      expect(response.body.item.source.credibilityTier).toBe('tier1');
    });

    it('should truncate long title to 200 characters', async () => {
      localMockInfluencerDetector.detectFromUrl.mockResolvedValue({ found: false });
      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const longTitle = 'A'.repeat(300);

      const response = await request(app).post('/api/learn/url').send({
        url: 'https://example.com/article',
        title: longTitle,
        summary: 'Test summary',
      });

      expect(response.status).toBe(200);
      expect(response.body.item.title).toHaveLength(200);
    });

    it('should truncate long summary to 1000 characters', async () => {
      localMockInfluencerDetector.detectFromUrl.mockResolvedValue({ found: false });
      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const longSummary = 'A'.repeat(2000);

      const response = await request(app).post('/api/learn/url').send({
        url: 'https://example.com/article',
        summary: longSummary,
      });

      expect(response.status).toBe(200);
      expect(response.body.item.summary).toHaveLength(1000);
    });

    it('should limit tags to 10', async () => {
      localMockInfluencerDetector.detectFromUrl.mockResolvedValue({ found: false });
      vi.mocked(knowledgeDb.save).mockResolvedValue(undefined);

      const manyTopics = Array.from({ length: 15 }, (_, i) => `topic${i}`);

      const response = await request(app).post('/api/learn/url').send({
        url: 'https://example.com/article',
        summary: 'Test summary',
        topics: manyTopics,
      });

      expect(response.status).toBe(200);
      expect(response.body.item.tags).toHaveLength(10);
    });

    it('should return 500 on database error', async () => {
      localMockInfluencerDetector.detectFromUrl.mockResolvedValue({ found: false });
      vi.mocked(knowledgeDb.save).mockRejectedValue(new Error('Database error'));

      const response = await request(app).post('/api/learn/url').send({
        url: 'https://example.com/article',
        summary: 'Test summary',
      });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });

    it('should return 500 on unexpected error', async () => {
      localMockInfluencerDetector.detectFromUrl.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app).post('/api/learn/url').send({
        url: 'https://example.com/article',
        summary: 'Test summary',
      });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unexpected error');
    });
  });

  describe('GET /api/learn/status/:id', () => {
    it('should return job status', async () => {
      mockJobQueue.getStatus.mockResolvedValue({
        success: true,
        data: {
          id: 'test-job-id',
          status: 'processing',
          progress: {
            current: 50,
            total: 100,
            message: 'Processing content...',
          },
        },
      });

      const response = await request(app).get('/api/learn/status/test-job-id');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test-job-id');
      expect(response.body.status).toBe('processing');
      expect(response.body.progress).toBeDefined();
      expect(mockJobQueue.getStatus).toHaveBeenCalledWith('test-job-id');
    });

    it('should return 404 for non-existent job', async () => {
      mockJobQueue.getStatus.mockResolvedValue({
        success: true,
        data: null,
      });

      const response = await request(app).get('/api/learn/status/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Job not found');
    });

    it('should return 500 when getStatus fails', async () => {
      mockJobQueue.getStatus.mockResolvedValue({
        success: false,
        error: 'Queue error',
      });

      const response = await request(app).get('/api/learn/status/test-job-id');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get job status');
    });

    it('should return 500 on unexpected error', async () => {
      mockJobQueue.getStatus.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const response = await request(app).get('/api/learn/status/test-job-id');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Unexpected error');
    });

    it('should handle completed job status', async () => {
      mockJobQueue.getStatus.mockResolvedValue({
        success: true,
        data: {
          id: 'test-job-id',
          status: 'completed',
          result: {
            itemsCreated: 1,
            itemIds: ['item-1'],
          },
        },
      });

      const response = await request(app).get('/api/learn/status/test-job-id');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
      expect(response.body.result).toBeDefined();
    });

    it('should handle failed job status', async () => {
      mockJobQueue.getStatus.mockResolvedValue({
        success: true,
        data: {
          id: 'test-job-id',
          status: 'failed',
          error: 'Job processing failed',
        },
      });

      const response = await request(app).get('/api/learn/status/test-job-id');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('failed');
      expect(response.body.error).toBe('Job processing failed');
    });
  });
});
