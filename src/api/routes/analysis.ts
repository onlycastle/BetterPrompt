/**
 * Analysis API Routes
 *
 * Endpoints for loading analysis data from local storage.
 * Bridges the CLI-generated local analysis files with the React SPA.
 */

import { Router, Request, Response } from 'express';
import { loadAnalysisLocally, listLocalAnalyses, LocalAnalysis } from '../../utils/local-analysis.js';
import type { VerboseEvaluation } from '../../models/verbose-evaluation.js';

const router = Router();

/** Extract error message from unknown error type */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Transform LocalAnalysis to API response format */
function toAnalysisResponse(analysis: LocalAnalysis): object {
  const data = analysis.data as VerboseEvaluation;

  return {
    id: analysis.id,
    type: analysis.type,
    createdAt: analysis.createdAt,
    expiresAt: analysis.expiresAt,
    metadata: analysis.metadata,
    data: {
      primaryType: data.primaryType,
      distribution: data.distribution,
      sessionsAnalyzed: analysis.metadata?.sessionCount ?? 1,
      analyzedAt: analysis.createdAt,
      personalitySummary: data.personalitySummary,
      promptPatterns: data.promptPatterns,
      dimensionInsights: data.dimensionInsights,
    },
  };
}

/**
 * GET /api/analysis/local
 * List all local analyses (summaries only)
 */
router.get('/local', async (_req: Request, res: Response): Promise<void> => {
  try {
    const analyses = await listLocalAnalyses({ limit: 20 });
    res.json({ analyses, count: analyses.length });
  } catch (error) {
    console.error('Error listing local analyses:', error);
    res.status(500).json({
      error: 'Failed to list analyses',
      message: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/analysis/local/:localId
 * Load a local analysis by ID
 */
router.get('/local/:localId', async (req: Request, res: Response): Promise<void> => {
  try {
    const localIdParam = req.params.localId;
    const localId = Array.isArray(localIdParam) ? localIdParam[0] : localIdParam;

    if (!localId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'localId is required',
      });
      return;
    }

    const analysis = await loadAnalysisLocally(localId);

    if (!analysis) {
      res.status(404).json({
        error: 'Analysis not found',
        message: 'Local analysis not found. It may have been deleted or expired.',
      });
      return;
    }

    res.json(toAnalysisResponse(analysis));
  } catch (error) {
    console.error('Error loading local analysis:', error);
    res.status(500).json({
      error: 'Failed to load analysis',
      message: getErrorMessage(error),
    });
  }
});

export { router as analysisRoutes };
