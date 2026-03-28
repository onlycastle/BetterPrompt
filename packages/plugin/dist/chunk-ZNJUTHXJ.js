import {
  getConfig,
  getStateFilePath
} from "./chunk-SE3623WC.js";
import {
  debug
} from "./chunk-FW6ZW4J3.js";

// lib/debounce.ts
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
var COOLDOWN_MS = 4 * 60 * 60 * 1e3;
var MIN_SESSION_DURATION_MS = 3 * 60 * 1e3;
var MAX_RUNNING_STATE_AGE_MS = 30 * 60 * 1e3;
var RUNNING_ANALYSIS_RESUME_GRACE_MS = 45 * 1e3;
var DEFAULT_STATE = {
  lastAnalysisTimestamp: null,
  lastAnalysisSessionCount: 0,
  analysisState: "idle",
  analysisInProgress: false,
  analysisPending: false,
  pendingSince: null,
  lastError: null,
  stateUpdatedAt: null
};
function normalizeState(state) {
  let analysisState = state.analysisState;
  if (!analysisState) {
    if (state.analysisInProgress) analysisState = "running";
    else if (state.analysisPending) analysisState = "pending";
    else analysisState = "idle";
  }
  return {
    ...state,
    analysisState,
    analysisInProgress: analysisState === "running",
    analysisPending: analysisState === "pending"
  };
}
function readState() {
  try {
    const raw = readFileSync(getStateFilePath(), "utf-8");
    return normalizeState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
  } catch {
    return { ...DEFAULT_STATE };
  }
}
function writeState(state) {
  const filePath = getStateFilePath();
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    JSON.stringify(
      normalizeState({
        ...state,
        stateUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }),
      null,
      2
    )
  );
}
function getStateUpdatedAtMs(state) {
  return state.stateUpdatedAt ? new Date(state.stateUpdatedAt).getTime() : Number.NaN;
}
function countClaudeSessions() {
  const projectsDir = join(homedir(), ".claude", "projects");
  try {
    const projects = readdirSync(projectsDir);
    return projects.reduce((count, project) => {
      try {
        const files = readdirSync(join(projectsDir, project));
        return count + files.filter((f) => f.endsWith(".jsonl")).length;
      } catch {
        return count;
      }
    }, 0);
  } catch {
    return 0;
  }
}
function getAnalysisLifecycleState() {
  return readState().analysisState;
}
function recoverStaleAnalysisState(options) {
  const state = readState();
  if (state.analysisState !== "running") {
    return state;
  }
  const updatedAt = getStateUpdatedAtMs(state);
  const isStale = options?.force || Number.isNaN(updatedAt) || Date.now() - updatedAt > MAX_RUNNING_STATE_AGE_MS;
  if (!isStale) {
    return state;
  }
  debug("debounce", "recovering stale running state", { reason: options?.reason ?? "stale" });
  const recoveredState = {
    ...state,
    analysisState: "failed",
    pendingSince: null,
    lastError: options?.reason ?? state.lastError ?? "Recovered stale running analysis state."
  };
  writeState(recoveredState);
  return normalizeState(recoveredState);
}
function shouldTriggerAnalysis(sessionDurationMs) {
  const state = recoverStaleAnalysisState();
  const config = getConfig();
  if (state.analysisInProgress) {
    debug("debounce", "shouldTriggerAnalysis", { shouldAnalyze: false, reason: "Analysis already in progress" });
    return { shouldAnalyze: false, reason: "Analysis already in progress" };
  }
  if (sessionDurationMs > 0 && sessionDurationMs < MIN_SESSION_DURATION_MS) {
    const reason = `Session too short (${Math.round(sessionDurationMs / 1e3)}s < 3min)`;
    debug("debounce", "shouldTriggerAnalysis", { shouldAnalyze: false, reason });
    return { shouldAnalyze: false, reason };
  }
  if (state.lastAnalysisTimestamp) {
    const elapsed = Date.now() - new Date(state.lastAnalysisTimestamp).getTime();
    if (elapsed < COOLDOWN_MS) {
      const remainingMin = Math.round((COOLDOWN_MS - elapsed) / 6e4);
      const reason = `Cooldown active (${remainingMin}min remaining)`;
      debug("debounce", "shouldTriggerAnalysis", { shouldAnalyze: false, reason });
      return { shouldAnalyze: false, reason };
    }
  }
  const currentCount = countClaudeSessions();
  const newSessions = currentCount - state.lastAnalysisSessionCount;
  if (newSessions < config.analyzeThreshold) {
    const reason = `Not enough new sessions (${newSessions}/${config.analyzeThreshold})`;
    debug("debounce", "shouldTriggerAnalysis", { shouldAnalyze: false, reason });
    return { shouldAnalyze: false, reason };
  }
  const result = {
    shouldAnalyze: true,
    reason: `${newSessions} new sessions, cooldown passed`
  };
  debug("debounce", "shouldTriggerAnalysis", { shouldAnalyze: result.shouldAnalyze, reason: result.reason });
  return result;
}
function markAnalysisStarted() {
  debug("debounce", "state transition: -> running");
  const state = readState();
  writeState({
    ...state,
    analysisState: "running",
    pendingSince: null,
    lastError: null
  });
}
function markAnalysisComplete(sessionCount) {
  debug("debounce", "state transition: -> complete");
  writeState({
    ...DEFAULT_STATE,
    lastAnalysisTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
    lastAnalysisSessionCount: sessionCount ?? countClaudeSessions(),
    analysisState: "complete"
  });
}
function markAnalysisFailed(error) {
  const errorMsg = error instanceof Error ? error.message : error ? String(error) : null;
  debug("debounce", "state transition: -> failed", { error: errorMsg ?? void 0 });
  const state = readState();
  writeState({
    ...state,
    analysisState: "failed",
    pendingSince: null,
    lastError: errorMsg
  });
}
function markAnalysisPending() {
  debug("debounce", "state transition: -> pending");
  const state = readState();
  writeState({
    ...state,
    analysisState: "pending",
    pendingSince: (/* @__PURE__ */ new Date()).toISOString(),
    lastError: null
  });
}
function isAnalysisPending() {
  const state = readState();
  return state.analysisState === "pending";
}
function clearAnalysisPending() {
  const state = readState();
  if (state.analysisState !== "pending") {
    return;
  }
  writeState({
    ...state,
    analysisState: "idle",
    pendingSince: null
  });
}
function shouldResumeRunningAnalysis(now = Date.now()) {
  const state = readState();
  if (state.analysisState !== "running") {
    return false;
  }
  const updatedAt = getStateUpdatedAtMs(state);
  return Number.isNaN(updatedAt) || now - updatedAt > RUNNING_ANALYSIS_RESUME_GRACE_MS;
}

export {
  getAnalysisLifecycleState,
  recoverStaleAnalysisState,
  shouldTriggerAnalysis,
  markAnalysisStarted,
  markAnalysisComplete,
  markAnalysisFailed,
  markAnalysisPending,
  isAnalysisPending,
  clearAnalysisPending,
  shouldResumeRunningAnalysis
};
//# sourceMappingURL=chunk-ZNJUTHXJ.js.map