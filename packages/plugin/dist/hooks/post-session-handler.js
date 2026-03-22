#!/usr/bin/env node
import {
  estimateSessionDurationMsFromTranscript
} from "../chunk-ZKL2ZRNA.js";
import {
  getConfig,
  markAnalysisPending,
  recoverStaleAnalysisState,
  shouldTriggerAnalysis
} from "../chunk-KAELRNDJ.js";
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
  estimateSessionDurationMsFromTranscript
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
  deps.recoverStaleAnalysisState({
    force: false,
    reason: "Recovered stale running state on SessionEnd hook startup."
  });
  const durationMs = resolveSessionDurationMs(
    hookInput,
    env,
    deps.estimateSessionDurationMsFromTranscript
  );
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