import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  createTranscriptSkill,
  isYouTubeUrl,
} from '@/lib/search-agent/skills/transcript';
import { knowledgeStore } from '@/lib/search-agent/storage/knowledge-store';
import { getCurrentUserFromRequest } from '@/lib/local/auth';
import type {
  ContentType,
  KnowledgeItem,
  KnowledgeStatus,
  TopicCategory,
} from '@/lib/search-agent/models/knowledge';

const TOPIC_CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: TopicCategory }> = [
  { keywords: ['prompt'], category: 'prompt-engineering' },
  { keywords: ['context', 'window'], category: 'context-engineering' },
  { keywords: ['tool', 'mcp'], category: 'tool-use' },
  { keywords: ['subagent', 'agent'], category: 'subagents' },
  { keywords: ['memory'], category: 'memory-management' },
  { keywords: ['workflow', 'automation'], category: 'workflow-automation' },
  { keywords: ['practice', 'pattern'], category: 'best-practices' },
  { keywords: ['claude', 'skill'], category: 'claude-code-skills' },
];

function mapTopicsToCategory(topics: string[]): TopicCategory {
  const text = topics.map((topic) => topic.toLowerCase()).join(' ');
  for (const { keywords, category } of TOPIC_CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return category;
    }
  }
  return 'other';
}

export async function POST(request: NextRequest) {
  try {
    const user = getCurrentUserFromRequest();

    const body = await request.json();
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const processPlaylist = Boolean(body.processPlaylist);
    const maxVideos = typeof body.maxVideos === 'number' ? body.maxVideos : 10;

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required.' }, { status: 400 });
    }

    if (!isYouTubeUrl(url)) {
      return NextResponse.json({ success: false, error: 'Invalid YouTube URL.' }, { status: 400 });
    }

    const transcriptSkill = createTranscriptSkill();
    const result = await transcriptSkill.execute({
      url,
      processPlaylist,
      maxPlaylistVideos: maxVideos,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    const savedItems: KnowledgeItem[] = [];
    const errors: Array<{ url: string; error: string }> = [];

    for (const videoResult of result.data?.results || []) {
      try {
        const { transcript, analysis } = videoResult;
        const existing = await knowledgeStore.getItemByUrl(transcript.video.url);
        if (existing) {
          savedItems.push(existing);
          continue;
        }

        const contentParts = [
          analysis.summary,
          '',
          '## Key Insights',
          ...analysis.keyInsights.map((insight) => `- ${insight}`),
        ];

        if (analysis.codeExamples.length > 0) {
          contentParts.push('', '## Code Examples', ...analysis.codeExamples);
        }

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
          },
          relevance: {
            score: analysis.relevanceToAICoding,
            confidence: 0.8,
            reasoning: `Imported from YouTube transcript by ${user.email}.`,
          },
          status: 'reviewed' as KnowledgeStatus,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await knowledgeStore.saveItem(knowledgeItem);
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
    console.error('[Learn/YouTube] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
