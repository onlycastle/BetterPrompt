/**
 * POST /api/learn/youtube
 * Learn from a YouTube video or playlist
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import {
  createTranscriptSkill,
  isYouTubeUrl,
} from '@/lib/search-agent/skills/transcript';
import { knowledgeDb } from '@/lib/search-agent/db';
import { getInfluencerDetector } from '@/lib/search-agent/influencers';
import type {
  KnowledgeItem,
  TopicCategory,
  ContentType,
  KnowledgeStatus,
} from '@/lib/search-agent/models/knowledge';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, processPlaylist = false, maxVideos = 10 } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    if (!isYouTubeUrl(url)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL' },
        { status: 400 }
      );
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
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
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

    return NextResponse.json({
      success: true,
      results: savedItems,
      savedCount: savedItems.length,
      errors: [...(result.data?.errors || []), ...errors],
    });
  } catch (error) {
    console.error('Error learning from YouTube:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
