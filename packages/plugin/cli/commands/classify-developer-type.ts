/**
 * classify-developer-type CLI command
 *
 * Runs deterministic type classification from domain scores.
 *
 * Usage: betterprompt-cli classify-developer-type
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { computeDeterministicScores } from '../../lib/core/deterministic-scorer.js';
import { computeDeterministicType } from '../../lib/core/deterministic-type-mapper.js';
import { getPluginDataDir } from '../../lib/core/session-scanner.js';
import {
  getAnalysisRun,
  saveTypeResult,
  getCurrentRunId,
} from '../../lib/results-db.js';
import type { Phase1Output } from '../../lib/core/types.js';

export async function execute(_args: Record<string, unknown>): Promise<string> {
  const runId = getCurrentRunId();

  let phase1Output: Phase1Output;
  const existingRun = runId ? getAnalysisRun(runId) : null;

  if (existingRun?.phase1Output) {
    phase1Output = existingRun.phase1Output;
  } else {
    try {
      const phase1Path = join(getPluginDataDir(), 'phase1-output.json');
      const content = await readFile(phase1Path, 'utf-8');
      phase1Output = JSON.parse(content);
    } catch {
      return JSON.stringify({
        status: 'error',
        message: 'No Phase 1 data found. Run extract-data first.',
      });
    }
  }

  const scores = existingRun?.phase1Output
    ? existingRun.scores
    : computeDeterministicScores(phase1Output);
  const typeResult = computeDeterministicType(scores, phase1Output);

  if (runId) {
    saveTypeResult(runId, typeResult);
  }

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
      `(${typeResult.primaryType} / ${typeResult.controlLevel}).`,
  });
}
