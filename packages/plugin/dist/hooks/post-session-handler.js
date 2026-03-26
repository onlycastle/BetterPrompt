#!/usr/bin/env node
import {
  estimateSessionDurationMsFromTranscript,
  isInFlightTranscriptBoundary
} from "../chunk-VADEIFYQ.js";
import {
  getConfig,
  markAnalysisPending,
  recoverStaleAnalysisState,
  shouldTriggerAnalysis
} from "../chunk-72GWNTBD.js";
import {
  debug
} from "../chunk-PP5673GG.js";

// hooks/post-session-handler.ts
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
var DEFAULT_DEPS = {
  getConfig,
  recoverStaleAnalysisState,
  shouldTriggerAnalysis,
  markAnalysisPending,
  estimateSessionDurationMsFromTranscript,
  isInFlightTranscriptBoundary
};
function readHookInput(raw) {
  try {
    const payload = raw ?? readFileSync(0, "utf-8").trim();
    return payload ? JSON.parse(payload) : {};
  } catch {
    return {};
  }
}
function resolveSessionDurationMs(hookInput, env, estimateDuration = estimateSessionDurationMsFromTranscript) {
  return Number.parseInt(env.CLAUDE_SESSION_DURATION_MS ?? "0", 10) || (hookInput.transcript_path ? estimateDuration(hookInput.transcript_path) : 0);
}
function handleSessionEndHook(hookInput, deps = DEFAULT_DEPS, env = process.env) {
  debug("hook", "session-end");
  const config = deps.getConfig();
  if (!config.autoAnalyze) {
    debug("hook", "session-end: auto-analyze disabled");
    return {
      queued: false,
      reason: "Auto-analysis disabled",
      durationMs: 0
    };
  }
  const recoveredState = deps.recoverStaleAnalysisState({
    force: false,
    reason: "Recovered stale running state on SessionEnd hook startup."
  });
  const durationMs = resolveSessionDurationMs(
    hookInput,
    env,
    deps.estimateSessionDurationMsFromTranscript
  );
  if (recoveredState.analysisState === "running") {
    const stillActive = hookInput.transcript_path ? deps.isInFlightTranscriptBoundary(hookInput.transcript_path) : false;
    if (stillActive) {
      const reason2 = "Analysis still appears to be mid-turn; skipping requeue for this SessionEnd event";
      debug("hook", "session-end: running analysis still active, skipping requeue", { reason: reason2, durationMs });
      return {
        queued: false,
        reason: reason2,
        durationMs
      };
    }
    const reason = "Active analysis session ended before completion; queued resume for the next session";
    deps.markAnalysisPending();
    debug("hook", "session-end: interrupted analysis re-queued", { reason, durationMs });
    return {
      queued: true,
      reason,
      durationMs
    };
  }
  const result = deps.shouldTriggerAnalysis(durationMs);
  if (!result.shouldAnalyze) {
    debug("hook", "session-end: analysis skipped", { reason: result.reason, durationMs });
    return {
      queued: false,
      reason: result.reason,
      durationMs
    };
  }
  deps.markAnalysisPending();
  debug("hook", "session-end: analysis queued", { reason: result.reason, durationMs });
  return {
    queued: true,
    reason: result.reason,
    durationMs
  };
}
function main() {
  handleSessionEndHook(readHookInput());
  process.exit(0);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
export {
  handleSessionEndHook,
  readHookInput,
  resolveSessionDurationMs
};
//# sourceMappingURL=post-session-handler.js.map