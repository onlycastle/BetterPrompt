#!/usr/bin/env node
import {
  buildPendingAnalysisAdditionalContext
} from "../chunk-WVJNTS3Y.js";
import {
  isAnalysisPending
} from "../chunk-EUSLREZV.js";

// hooks/session-start-handler.ts
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
var DEFAULT_DEPS = {
  isAnalysisPending,
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
  if (!deps.isAnalysisPending() || input.source === "compact") {
    return null;
  }
  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: deps.buildPendingAnalysisAdditionalContext()
    }
  };
}
function main() {
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