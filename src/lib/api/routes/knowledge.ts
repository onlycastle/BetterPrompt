/**
 * Knowledge API Routes
 *
 * Endpoints for browsing and searching the knowledge base.
 * Uses Supabase PostgreSQL for persistence.
 */

import { Router, Request, Response } from 'express';
import { knowledgeDb } from '../../search-agent/db/index';
import type {
  SourcePlatform,
  TopicCategory,
  KnowledgeStatus,
} from '../../search-agent/models/knowledge';

const router = Router();

/**
 * GET /api/knowledge
 * List knowledge items with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Parse query params
    const {
      platform,
      category,
      status,
      author,
      influencerId,
      minScore,
      query,
      limit = '50',
      offset = '0',
      sortBy = 'created_at',
      sortOrder = 'desc',
    } = req.query;

    // Build filters
    const filters = {
      platform: platform as SourcePlatform | undefined,
      category: category as TopicCategory | undefined,
      status: status as KnowledgeStatus | undefined,
      author: author as string | undefined,
      influencerId: influencerId as string | undefined,
      minScore: minScore ? parseFloat(minScore as string) : undefined,
      query: query as string | undefined,
    };

    // Map sortBy for compatibility
    let dbSortBy: 'created_at' | 'relevance_score' | 'title' = 'created_at';
    if (sortBy === 'createdAt') dbSortBy = 'created_at';
    else if (sortBy === 'relevance') dbSortBy = 'relevance_score';
    else if (sortBy === 'title') dbSortBy = 'title';

    // Execute search
    const result = await knowledgeDb.search(filters, {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      sortBy: dbSortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    res.json({
      items: result.items,
      total: result.total,
      page: Math.floor(result.offset / result.limit) + 1,
      pageSize: result.limit,
    });
  } catch (error) {
    console.error('Error listing knowledge:', error);
    res.status(500).json({
      error: 'Failed to list knowledge items',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/knowledge/stats
 * Get knowledge base statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await knowledgeDb.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/knowledge/metrics
 * Get quality metrics
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await knowledgeDb.getQualityMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/knowledge/:id
 * Get single knowledge item by ID
 */
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const item = await knowledgeDb.findById(req.params.id);

    if (!item) {
      res.status(404).json({ error: 'Knowledge item not found' });
      return;
    }

    res.json({ item });
  } catch (error) {
    console.error('Error getting knowledge item:', error);
    res.status(500).json({
      error: 'Failed to get knowledge item',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/knowledge/:id
 * Delete a knowledge item
 */
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const deleted = await knowledgeDb.delete(req.params.id);

    if (!deleted) {
      res.status(404).json({ error: 'Knowledge item not found' });
      return;
    }

    res.json({ success: true, id: req.params.id });
  } catch (error) {
    console.error('Error deleting knowledge item:', error);
    res.status(500).json({
      error: 'Failed to delete knowledge item',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export { router as knowledgeRoutes };
