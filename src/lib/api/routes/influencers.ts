/**
 * Influencer API Routes
 *
 * Endpoints for managing tracked influencers.
 * Uses Supabase PostgreSQL for persistence.
 */

import { Router, Request, Response } from 'express';
import { influencerDb } from '../../search-agent/db/index';
import type { CredibilityTier } from '../../search-agent/models/influencer';

const router = Router();

/**
 * GET /api/influencers
 * List all influencers
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const influencers = await influencerDb.findAll();
    const stats = await influencerDb.getStats();

    res.json({
      influencers,
      stats,
    });
  } catch (error) {
    console.error('Error listing influencers:', error);
    res.status(500).json({
      error: 'Failed to list influencers',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/influencers/active
 * List active influencers only
 */
router.get('/active', async (_req: Request, res: Response) => {
  try {
    const influencers = await influencerDb.findActive();
    res.json({ influencers });
  } catch (error) {
    console.error('Error listing active influencers:', error);
    res.status(500).json({
      error: 'Failed to list active influencers',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/influencers/tier/:tier
 * List influencers by credibility tier
 */
router.get('/tier/:tier', async (req: Request<{ tier: string }>, res: Response) => {
  try {
    const tier = req.params.tier as CredibilityTier;

    if (!['high', 'medium', 'standard'].includes(tier)) {
      res.status(400).json({ error: 'Invalid tier. Must be high, medium, or standard.' });
      return;
    }

    const influencers = await influencerDb.findByTier(tier);
    res.json({ influencers, tier });
  } catch (error) {
    console.error('Error listing influencers by tier:', error);
    res.status(500).json({
      error: 'Failed to list influencers by tier',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/influencers/:id
 * Get single influencer by ID
 */
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const influencer = await influencerDb.findById(req.params.id);

    if (!influencer) {
      res.status(404).json({ error: 'Influencer not found' });
      return;
    }

    res.json({ influencer });
  } catch (error) {
    console.error('Error getting influencer:', error);
    res.status(500).json({
      error: 'Failed to get influencer',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/influencers
 * Add a new influencer
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      description = '',
      credibilityTier = 'standard',
      identifiers,
      expertiseTopics,
      affiliation,
    } = req.body;

    // Validate required fields
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    if (!identifiers || !Array.isArray(identifiers) || identifiers.length === 0) {
      res.status(400).json({ error: 'At least one platform identifier is required' });
      return;
    }

    if (!expertiseTopics || !Array.isArray(expertiseTopics) || expertiseTopics.length === 0) {
      res.status(400).json({ error: 'At least one expertise topic is required' });
      return;
    }

    // Check if influencer with same name exists
    const existing = await influencerDb.findByName(name);
    if (existing) {
      res.status(409).json({ error: 'Influencer with this name already exists' });
      return;
    }

    const influencer = await influencerDb.save({
      name,
      description,
      credibilityTier,
      identifiers,
      expertiseTopics,
      affiliation,
      isActive: true,
    });

    res.status(201).json({ influencer });
  } catch (error) {
    console.error('Error adding influencer:', error);
    res.status(500).json({
      error: 'Failed to add influencer',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * PATCH /api/influencers/:id
 * Update an influencer
 */
router.patch('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const influencer = await influencerDb.update(req.params.id, req.body);

    if (!influencer) {
      res.status(404).json({ error: 'Influencer not found' });
      return;
    }

    res.json({ influencer });
  } catch (error) {
    console.error('Error updating influencer:', error);
    res.status(500).json({
      error: 'Failed to update influencer',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * DELETE /api/influencers/:id
 * Remove an influencer
 */
router.delete('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const deleted = await influencerDb.delete(req.params.id);

    if (!deleted) {
      res.status(404).json({ error: 'Influencer not found' });
      return;
    }

    res.json({ success: true, id: req.params.id });
  } catch (error) {
    console.error('Error removing influencer:', error);
    res.status(500).json({
      error: 'Failed to remove influencer',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/influencers/:id/deactivate
 * Deactivate an influencer (soft delete)
 */
router.post('/:id/deactivate', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const success = await influencerDb.deactivate(req.params.id);

    if (!success) {
      res.status(404).json({ error: 'Influencer not found' });
      return;
    }

    res.json({ success: true, id: req.params.id });
  } catch (error) {
    console.error('Error deactivating influencer:', error);
    res.status(500).json({
      error: 'Failed to deactivate influencer',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export { router as influencerRoutes };
