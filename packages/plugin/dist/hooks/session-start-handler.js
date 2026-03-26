#!/usr/bin/env node
import {
  ensureNativeDeps
} from "../chunk-ZSMKKVNT.js";
import {
  isFirstRun
} from "../chunk-QFCYET5Y.js";
import {
  buildFirstRunAdditionalContext,
  buildPendingAnalysisAdditionalContext
} from "../chunk-VADEIFYQ.js";
import {
  isAnalysisPending,
  markAnalysisPending,
  shouldResumeRunningAnalysis
} from "../chunk-SUEN2LKX.js";
import {
  debug
} from "../chunk-PP5673GG.js";

// hooks/session-start-handler.ts
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
var DEFAULT_DEPS = {
  isFirstRun,
  buildFirstRunAdditionalContext,
  isAnalysisPending,
  shouldResumeRunningAnalysis,
  markAnalysisPending,
  buildPendingAnalysisAdditionalContext
};
function readHookInput(raw) {
  try {
    const payload = raw ?? readFileSync(0, "utf-8").trim();
    return payload ? JSON.parse(payload) : {};
  } catch {
    return {};
  }
}
function handleSessionStartHook(input, deps = DEFAULT_DEPS) {
  debug("hook", "session-start", { source: input.source });
  if (input.source === "compact") {
    debug("hook", "session-start: compact source, skipping");
    return null;
  }
  if (deps.isFirstRun()) {
    debug("hook", "session-start: first run detected");
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: deps.buildFirstRunAdditionalContext()
      }
    };
  }
  if (deps.shouldResumeRunningAnalysis()) {
    deps.markAnalysisPending();
    debug("hook", "session-start: stale running analysis detected, converted to pending");
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: deps.buildPendingAnalysisAdditionalContext()
      }
    };
  }
  if (deps.isAnalysisPending()) {
    debug("hook", "session-start: pending analysis detected");
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: deps.buildPendingAnalysisAdditionalContext()
      }
    };
  }
  debug("hook", "session-start: no action needed");
  return null;
}
function main() {
  const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  ensureNativeDeps({ pluginRoot });
  const output = handleSessionStartHook(readHookInput());
  if (!output) {
    process.exit(0);
  }
  process.stdout.write(JSON.stringify(output));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
export {
  handleSessionStartHook,
  readHookInput
};
//# sourceMappingURL=session-start-handler.js.map