/**
 * Knowledge API Route - List
 * GET /api/knowledge - List knowledge items with optional filters
 *
 * Supports both legacy category-based filtering and new dimension-based filtering:
 * - dimension: Single dimension filter (preferred)
 * - dimensions: Comma-separated dimension filters
 * - category: Legacy category filter (deprecated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { knowledgeDb } from '@/lib/search-agent/db/index';
import type {
  SourcePlatform,
  TopicCategory,
  DimensionName,
  KnowledgeStatus,
} from '@/lib/search-agent/models/knowledge';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse query params
    const platform = searchParams.get('platform');
    const dimension = searchParams.get('dimension');
    const dimensionsParam = searchParams.get('dimensions');
    const category = searchParams.get('category'); // Legacy
    const status = searchParams.get('status');
    const author = searchParams.get('author');
    const influencerId = searchParams.get('influencerId');
    const minScore = searchParams.get('minScore');
    const query = searchParams.get('query');
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Parse dimensions array
    const dimensions = dimensionsParam
      ? (dimensionsParam.split(',') as DimensionName[])
      : undefined;

    // Build filters (dimension-first, category as fallback)
    const filters = {
      platform: platform as SourcePlatform | undefined,
      dimension: dimension as DimensionName | undefined,
      dimensions,
      category: category as TopicCategory | undefined, // Legacy fallback
      status: status as KnowledgeStatus | undefined,
      author: author || undefined,
      influencerId: influencerId || undefined,
      minScore: minScore ? parseFloat(minScore) : undefined,
      query: query || undefined,
    };

    // Map sortBy for compatibility
    const SORT_FIELD_MAP: Record<string, 'created_at' | 'relevance_score' | 'title'> = {
      createdAt: 'created_at',
      relevance: 'relevance_score',
      title: 'title',
    };
    const dbSortBy = SORT_FIELD_MAP[sortBy] ?? 'created_at';

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
