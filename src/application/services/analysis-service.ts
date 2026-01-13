/**
 * Analysis Service
 *
 * Orchestrates session analysis: parse → analyze → save → recommend.
 * This is the main entry point for analyzing Claude Code sessions.
 *
 * @module application/services/analysis-service
 */

import { ok, err, type Result } from '../../lib/result.js';
import { AnalysisError } from '../../domain/errors/index.js';
import type { IAnalysisRepository } from '../ports/storage.js';
import type { ILLMPort } from '../ports/llm.js';
import type {
  ParsedSession,
  StoredAnalysis,
  Evaluation,
  TypeResult,
  Dimensions,
} from '../../domain/models/index.js';

/**
 * Full analysis result including all components
 */
export interface FullAnalysisResult {
  evaluation: Evaluation;
  typeResult: TypeResult;
  dimensions: Dimensions;
  metadata: {
    sessionId: string;
    projectName: string;
    projectPath: string;
    durationSeconds: number;
    messageCount: number;
    toolCallCount: number;
    model?: string;
    analyzedAt: string;
  };
}

/**
 * Analysis service dependencies
 */
export interface AnalysisServiceDeps {
  analysisRepo: IAnalysisRepository;
  llm: ILLMPort;
  recommendationService?: {
    getForAnalysis: (analysis: FullAnalysisResult) => Promise<string[]>;
  };
}

/**
 * Analysis service options
 */
export interface AnalysisOptions {
  skipCache?: boolean;
  skipSave?: boolean;
  includeRecommendations?: boolean;
}

/**
 * Create Analysis Service
 */
export function createAnalysisService(deps: AnalysisServiceDeps) {
  const { analysisRepo, llm, recommendationService } = deps;

  return {
    /**
     * Analyze a single session
     */
    async analyzeSession(
      session: ParsedSession,
      options: AnalysisOptions = {}
    ): Promise<Result<FullAnalysisResult & { recommendations?: string[] }, AnalysisError>> {
      // 1. Check if already analyzed (unless skipCache)
      if (!options.skipCache) {
        const existingResult = await analysisRepo.findBySessionId(session.sessionId);
        if (existingResult.success && existingResult.data) {
          const existing = existingResult.data;
          return ok({
            evaluation: existing.evaluation,
            typeResult: existing.typeResult!,
            dimensions: existing.dimensions!,
            metadata: {
              sessionId: existing.evaluation.sessionId,
              projectName: existing.metadata.projectName,
              projectPath: existing.metadata.projectPath,
              durationSeconds: existing.metadata.durationSeconds,
              messageCount: existing.metadata.messageCount,
              toolCallCount: existing.metadata.toolCallCount,
              model: undefined,
              analyzedAt: existing.createdAt,
            },
          });
        }
      }

      // 2. Check if LLM is available
      if (!llm.isAvailable()) {
        return err(AnalysisError.llmError('LLM client not available', false));
      }

      // 3. Get LLM evaluation
      const evalResult = await llm.evaluateSession(session);
      if (!evalResult.success) {
        return err(evalResult.error);
      }

      // 4. Detect coding style
      const styleResult = await llm.detectCodingStyle([session]);
      if (!styleResult.success) {
        return err(styleResult.error);
      }

      // 5. Calculate dimensions
      const dimensionsResult = await llm.calculateDimensions([session]);
      if (!dimensionsResult.success) {
        return err(dimensionsResult.error);
      }

      // 6. Build full result
      const now = new Date().toISOString();
      const projectName = session.projectPath.split('/').pop() || 'unknown';
      const result: FullAnalysisResult = {
        evaluation: evalResult.data.data as unknown as Evaluation,
        typeResult: styleResult.data.data,
        dimensions: dimensionsResult.data.data,
        metadata: {
          sessionId: session.sessionId,
          projectName,
          projectPath: session.projectPath,
          durationSeconds: session.durationSeconds,
          messageCount: session.messages.length,
          toolCallCount: session.stats.toolCallCount,
          model: llm.getModel(),
          analyzedAt: now,
        },
      };

      // 7. Save to repository (unless skipSave)
      if (!options.skipSave) {
        const storedAnalysis: StoredAnalysis = {
          version: '1.0.0',
          createdAt: now,
          evaluation: result.evaluation,
          metadata: {
            projectPath: session.projectPath,
            projectName,
            durationSeconds: session.durationSeconds,
            messageCount: session.messages.length,
            toolCallCount: session.stats.toolCallCount,
            claudeCodeVersion: session.claudeCodeVersion,
          },
          typeResult: result.typeResult,
          dimensions: result.dimensions,
        };

        const saveResult = await analysisRepo.save(storedAnalysis);
        if (!saveResult.success) {
          // Log but don't fail - analysis is still valid
          console.warn('Failed to save analysis:', saveResult.error.message);
        }
      }

      // 8. Get recommendations if requested
      let recommendations: string[] | undefined;
      if (options.includeRecommendations && recommendationService) {
        try {
          recommendations = await recommendationService.getForAnalysis(result);
        } catch {
          // Log but don't fail
          console.warn('Failed to get recommendations');
        }
      }

      return ok({ ...result, recommendations });
    },

    /**
     * Get analysis by session ID
     */
    async getBySessionId(
      sessionId: string
    ): Promise<Result<StoredAnalysis | null, AnalysisError>> {
      const result = await analysisRepo.findBySessionId(sessionId);
      if (!result.success) {
        return err(AnalysisError.sessionNotFound(sessionId));
      }
      return ok(result.data);
    },

    /**
     * Get analysis by ID
     */
    async getById(id: string): Promise<Result<StoredAnalysis | null, AnalysisError>> {
      const result = await analysisRepo.findById(id);
      if (!result.success) {
        return err(AnalysisError.sessionNotFound(id));
      }
      return ok(result.data);
    },

    /**
     * Check if session has been analyzed
     */
    async hasAnalysis(sessionId: string): Promise<boolean> {
      const result = await analysisRepo.exists(sessionId);
      return result.success && result.data;
    },

    /**
     * Delete an analysis
     */
    async deleteAnalysis(id: string): Promise<Result<void, AnalysisError>> {
      const result = await analysisRepo.delete(id);
      if (!result.success) {
        return err(AnalysisError.sessionNotFound(id));
      }
      return ok(undefined);
    },

    /**
     * Get user's analysis count for the current month
     */
    async getMonthlyCount(userId: string): Promise<Result<number, AnalysisError>> {
      const result = await analysisRepo.countThisMonth(userId);
      if (!result.success) {
        return err(new AnalysisError(
          'STORAGE_ERROR',
          result.error.message,
          'Failed to get analysis count.',
          true
        ));
      }
      return ok(result.data);
    },

    /**
     * Re-analyze a session (force refresh)
     */
    async reanalyze(
      session: ParsedSession
    ): Promise<Result<FullAnalysisResult, AnalysisError>> {
      return this.analyzeSession(session, { skipCache: true });
    },
  };
}

/**
 * Analysis Service type
 */
export type AnalysisService = ReturnType<typeof createAnalysisService>;
