import {
  getAnalysisRun,
  getCurrentRunId,
  getDomainResult,
  getStageOutput,
  getStageStatuses
} from "./chunk-T2XRMW7B.js";
import "./chunk-UORQZYNI.js";
import "./chunk-NSBPE2FW.js";

// cli/commands/get-run-progress.ts
var DOMAIN_STAGE_NAMES = /* @__PURE__ */ new Set([
  "aiPartnership",
  "sessionCraft",
  "toolMastery",
  "skillResilience",
  "sessionMastery"
]);
var REQUIRED_STAGE_SEQUENCE = [
  { stage: "sessionSummaries", skill: "summarize-sessions", tool: null, kind: "stage" },
  { stage: "extractAiPartnership", skill: "extract-ai-partnership", tool: null, kind: "stage" },
  { stage: "extractSessionCraft", skill: "extract-session-craft", tool: null, kind: "stage" },
  { stage: "extractToolMastery", skill: "extract-tool-mastery", tool: null, kind: "stage" },
  { stage: "extractSkillResilience", skill: "extract-skill-resilience", tool: null, kind: "stage" },
  { stage: "extractSessionMastery", skill: "extract-session-mastery", tool: null, kind: "stage" },
  { stage: "aiPartnership", skill: "write-ai-partnership", tool: null, kind: "domain" },
  { stage: "sessionCraft", skill: "write-session-craft", tool: null, kind: "domain" },
  { stage: "toolMastery", skill: "write-tool-mastery", tool: null, kind: "domain" },
  { stage: "skillResilience", skill: "write-skill-resilience", tool: null, kind: "domain" },
  { stage: "sessionMastery", skill: "write-session-mastery", tool: null, kind: "domain" },
  { stage: "projectSummaries", skill: "summarize-projects", tool: null, kind: "stage" },
  { stage: "weeklyInsights", skill: "generate-weekly-insights", tool: null, kind: "stage" },
  { stage: "deterministicType", skill: null, tool: "classify-developer-type", kind: "stage" },
  { stage: "typeClassification", skill: "classify-type", tool: null, kind: "stage" },
  { stage: "evidenceVerification", skill: null, tool: "verify-evidence", kind: "stage" },
  { stage: "contentWriter", skill: "write-content", tool: null, kind: "stage" }
];
function hasArtifact(runId, stage) {
  if (stage === "deterministicType") {
    return getAnalysisRun(runId)?.typeResult !== null;
  }
  if (DOMAIN_STAGE_NAMES.has(stage)) {
    return getDomainResult(runId, stage) !== null;
  }
  return getStageOutput(runId, stage) !== null;
}
function buildStepStatus(runId, step, statusLookup) {
  const savedStatus = statusLookup.get(step.stage);
  const artifactPresent = hasArtifact(runId, step.stage);
  if (savedStatus) {
    return {
      stage: step.stage,
      skill: step.skill,
      tool: step.tool,
      kind: step.kind,
      status: savedStatus.status,
      completed: savedStatus.status === "validated",
      hasArtifact: artifactPresent,
      attemptCount: savedStatus.attemptCount,
      lastError: savedStatus.lastError,
      updatedAt: savedStatus.updatedAt
    };
  }
  return {
    stage: step.stage,
    skill: step.skill,
    tool: step.tool,
    kind: step.kind,
    status: artifactPresent ? "validated" : "missing",
    completed: artifactPresent,
    hasArtifact: artifactPresent,
    attemptCount: 0,
    lastError: null,
    updatedAt: null
  };
}
async function execute(_args) {
  const runId = getCurrentRunId();
  if (!runId) {
    return JSON.stringify({
      status: "no_run",
      message: "No active analysis run. Start Phase 1 with scan-sessions and extract-data."
    });
  }
  const run = getAnalysisRun(runId);
  if (!run?.phase1Output) {
    return JSON.stringify({
      status: "no_run",
      runId,
      message: "The current run has no resumable Phase 1 data. Start Phase 1 again."
    });
  }
  const statusLookup = new Map(
    getStageStatuses(runId).map((status) => [status.stage, status])
  );
  const stages = REQUIRED_STAGE_SEQUENCE.map((step) => buildStepStatus(runId, step, statusLookup));
  const nextIncomplete = stages.find((stage) => !stage.completed);
  const completedRequiredStages = stages.filter((stage) => stage.completed).length;
  const projectNames = Array.from(
    new Set(
      (run.phase1Output.sessions ?? []).map((session) => session.projectName).filter((name) => typeof name === "string" && name.length > 0)
    )
  ).sort();
  const pendingStages = stages.filter((stage) => !stage.completed).map(({ stage, skill, tool, kind, status, lastError }) => ({
    stage,
    skill,
    tool,
    kind,
    status,
    ...lastError ? { lastError } : {}
  }));
  const nextStep = nextIncomplete ? { stage: nextIncomplete.stage, skill: nextIncomplete.skill, tool: nextIncomplete.tool, kind: nextIncomplete.kind } : { stage: "generateReport", skill: null, tool: "generate-report", kind: "report" };
  return JSON.stringify({
    status: "ok",
    runId,
    analyzedAt: run.analyzedAt,
    phase1Complete: true,
    sessionCount: run.phase1Output.sessionMetrics.totalSessions,
    projectNames,
    completionStatus: nextIncomplete ? "incomplete" : "complete",
    completedRequiredStages,
    totalRequiredStages: REQUIRED_STAGE_SEQUENCE.length,
    completedDomainCount: stages.filter((stage) => DOMAIN_STAGE_NAMES.has(stage.stage) && stage.completed).length,
    totalDomainCount: DOMAIN_STAGE_NAMES.size,
    nextStep,
    pendingStages,
    message: nextIncomplete ? `Run #${runId} is incomplete (${completedRequiredStages}/${REQUIRED_STAGE_SEQUENCE.length}). Resume with ${nextStep.tool ?? nextStep.skill ?? nextStep.stage}.` : `Run #${runId} already has all required stages. Ready to generate report.`
  });
}
export {
  execute
};
//# sourceMappingURL=get-run-progress-O6LL2U2R.js.map