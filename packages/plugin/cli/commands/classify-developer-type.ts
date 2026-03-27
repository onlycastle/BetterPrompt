/**
 * classify-developer-type CLI command
 *
 * Runs deterministic type classification from domain scores.
 *
 * Usage: betterprompt-cli classify-developer-type
 */

import { computeDeterministicScores } from '../../lib/core/deterministic-scorer.js';
import { computeDeterministicType } from '../../lib/core/deterministic-type-mapper.js';
import {
  getAnalysisRun,
  saveTypeResult,
  getCurrentRunId,
} from '../../lib/results-db.js';
import type { Phase1Output } from '../../lib/core/types.js';

export async function execute(_args: Record<string, unknown>): Promise<string> {
  const runId = getCurrentRunId();

  if (!runId) {
    return JSON.stringify({
      status: 'error',
      message: 'No active analysis run. Run extract-data first.',
    });
  }

  const existingRun = getAnalysisRun(runId);
  if (!existingRun?.phase1Output) {
    return JSON.stringify({
      status: 'error',
      message: 'No Phase 1 data found for the current run. Run extract-data first.',
    });
  }

  const phase1Output: Phase1Output = existingRun.phase1Output;
  const scores = existingRun.scores ?? computeDeterministicScores(phase1Output);
  const typeResult = computeDeterministicType(scores, phase1Output);

  saveTypeResult(runId, typeResult);

  return JSON.stringify({
    status: 'ok',
    primaryType: typeResult.primaryType,
    controlLevel: typeResult.controlLevel,
    matrixName: typeResult.matrixName,
    matrixEmoji: typeResult.matrixEmoji,
    distribution: typeResult.distribution,
    controlScore: typeResult.controlScore,
    runId,
    message:
      `Developer type: ${typeResult.matrixEmoji} ${typeResult.matrixName} ` +
      `(${typeResult.primaryType} / ${typeResult.controlLevel}). ` +
      `Distribution: ${Object.entries(typeResult.distribution).map(([k, v]) => `${k} ${v}%`).join(', ')}.`,
  });
}
