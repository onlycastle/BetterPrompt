/**
 * Analysis API Routes
 *
 * Endpoints for:
 * 1. Loading analysis data from local storage (CLI → React SPA bridge)
 * 2. Remote analysis from npx CLI (POST /api/analysis/remote)
 * 3. Fetching remote results by ID (GET /api/analysis/results/:resultId)
 */

import { Router, Request, Response } from 'express';
import { loadAnalysisLocally, listLocalAnalyses, LocalAnalysis } from '../../utils/local-analysis';
import type { VerboseEvaluation } from '../../models/verbose-evaluation';
import {
  analyzeRemoteSessions,
  loadRemoteResult,
  type AnalysisRequest,
} from '../services/remote-analysis';

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

/**
 * POST /api/analysis/remote
 * Remote analysis from CLI - receives session data, runs analysis, returns result
 *
 * Privacy: Raw session data is processed and immediately discarded.
 * Only the analysis result is stored.
 */
router.post('/remote', async (req: Request, res: Response): Promise<void> => {
  try {
    const request = req.body as AnalysisRequest;

    // Validate request
    if (!request.sessions || !Array.isArray(request.sessions) || request.sessions.length === 0) {
      res.status(400).json({
        code: 'INVALID_REQUEST',
        message: 'At least one session is required',
      });
      return;
    }

    // Run analysis
    const result = await analyzeRemoteSessions(request);

    res.json(result);
  } catch (error) {
    console.error('Error in remote analysis:', error);
    res.status(500).json({
      code: 'ANALYSIS_FAILED',
      message: getErrorMessage(error),
    });
  }
});

/**
 * GET /api/analysis/results/:resultId
 * Fetch analysis result by ID (for web UI)
 */
router.get('/results/:resultId', async (req: Request, res: Response): Promise<void> => {
  try {
    const resultIdParam = req.params.resultId;
    const resultId = Array.isArray(resultIdParam) ? resultIdParam[0] : resultIdParam;

    if (!resultId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'resultId is required',
      });
      return;
    }

    const result = await loadRemoteResult(resultId);

    if (!result) {
      res.status(404).json({
        error: 'Result not found',
        message: 'Analysis result not found. It may have expired.',
      });
      return;
    }

    // Return full or blurred data based on payment status
    res.json({
      resultId,
      isPaid: result.isPaid,
      evaluation: result.evaluation,
    });
  } catch (error) {
    console.error('Error loading remote result:', error);
    res.status(500).json({
      error: 'Failed to load result',
      message: getErrorMessage(error),
    });
  }
});

export { router as analysisRoutes };
