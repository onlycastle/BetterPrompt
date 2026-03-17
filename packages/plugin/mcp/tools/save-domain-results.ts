/**
 * save_domain_results MCP Tool
 *
 * Accepts structured analysis results for a specific domain.
 * Validates the input against shared schemas (including domain-specific
 * typed data) and stores it in the results database.
 *
 * Called by domain analysis skills after the host LLM completes analysis.
 */

import { z } from 'zod';
import {
  EvidenceSchema as SharedEvidenceSchema,
  DomainStrengthSchema,
  DomainGrowthAreaSchema,
  DOMAIN_NAMES,
} from '@betterprompt/shared';
import { saveDomainResult, getCurrentRunId } from '../../lib/results-db.js';
import type { DomainResult } from '../../lib/core/types.js';

export const definition = {
  name: 'save_domain_results',
  description:
    'Save structured analysis results for a specific domain. ' +
    'Called after analyzing a domain (thinkingQuality, communicationPatterns, ' +
    'learningBehavior, contextEfficiency, sessionOutcome, or content). ' +
    'Input must include domain name, overall score, strengths, and growth areas.',
};

// Re-export shared schemas for backward compatibility
export const EvidenceSchema = SharedEvidenceSchema;
export const StrengthSchema = DomainStrengthSchema;
export const GrowthAreaSchema = DomainGrowthAreaSchema;

export const DomainResultInputSchema = z.object({
  domain: z.enum([
    'thinkingQuality',
    'communicationPatterns',
    'learningBehavior',
    'contextEfficiency',
    'sessionOutcome',
    'content',
  ]),
  overallScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1).optional(),
  strengths: z.array(DomainStrengthSchema),
  growthAreas: z.array(DomainGrowthAreaSchema),
  /** Domain-specific typed data. Validated per domain when available. */
  data: z.record(z.string(), z.unknown()).optional(),
});


export async function execute(args: Record<string, unknown>): Promise<string> {
  // Get current run ID
  const runId = getCurrentRunId();

  if (!runId) {
    return JSON.stringify({
      status: 'error',
      message: 'No active analysis run. Call extract_data first to start an analysis.',
    });
  }

  // Validate input
  const parsed = DomainResultInputSchema.safeParse(args);
  if (!parsed.success) {
    return JSON.stringify({
      status: 'validation_error',
      message: 'Invalid domain result format.',
      errors: parsed.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  const domainResult: DomainResult = {
    domain: parsed.data.domain,
    overallScore: parsed.data.overallScore,
    confidenceScore: parsed.data.confidenceScore ?? 0.5,
    strengths: parsed.data.strengths,
    growthAreas: parsed.data.growthAreas,
    data: parsed.data.data,
    analyzedAt: new Date().toISOString(),
  };

  // Save to database
  saveDomainResult(runId, domainResult);

  return JSON.stringify({
    status: 'ok',
    domain: domainResult.domain,
    score: domainResult.overallScore,
    strengthCount: domainResult.strengths.length,
    growthAreaCount: domainResult.growthAreas.length,
    runId,
    message: `Saved ${domainResult.domain} analysis (score: ${domainResult.overallScore}/100) to run #${runId}.`,
  });
}
