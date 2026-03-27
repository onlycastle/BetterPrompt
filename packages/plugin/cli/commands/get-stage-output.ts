/**
 * get-stage-output CLI command
 *
 * Reads a previously saved pipeline stage output. Writes large output to file.
 *
 * Usage: betterprompt-cli get-stage-output [--stage sessionSummaries]
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getCurrentRunId } from '../../lib/results-db.js';
import { getStageOutput, getAllStageOutputs } from '../../lib/stage-db.js';
import { getPluginDataDir } from '../../lib/core/session-scanner.js';

export async function execute(args: Record<string, unknown>): Promise<string> {
  const runId = getCurrentRunId();

  if (!runId) {
    return JSON.stringify({
      status: 'error',
      message: 'No active analysis run. Run extract-data first.',
    });
  }

  const tmpDir = join(getPluginDataDir(), 'tmp');
  await mkdir(tmpDir, { recursive: true });

  if (typeof args.stage === 'string') {
    const data = getStageOutput(runId, args.stage);
    if (!data) {
      return JSON.stringify({
        status: 'not_found',
        stage: args.stage,
        runId,
        message: `No ${args.stage} output found for run #${runId}. This stage may not have been executed yet.`,
      });
    }

    const result = { status: 'ok', stage: args.stage, runId, data };
    const outputFile = join(tmpDir, `stage-${args.stage}.json`);
    await writeFile(outputFile, JSON.stringify(result, null, 2), 'utf-8');

    return JSON.stringify({
      status: 'ok',
      stage: args.stage,
      runId,
      outputFile,
      message: `Stage output written to ${outputFile}.`,
    });
  }

  const all = getAllStageOutputs(runId);
  const stages = Object.keys(all);
  const result = { status: 'ok', runId, stagesAvailable: stages, data: all };
  const outputFile = join(tmpDir, 'stage-all.json');
  await writeFile(outputFile, JSON.stringify(result, null, 2), 'utf-8');

  return JSON.stringify({
    status: 'ok',
    runId,
    stagesAvailable: stages,
    outputFile,
    message: `All stage outputs written to ${outputFile}.`,
  });
}
