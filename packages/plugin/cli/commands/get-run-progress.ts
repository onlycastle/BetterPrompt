/**
 * get-run-progress CLI command
 *
 * Reports resumable progress for the current local analysis run.
 *
 * Usage: betterprompt-cli get-run-progress
 */

import {
  getAnalysisRun,
  getCurrentRunId,
  getDomainResult,
} from '../../lib/results-db.js';
import {
  getStageOutput,
  getStageStatuses,
  type StageLifecycleStatus,
} from '../../lib/stage-db.js';

const DOMAIN_STAGE_NAMES = new Set([
  'aiPartnership',
  'sessionCraft',
  'toolMastery',
  'skillResilience',
  'sessionMastery',
]);

export const REQUIRED_STAGE_SEQUENCE = [
  { stage: 'sessionSummaries', skill: 'summarize-sessions', tool: null, kind: 'stage' },
  { stage: 'extractAiPartnership', skill: 'extract-ai-partnership', tool: null, kind: 'stage' },
  { stage: 'extractSessionCraft', skill: 'extract-session-craft', tool: null, kind: 'stage' },
  { stage: 'extractToolMastery', skill: 'extract-tool-mastery', tool: null, kind: 'stage' },
  { stage: 'extractSkillResilience', skill: 'extract-skill-resilience', tool: null, kind: 'stage' },
  { stage: 'extractSessionMastery', skill: 'extract-session-mastery', tool: null, kind: 'stage' },
  { stage: 'aiPartnership', skill: 'write-ai-partnership', tool: null, kind: 'domain' },
  { stage: 'sessionCraft', skill: 'write-session-craft', tool: null, kind: 'domain' },
  { stage: 'toolMastery', skill: 'write-tool-mastery', tool: null, kind: 'domain' },
  { stage: 'skillResilience', skill: 'write-skill-resilience', tool: null, kind: 'domain' },
  { stage: 'sessionMastery', skill: 'write-session-mastery', tool: null, kind: 'domain' },
  { stage: 'projectSummaries', skill: 'summarize-projects', tool: null, kind: 'stage' },
  { stage: 'weeklyInsights', skill: 'generate-weekly-insights', tool: null, kind: 'stage' },
  { stage: 'deterministicType', skill: null, tool: 'classify-developer-type', kind: 'stage' },
  { stage: 'typeClassification', skill: 'classify-type', tool: null, kind: 'stage' },
  { stage: 'evidenceVerification', skill: null, tool: 'verify-evidence', kind: 'stage' },
  { stage: 'contentWriter', skill: 'write-content', tool: null, kind: 'stage' },
] as const;

export type RequiredStep = (typeof REQUIRED_STAGE_SEQUENCE)[number];
type StepStatus = StageLifecycleStatus | 'missing';

export interface RunProgressStep {
  stage: string;
  skill: string | null;
  tool: string | null;
  kind: 'stage' | 'domain';
  status: StepStatus;
  completed: boolean;
  hasArtifact: boolean;
  attemptCount: number;
  lastError: string | null;
  updatedAt: string | null;
}

function hasArtifact(runId: number, stage: string): boolean {
  if (stage === 'deterministicType') {
    return getAnalysisRun(runId)?.typeResult != null;
  }
  if (DOMAIN_STAGE_NAMES.has(stage)) {
    return getDomainResult(runId, stage) !== null;
  }
  return getStageOutput(runId, stage) !== null;
}

function buildStepStatus(
  runId: number,
  step: RequiredStep,
  statusLookup: Map<string, ReturnType<typeof getStageStatuses>[number]>,
): RunProgressStep {
  const savedStatus = statusLookup.get(step.stage);
  const artifactPresent = hasArtifact(runId, step.stage);

  if (savedStatus) {
    return {
      stage: step.stage,
      skill: step.skill,
      tool: step.tool,
      kind: step.kind,
      status: savedStatus.status,
      completed: savedStatus.status === 'validated',
      hasArtifact: artifactPresent,
      attemptCount: savedStatus.attemptCount,
      lastError: savedStatus.lastError,
      updatedAt: savedStatus.updatedAt,
    };
  }

  return {
    stage: step.stage,
    skill: step.skill,
    tool: step.tool,
    kind: step.kind,
    status: artifactPresent ? 'validated' : 'missing',
    completed: artifactPresent,
    hasArtifact: artifactPresent,
    attemptCount: 0,
    lastError: null,
    updatedAt: null,
  };
}

export async function execute(_args: Record<string, unknown>): Promise<string> {
  const runId = getCurrentRunId();

  if (!runId) {
    return JSON.stringify({
      status: 'no_run',
      message: 'No active analysis run. Start Phase 1 with scan-sessions and extract-data.',
    });
  }

  const run = getAnalysisRun(runId);
  if (!run?.phase1Output) {
    return JSON.stringify({
      status: 'no_run',
      runId,
      message: 'The current run has no resumable Phase 1 data. Start Phase 1 again.',
    });
  }

  const statusLookup = new Map(
    getStageStatuses(runId).map(status => [status.stage, status]),
  );
  const stages = REQUIRED_STAGE_SEQUENCE.map(step => buildStepStatus(runId, step, statusLookup));
  // Skip failed stages so the pipeline advances past permanently-failed stages
  // instead of getting stuck retrying the same failure forever.
  const nextIncomplete = stages.find(stage => !stage.completed && stage.status !== 'failed');
  const completedRequiredStages = stages.filter(stage => stage.completed).length;
  const skippedStages = stages.filter(stage => stage.status === 'failed');
  const projectNames = Array.from(
    new Set(
      (run.phase1Output.sessions ?? [])
        .map(session => session.projectName)
        .filter((name): name is string => typeof name === 'string' && name.length > 0),
    ),
  ).sort();

  const pendingStages = stages
    .filter(stage => !stage.completed && stage.status !== 'failed')
    .map(({ stage, skill, tool, kind, status, lastError }) => ({
      stage, skill, tool, kind, status,
      ...(lastError ? { lastError } : {}),
    }));

  const skippedStagesSummary = skippedStages.map(({ stage, skill, tool, kind, lastError, attemptCount }) => ({
    stage, skill, tool, kind, lastError, attemptCount,
  }));

  const nextStep = nextIncomplete
    ? { stage: nextIncomplete.stage, skill: nextIncomplete.skill, tool: nextIncomplete.tool, kind: nextIncomplete.kind }
    : { stage: 'generateReport', skill: null, tool: 'generate-report', kind: 'report' as const };

  return JSON.stringify({
    status: 'ok',
    runId,
    analyzedAt: run.analyzedAt,
    phase1Complete: true,
    sessionCount: run.phase1Output.sessionMetrics.totalSessions,
    projectNames,
    completionStatus: nextIncomplete ? 'incomplete' : 'complete',
    completedRequiredStages,
    totalRequiredStages: REQUIRED_STAGE_SEQUENCE.length,
    completedDomainCount: stages.filter(stage => DOMAIN_STAGE_NAMES.has(stage.stage) && stage.completed).length,
    totalDomainCount: DOMAIN_STAGE_NAMES.size,
    skippedStageCount: skippedStages.length,
    nextStep,
    pendingStages,
    skippedStages: skippedStagesSummary,
    message: nextIncomplete
      ? `Run #${runId} is incomplete (${completedRequiredStages}/${REQUIRED_STAGE_SEQUENCE.length}${skippedStages.length > 0 ? `, ${skippedStages.length} skipped due to failures` : ''}). Resume with ${nextStep.tool ?? nextStep.skill ?? nextStep.stage}.`
      : `Run #${runId} ${skippedStages.length > 0 ? `completed with ${skippedStages.length} skipped stage(s)` : 'already has all required stages'}. Ready to generate report.`,
  });
}
