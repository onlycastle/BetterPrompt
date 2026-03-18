/**
 * get_prompt_context MCP Tool
 *
 * Returns stage- or domain-specific prompt payloads derived from the current
 * canonical analysis run so skills do not need to reread raw Phase 1 files.
 *
 * @module plugin/mcp/tools/get-prompt-context
 */

import { z } from 'zod';
import { getCurrentRunId, getAnalysisRun, getDomainResults } from '../../lib/results-db.js';
import { getAllStageOutputs } from '../../lib/stage-db.js';
import {
  buildPromptContext,
  PROMPT_CONTEXT_KINDS,
  type PromptContextDomain,
} from '../../lib/prompt-context.js';
import type { CanonicalStageOutputs } from '../../lib/core/types.js';

export const definition = {
  name: 'get_prompt_context',
  description:
    'Read a stage- or domain-specific prompt payload from the current analysis run. ' +
    'Use this instead of reading ~/.betterprompt/phase1-output.json directly. ' +
    'Kinds: sessionSummaries, domainAnalysis, projectSummaries, weeklyInsights, ' +
    'typeClassification, evidenceVerification, contentWriter, translation.',
};

export const GetPromptContextInputSchema = z.object({
  kind: z.enum(PROMPT_CONTEXT_KINDS),
  domain: z.enum([
    'thinkingQuality',
    'communicationPatterns',
    'learningBehavior',
    'contextEfficiency',
    'sessionOutcome',
  ]).optional(),
});

export async function execute(args: { kind: typeof PROMPT_CONTEXT_KINDS[number]; domain?: string }): Promise<string> {
  const parsed = GetPromptContextInputSchema.safeParse(args);
  if (!parsed.success) {
    return JSON.stringify({
      status: 'validation_error',
      message: 'Invalid prompt-context request.',
      errors: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: 'error',
      message: 'No active analysis run. Call extract_data first.',
    });
  }

  const run = getAnalysisRun(runId);
  if (!run?.phase1Output) {
    return JSON.stringify({
      status: 'not_found',
      runId,
      message: `Run #${runId} has no Phase 1 output.`,
    });
  }

  try {
    const data = buildPromptContext({
      kind: parsed.data.kind,
      domain: parsed.data.domain as PromptContextDomain | undefined,
      phase1Output: run.phase1Output,
      deterministicScores: run.scores,
      typeResult: run.typeResult,
      domainResults: getDomainResults(runId),
      stageOutputs: getAllStageOutputs(runId) as CanonicalStageOutputs,
    });

    return JSON.stringify({
      status: 'ok',
      runId,
      kind: parsed.data.kind,
      ...(parsed.data.domain ? { domain: parsed.data.domain } : {}),
      data,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      runId,
      message: error instanceof Error ? error.message : 'Failed to build prompt context.',
    });
  }
}
