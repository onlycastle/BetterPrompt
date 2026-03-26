/**
 * get_run_progress MCP Tool
 *
 * Reports resumable progress for the current local analysis run so the
 * orchestrator can continue from the first incomplete required stage.
 *
 * @module plugin/mcp/tools/get-run-progress
 */

import { getAnalysisRun, getCurrentRunId, getDomainResult } from '../../lib/results-db.js';
import {
  getStageOutput,
  getStageStatuses,
  type StageLifecycleStatus,
} from '../../lib/stage-db.js';

export const definition = {
  name: 'get_run_progress',
  description:
    'Inspect the current local analysis run and report which required stages are complete, ' +
    'missing, or need to be resumed. Use this before starting bp analyze to resume interrupted runs.',
};

const DOMAIN_STAGE_NAMES = new Set([
  'aiPartnership',
  'sessionCraft',
  'toolMastery',
  'skillResilience',
  'sessionMastery',
]);

/**
 * 5-dimension pipeline stage sequence (v2).
 * Reduced from 19 stages (6+6 extract/write) to 17 stages (5+5 extract/write + context/classification/verification/content).
 */
export const REQUIRED_STAGE_SEQUENCE = [
  { stage: 'sessionSummaries', skill: 'summarize-sessions', tool: null, kind: 'stage' },
  // 5 extractors (down from 6)
  { stage: 'extractAiPartnership', skill: 'extract-ai-partnership', tool: null, kind: 'stage' },
  { stage: 'extractSessionCraft', skill: 'extract-session-craft', tool: null, kind: 'stage' },
  { stage: 'extractToolMastery', skill: 'extract-tool-mastery', tool: null, kind: 'stage' },
  { stage: 'extractSkillResilience', skill: 'extract-skill-resilience', tool: null, kind: 'stage' },
  { stage: 'extractSessionMastery', skill: 'extract-session-mastery', tool: null, kind: 'stage' },
  // 5 writers (down from 6)
  { stage: 'aiPartnership', skill: 'write-ai-partnership', tool: null, kind: 'domain' },
  { stage: 'sessionCraft', skill: 'write-session-craft', tool: null, kind: 'domain' },
  { stage: 'toolMastery', skill: 'write-tool-mastery', tool: null, kind: 'domain' },
  { stage: 'skillResilience', skill: 'write-skill-resilience', tool: null, kind: 'domain' },
  { stage: 'sessionMastery', skill: 'write-session-mastery', tool: null, kind: 'domain' },
  // Context generation + classification
  { stage: 'projectSummaries', skill: 'summarize-projects', tool: null, kind: 'stage' },
  { stage: 'weeklyInsights', skill: 'generate-weekly-insights', tool: null, kind: 'stage' },
  { stage: 'deterministicType', skill: null, tool: 'classify_developer_type', kind: 'stage' },
  { stage: 'typeClassification', skill: 'classify-type', tool: null, kind: 'stage' },
  { stage: 'evidenceVerification', skill: null, tool: 'verify_evidence', kind: 'stage' },
  { stage: 'contentWriter', skill: 'write-content', tool: null, kind: 'stage' },
] as const;

type RequiredStep = (typeof REQUIRED_STAGE_SEQUENCE)[number];

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

/**
 * Internal representation returned by `computeRunProgress`.
 * The MCP `execute()` response transforms this — it sends only `pendingStages`
 * (incomplete/failed entries) instead of the full `stages` array to reduce
 * orchestrator context accumulation.
 */
export interface RunProgressSummary {
  runId: number;
  analyzedAt: string;
  phase1Complete: boolean;
  sessionCount: number;
  projectNames: string[];
  completionStatus: 'incomplete' | 'complete';
  completedRequiredStages: number;
  totalRequiredStages: number;
  completedDomainCount: number;
  totalDomainCount: number;
  nextStep: {
    stage: string;
    skill: string | null;
    tool: string | null;
    kind: 'stage' | 'domain' | 'report';
  };
  /** Full stage list — used internally. MCP response sends only pendingStages. */
  stages: RunProgressStep[];
}

function hasArtifact(runId: number, stage: string): boolean {
  if (stage === 'deterministicType') {
    return getAnalysisRun(runId)?.typeResult !== null;
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

export function computeRunProgress(runId: number): RunProgressSummary | null {
  const run = getAnalysisRun(runId);
  if (!run?.phase1Output) {
    return null;
  }

  const statusLookup = new Map(
    getStageStatuses(runId).map(status => [status.stage, status]),
  );
  const stages = REQUIRED_STAGE_SEQUENCE.map(step => buildStepStatus(runId, step, statusLookup));
  const nextIncomplete = stages.find(stage => !stage.completed);
  const completedRequiredStages = stages.filter(stage => stage.completed).length;
  const projectNames = Array.from(
    new Set(
      (run.phase1Output.sessions ?? [])
        .map(session => session.projectName)
        .filter((name): name is string => typeof name === 'string' && name.length > 0),
    ),
  ).sort();

  return {
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
    nextStep: nextIncomplete
      ? {
        stage: nextIncomplete.stage,
        skill: nextIncomplete.skill,
        tool: nextIncomplete.tool,
        kind: nextIncomplete.kind,
      }
      : {
        stage: 'generateReport',
        skill: null,
        tool: 'generate_report',
        kind: 'report',
      },
    stages,
  };
}

export async function execute(): Promise<string> {
  const runId = getCurrentRunId();

  if (!runId) {
    return JSON.stringify({
      status: 'no_run',
      message: 'No active analysis run. Start Phase 1 with scan_sessions and extract_data.',
    });
  }

  const progress = computeRunProgress(runId);
  if (!progress) {
    return JSON.stringify({
      status: 'no_run',
      runId,
      message: 'The current run has no resumable Phase 1 data. Start Phase 1 again.',
    });
  }

  // Return compact response to reduce orchestrator context accumulation.
  // Only include incomplete/failed stages instead of the full 17-entry array.
  const pendingStages = progress.stages
    .filter(stage => !stage.completed)
    .map(({ stage, skill, tool, kind, status, lastError }) => ({
      stage, skill, tool, kind, status,
      ...(lastError ? { lastError } : {}),
    }));

  return JSON.stringify({
    status: 'ok',
    runId: progress.runId,
    analyzedAt: progress.analyzedAt,
    phase1Complete: progress.phase1Complete,
    sessionCount: progress.sessionCount,
    projectNames: progress.projectNames,
    completionStatus: progress.completionStatus,
    completedRequiredStages: progress.completedRequiredStages,
    totalRequiredStages: progress.totalRequiredStages,
    completedDomainCount: progress.completedDomainCount,
    totalDomainCount: progress.totalDomainCount,
    nextStep: progress.nextStep,
    pendingStages,
    message: progress.completionStatus === 'complete'
      ? `Run #${runId} already has all required stages. Call generate_report to reopen the report.`
      : `Run #${runId} is incomplete (${progress.completedRequiredStages}/${progress.totalRequiredStages}). Resume with ${progress.nextStep.tool ?? progress.nextStep.skill ?? progress.nextStep.stage}.`,
  });
}
