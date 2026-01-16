/**
 * Knowledge API Route - List
 * GET /api/knowledge - List knowledge items with optional filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { knowledgeDb } from '@/lib/search-agent/db/index';
import type {
  SourcePlatform,
  TopicCategory,
  KnowledgeStatus,
} from '@/lib/search-agent/models/knowledge';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query params
    const platform = searchParams.get('platform');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const author = searchParams.get('author');
    const influencerId = searchParams.get('influencerId');
    const minScore = searchParams.get('minScore');
    const query = searchParams.get('query');
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build filters
    const filters = {
      platform: platform as SourcePlatform | undefined,
      category: category as TopicCategory | undefined,
      status: status as KnowledgeStatus | undefined,
      author: author || undefined,
      influencerId: influencerId || undefined,
      minScore: minScore ? parseFloat(minScore) : undefined,
      query: query || undefined,
    };

    // Map sortBy for compatibility
    let dbSortBy: 'created_at' | 'relevance_score' | 'title' = 'created_at';
    if (sortBy === 'createdAt') dbSortBy = 'created_at';
    else if (sortBy === 'relevance') dbSortBy = 'relevance_score';
    else if (sortBy === 'title') dbSortBy = 'title';

    // Execute search
    const result = await knowledgeDb.search(filters, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      sortBy: dbSortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    return NextResponse.json({
      items: result.items,
      total: result.total,
      page: Math.floor(result.offset / result.limit) + 1,
      pageSize: result.limit,
    });
  } catch (error) {
    console.error('Error listing knowledge:', error);
    return NextResponse.json(
      {
        error: 'Failed to list knowledge items',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
