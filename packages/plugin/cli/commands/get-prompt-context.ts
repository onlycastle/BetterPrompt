/**
 * get-prompt-context CLI command
 *
 * Returns stage- or domain-specific prompt payloads. Writes large output
 * to a file and returns the path.
 *
 * Usage: betterprompt-cli get-prompt-context --kind domainAnalysis [--domain aiPartnership]
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { getCurrentRunId, getAnalysisRun, getDomainResults } from '../../lib/results-db.js';
import { getAllStageOutputs } from '../../lib/stage-db.js';
import {
  buildPromptContext,
  PROMPT_CONTEXT_KINDS,
  type PromptContextDomain,
} from '../../lib/prompt-context.js';
import type { CanonicalStageOutputs } from '../../lib/core/types.js';
import { getPluginDataDir } from '../../lib/core/session-scanner.js';

const InputSchema = z.object({
  kind: z.enum(PROMPT_CONTEXT_KINDS),
  domain: z.enum([
    'aiPartnership',
    'sessionCraft',
    'toolMastery',
    'skillResilience',
    'sessionMastery',
  ]).optional(),
});

export async function execute(args: Record<string, unknown>): Promise<string> {
  const parsed = InputSchema.safeParse(args);
  if (!parsed.success) {
    return JSON.stringify({
      status: 'validation_error',
      message: 'Invalid prompt-context request.',
      errors: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: 'error',
      message: 'No active analysis run. Run extract-data first.',
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

    const result = {
      status: 'ok',
      runId,
      kind: parsed.data.kind,
      ...(parsed.data.domain ? { domain: parsed.data.domain } : {}),
      data,
    };

    // Write to file to avoid bloating agent context via stdout
    const tmpDir = join(getPluginDataDir(), 'tmp');
    await mkdir(tmpDir, { recursive: true });
    const label = parsed.data.domain ? `${parsed.data.kind}-${parsed.data.domain}` : parsed.data.kind;
    const outputFile = join(tmpDir, `context-${label}.json`);
    await writeFile(outputFile, JSON.stringify(result, null, 2), 'utf-8');

    return JSON.stringify({
      status: 'ok',
      runId,
      kind: parsed.data.kind,
      ...(parsed.data.domain ? { domain: parsed.data.domain } : {}),
      outputFile,
      message: `Prompt context written to ${outputFile}.`,
    });
  } catch (error) {
    return JSON.stringify({
      status: 'error',
      runId,
      message: error instanceof Error ? error.message : 'Failed to build prompt context.',
    });
  }
}
