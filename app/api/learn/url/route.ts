/**
 * POST /api/learn/url
 * Learn from a web URL (Twitter, Reddit, LinkedIn, etc.)
 *
 * If summary is provided, creates knowledge item synchronously.
 * If summary is missing, queues an async job for content analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { knowledgeDb } from '@/lib/search-agent/db';
import { getInfluencerDetector } from '@/lib/search-agent/influencers';
import { createMemoryJobQueue } from '@/lib/infrastructure/jobs';
import type {
  KnowledgeItem,
  TopicCategory,
  ContentType,
  KnowledgeStatus,
} from '@/lib/search-agent/models/knowledge';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, title, summary, topics = [] } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
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
        return NextResponse.json(
          { success: false, error: 'Failed to queue learning job' },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          jobId: jobResult.data.id,
          status: 'queued',
          message: 'Learning job queued for processing',
        },
        { status: 202 }
      );
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

    return NextResponse.json({
      success: true,
      item: knowledgeItem,
    });
  } catch (error) {
    console.error('Error learning from URL:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
