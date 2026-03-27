/**
 * save-stage-output CLI command
 *
 * Validates and persists pipeline stage outputs.
 *
 * Usage: betterprompt-cli save-stage-output --stage extractAiPartnership --file /path/to/data.json
 *   OR:  betterprompt-cli save-stage-output --stage extractAiPartnership --data '{"key":"value"}'
 */

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { STAGE_NAMES, STAGE_SCHEMAS } from '@betterprompt/shared';
import { getCurrentRunId } from '../../lib/results-db.js';
import { recordStageStatus, saveStageOutput } from '../../lib/stage-db.js';

const StageOutputInputSchema = z.object({
  stage: z.enum(STAGE_NAMES),
  data: z.record(z.string(), z.unknown()),
});

export async function execute(args: Record<string, unknown>): Promise<string> {
  const runId = getCurrentRunId();
  const stageName = typeof args.stage === 'string' ? args.stage : null;

  if (!runId) {
    return JSON.stringify({
      status: 'error',
      message: 'No active analysis run. Run extract-data first to start an analysis.',
    });
  }

  // Read data from file if --file is provided
  let data = args.data;
  if (typeof args.file === 'string') {
    try {
      data = JSON.parse(readFileSync(args.file, 'utf-8'));
    } catch (error) {
      return JSON.stringify({
        status: 'error',
        message: `Failed to read input file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  // Parse stringified data if needed
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      // leave as-is
    }
  }

  const input = { stage: args.stage, data };
  const parsed = StageOutputInputSchema.safeParse(input);
  if (!parsed.success) {
    if (stageName) {
      recordStageStatus(runId, stageName, {
        status: 'failed',
        lastError: 'Invalid stage output format.',
      });
    }
    return JSON.stringify({
      status: 'validation_error',
      message: 'Invalid stage output format.',
      errors: parsed.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  const { stage, data: validatedData } = parsed.data;
  const stageSchema = STAGE_SCHEMAS[stage];
  if (stageSchema) {
    const stageValidation = stageSchema.safeParse(validatedData);
    if (!stageValidation.success) {
      recordStageStatus(runId, stage, {
        status: 'failed',
        lastError: `Data does not match ${stage} schema.`,
      });
      return JSON.stringify({
        status: 'validation_error',
        message: `Data does not match ${stage} schema.`,
        errors: stageValidation.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
  }

  saveStageOutput(runId, stage, validatedData);
  recordStageStatus(runId, stage, { status: 'validated' });

  return JSON.stringify({
    status: 'ok',
    stage,
    runId,
    message: `Saved ${stage} output to run #${runId}.`,
  });
}
