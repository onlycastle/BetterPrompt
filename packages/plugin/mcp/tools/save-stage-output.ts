/**
 * save_stage_output MCP Tool
 *
 * Accepts and validates pipeline stage outputs (session summaries,
 * project summaries, weekly insights, evidence verification, etc.)
 * and persists them in the local results database.
 *
 * Called by stage-specific analysis skills after the host LLM
 * completes each pipeline stage.
 *
 * @module plugin/mcp/tools/save-stage-output
 */

import { z } from 'zod';
import {
  STAGE_NAMES,
  STAGE_SCHEMAS,
} from '@betterprompt/shared';
import { getCurrentRunId } from '../../lib/results-db.js';
import { recordStageStatus, saveStageOutput } from '../../lib/stage-db.js';

export const definition = {
  name: 'save_stage_output',
  description:
    'Save output from a pipeline stage. ' +
    'Called after completing a stage (sessionSummaries, projectSummaries, ' +
    'weeklyInsights, typeClassification, evidenceVerification, contentWriter, translator, ' +
    'extractAiCollaboration, extractContextEngineering, extractToolMastery, ' +
    'extractBurnoutRisk, extractAiControl, extractSkillResilience). ' +
    'Input must include stage name and structured data matching the stage schema.',
};

export const StageOutputInputSchema = z.object({
  stage: z.enum(STAGE_NAMES),
  data: z.record(z.string(), z.unknown()),
});

function extractStageName(args: Record<string, unknown>): string | null {
  return typeof args.stage === 'string' ? args.stage : null;
}

export async function execute(args: Record<string, unknown>): Promise<string> {
  const runId = getCurrentRunId();
  const stageName = extractStageName(args);

  if (!runId) {
    return JSON.stringify({
      status: 'error',
      message: 'No active analysis run. Call extract_data first to start an analysis.',
    });
  }

  const parsed = StageOutputInputSchema.safeParse(args);
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

  const { stage, data } = parsed.data;
  const stageSchema = STAGE_SCHEMAS[stage];
  if (stageSchema) {
    const stageValidation = stageSchema.safeParse(data);
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

  saveStageOutput(runId, stage, data);
  recordStageStatus(runId, stage, {
    status: 'validated',
  });

  return JSON.stringify({
    status: 'ok',
    stage,
    runId,
    message: `Saved ${stage} output to run #${runId}.`,
  });
}
