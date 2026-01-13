/**
 * Learn API Routes
 *
 * Endpoints for learning from new content sources.
 * Uses Supabase PostgreSQL for persistence.
 */

import { Router, Request, Response } from 'express';
import {
  createTranscriptSkill,
  isYouTubeUrl,
} from '../../search-agent/skills/transcript/index.js';
import { knowledgeDb } from '../../search-agent/db/index.js';
import { getInfluencerDetector } from '../../search-agent/influencers/index.js';
import type {
  KnowledgeItem,
  TopicCategory,
  ContentType,
  KnowledgeStatus,
} from '../../search-agent/models/knowledge.js';
import { randomUUID } from 'node:crypto';
import { createMemoryJobQueue } from '../../infrastructure/jobs/index.js';

const router = Router();

// Job queue for async learning operations
let jobQueue: ReturnType<typeof createMemoryJobQueue> | null = null;

function getJobQueue() {
  if (!jobQueue) {
    jobQueue = createMemoryJobQueue({ concurrency: 2 });
    jobQueue.start();
  }
  return jobQueue;
}

/**
 * POST /api/learn/youtube
 * Learn from a YouTube video or playlist
 */
router.post('/youtube', async (req: Request, res: Response) => {
  try {
    const { url, processPlaylist = false, maxVideos = 10 } = req.body;

    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    if (!isYouTubeUrl(url)) {
      res.status(400).json({ error: 'Invalid YouTube URL' });
      return;
    }

    // Create transcript skill (without LLM for now - just transcript fetch)
    const transcriptSkill = createTranscriptSkill();

    // Execute the skill
    const result = await transcriptSkill.execute({
      url,
      processPlaylist,
      maxPlaylistVideos: maxVideos,
    });

    if (!result.success) {
      res.status(500).json({
        success: false,
        error: result.error,
      });
      return;
    }

    // Get influencer detector
    const detector = getInfluencerDetector();
    const savedItems: KnowledgeItem[] = [];
    const errors: Array<{ url: string; error: string }> = [];

    for (const videoResult of result.data?.results || []) {
      try {
        const { transcript, analysis } = videoResult;

        // Detect influencer (async)
        let influencerResult = await detector.detectFromUrl(transcript.video.url);
        if (!influencerResult.found) {
          // Also try by channel name
          const channelResult = await detector.detectFromAuthor(transcript.video.channelName);
          if (channelResult.found) {
            influencerResult = channelResult;
          }
        }

        // Build content string
        const contentParts = [
          analysis.summary,
          '',
          '## Key Insights',
          ...analysis.keyInsights.map((insight) => `- ${insight}`),
        ];

        if (analysis.codeExamples.length > 0) {
          contentParts.push('', '## Code Examples', ...analysis.codeExamples);
        }

        // Create knowledge item
        const knowledgeItem: KnowledgeItem = {
          id: randomUUID(),
          version: '1.0.0',
          title: transcript.video.title.slice(0, 200),
          summary: analysis.summary.slice(0, 1000),
          content: contentParts.join('\n').slice(0, 10000),
          category: mapTopicsToCategory(analysis.topics),
          contentType: 'insight' as ContentType,
          tags: analysis.topics.slice(0, 10),
          source: {
            platform: 'youtube',
            url: transcript.video.url,
            author: transcript.video.channelName,
            authorHandle: transcript.video.channelName,
            fetchedAt: transcript.fetchedAt,
            publishedAt: transcript.video.publishedAt,
            influencerId: influencerResult.influencer?.id,
            credibilityTier: influencerResult.influencer?.credibilityTier,
          },
          relevance: {
            score: analysis.relevanceToAICoding,
            confidence: 0.8,
            reasoning: 'Analyzed from YouTube transcript',
          },
          status: 'reviewed' as KnowledgeStatus,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await knowledgeDb.save(knowledgeItem);
        savedItems.push(knowledgeItem);
      } catch (error) {
        errors.push({
          url: videoResult.transcript.video.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    res.json({
      success: true,
      results: savedItems,
      savedCount: savedItems.length,
      errors: [...(result.data?.errors || []), ...errors],
    });
  } catch (error) {
    console.error('Error learning from YouTube:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/learn/url
 * Learn from a web URL (Twitter, Reddit, LinkedIn, etc.)
 *
 * If summary is provided, creates knowledge item synchronously.
 * If summary is missing, queues an async job for content analysis.
 */
router.post('/url', async (req: Request, res: Response) => {
  try {
    const { url, title, summary, topics = [] } = req.body;

    if (!url) {
      res.status(400).json({ error: 'URL is required' });
      return;
    }

    // If no summary provided, queue for async analysis
    if (!summary || summary.trim() === '') {
      const queue = getJobQueue();
      const jobResult = await queue.enqueue({
        type: 'knowledge_learn',
        payload: {
          type: 'knowledge_learn',
          query: url,
          topics: topics.length > 0 ? topics : ['ai-coding'],
          maxItems: 1,
        },
        priority: 'normal',
      });

      if (!jobResult.success) {
        res.status(500).json({ success: false, error: 'Failed to queue learning job' });
        return;
      }

      res.status(202).json({
        success: true,
        jobId: jobResult.data.id,
        status: 'queued',
        message: 'Learning job queued for processing',
      });
      return;
    }

    // Synchronous path: create knowledge item immediately with provided data
    // Detect platform from URL
    const platform = detectPlatformFromUrl(url);

    // Detect influencer (async)
    const detector = getInfluencerDetector();
    const influencerResult = await detector.detectFromUrl(url);

    // Create basic knowledge item
    const knowledgeItem: KnowledgeItem = {
      id: randomUUID(),
      version: '1.0.0',
      title: (title || `Content from ${platform}`).slice(0, 200),
      summary: summary.slice(0, 1000),
      content: summary.slice(0, 10000),
      category: 'other' as TopicCategory,
      contentType: 'insight' as ContentType,
      tags: topics.length > 0 ? topics.slice(0, 10) : ['ai-coding'],
      source: {
        platform,
        url,
        fetchedAt: new Date().toISOString(),
        influencerId: influencerResult.influencer?.id,
        credibilityTier: influencerResult.influencer?.credibilityTier,
      },
      relevance: {
        score: 0.5,
        confidence: 0.3,
        reasoning: 'Manually added with summary',
      },
      status: 'reviewed' as KnowledgeStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await knowledgeDb.save(knowledgeItem);

    res.json({
      success: true,
      item: knowledgeItem,
    });
  } catch (error) {
    console.error('Error learning from URL:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/learn/status/:id
 * Get learning job status
 */
router.get('/status/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Ensure id is a string (Express types it as string | string[])
    if (typeof id !== 'string') {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const queue = getJobQueue();
    const statusResult = await queue.getStatus(id);

    if (!statusResult.success) {
      res.status(500).json({ error: 'Failed to get job status' });
      return;
    }

    if (!statusResult.data) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json(statusResult.data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Helper: Detect platform from URL
 */
function detectPlatformFromUrl(
  url: string
): 'twitter' | 'reddit' | 'linkedin' | 'youtube' | 'web' {
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'web';
}

/**
 * Helper: Map topics to category
 */
function mapTopicsToCategory(topics: string[]): TopicCategory {
  const topicLower = topics.map((t) => t.toLowerCase()).join(' ');

  if (topicLower.includes('prompt')) return 'prompt-engineering';
  if (topicLower.includes('context') || topicLower.includes('window'))
    return 'context-engineering';
  if (topicLower.includes('tool') || topicLower.includes('mcp')) return 'tool-use';
  if (topicLower.includes('subagent') || topicLower.includes('agent')) return 'subagents';
  if (topicLower.includes('memory')) return 'memory-management';
  if (topicLower.includes('workflow') || topicLower.includes('automation'))
    return 'workflow-automation';
  if (topicLower.includes('practice') || topicLower.includes('pattern')) return 'best-practices';
  if (topicLower.includes('claude') || topicLower.includes('skill')) return 'claude-code-skills';

  return 'other';
}

export { router as learnRoutes };
