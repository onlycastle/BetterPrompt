import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/local/auth';
import { knowledgeStore } from '@/lib/search-agent/storage/knowledge-store';
import type {
  ContentType,
  KnowledgeItem,
  KnowledgeStatus,
  TopicCategory,
} from '@/lib/search-agent/models/knowledge';

function detectPlatformFromUrl(
  url: string
): 'twitter' | 'reddit' | 'linkedin' | 'youtube' | 'web' {
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('reddit.com')) return 'reddit';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'web';
}

function buildDefaultSummary(hostname: string, topics: string[]): string {
  const topicText = topics.length > 0 ? topics.join(', ') : 'AI coding workflows';
  return `Imported reference from ${hostname}. This item was added to capture useful context about ${topicText} so it can be reviewed, tagged, and improved inside the local knowledge base.`;
}

export async function POST(request: NextRequest) {
  try {
    const user = getCurrentUserFromRequest();

    const body = await request.json();
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    const topics = Array.isArray(body.topics)
      ? body.topics.filter((value: unknown): value is string =>
        typeof value === 'string' && value.trim().length > 0
      )
      : [];

    if (!url) {
      return NextResponse.json({ success: false, error: 'URL is required.' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid URL.' }, { status: 400 });
    }

    const existing = await knowledgeStore.getItemByUrl(url);
    if (existing) {
      return NextResponse.json({ success: true, item: existing });
    }

    const platform = detectPlatformFromUrl(url);
    const safeSummary = summary || buildDefaultSummary(parsedUrl.hostname, topics);
    const safeContent = `${safeSummary}\n\nSource URL: ${url}\n\nAdded by ${user.email} for local review and future enrichment inside the self-hosted knowledge base.`;

    const item: KnowledgeItem = {
      id: randomUUID(),
      version: '1.0.0',
      title: (title || `Imported from ${parsedUrl.hostname}`).slice(0, 200),
      summary: safeSummary.slice(0, 1000),
      content: safeContent.slice(0, 10000),
      category: 'other' as TopicCategory,
      contentType: 'reference' as ContentType,
      tags: topics.length > 0 ? topics.slice(0, 10) : ['ai-coding'],
      source: {
        platform,
        url,
        fetchedAt: new Date().toISOString(),
      },
      relevance: {
        score: 0.4,
        confidence: 0.3,
        reasoning: 'Imported manually from a URL into the local knowledge base.',
      },
      status: 'reviewed' as KnowledgeStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await knowledgeStore.saveItem(item);
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('[Learn/URL] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
