/**
 * classify_developer_type MCP Tool
 *
 * Runs deterministic type classification from domain scores.
 * Uses Phase 1.2 rules (DeterministicTypeMapper) to determine
 * primary type and control level.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { computeDeterministicScores } from '../../lib/core/deterministic-scorer.js';
import { computeDeterministicType } from '../../lib/core/deterministic-type-mapper.js';
import { saveTypeResult, getCurrentRunId } from '../../lib/results-db.js';
import type { Phase1Output } from '../../lib/core/types.js';

export const definition = {
  name: 'classify_developer_type',
  description:
    'Classify the developer\'s AI collaboration type using deterministic rules. ' +
    'Uses the 5x3 type matrix (architect/analyst/conductor/speedrunner/trendsetter ' +
    'x explorer/navigator/cartographer). Requires extract_data to have been run first. ' +
    'Returns the primary type, distribution, control level, and matrix name.',
};

export async function execute(_args: Record<string, unknown>): Promise<string> {
  // Read Phase 1 output
  let phase1Output: Phase1Output;
  try {
    const phase1Path = join(homedir(), '.betterprompt', 'phase1-output.json');
    const content = await readFile(phase1Path, 'utf-8');
    phase1Output = JSON.parse(content);
  } catch {
    return JSON.stringify({
      status: 'error',
      message: 'No Phase 1 data found. Call extract_data first.',
    });
  }

  // Get current run
  const runId = getCurrentRunId();

  // Compute scores and type
  const scores = computeDeterministicScores(phase1Output);
  const typeResult = computeDeterministicType(scores, phase1Output);

  // Save to DB
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
      `(${typeResult.primaryType} / ${typeResult.controlLevel}). ` +
      `Distribution: architect ${typeResult.distribution.architect}%, ` +
      `analyst ${typeResult.distribution.analyst}%, ` +
      `conductor ${typeResult.distribution.conductor}%, ` +
      `speedrunner ${typeResult.distribution.speedrunner}%, ` +
      `trendsetter ${typeResult.distribution.trendsetter}%.`,
  });
}
