#!/usr/bin/env node
import {
  ensureNativeDeps
} from "../chunk-N7IIUGRQ.js";
import {
  buildFirstRunAdditionalContext,
  buildPendingAnalysisAdditionalContext
} from "../chunk-ZKL2ZRNA.js";
import {
  getPluginDataDir2 as getPluginDataDir,
  isAnalysisPending
} from "../chunk-P47QYDTU.js";
import "../chunk-PR4QN5HX.js";

// hooks/session-start-handler.ts
import { readFileSync as readFileSync2 } from "fs";
import { dirname as dirname2, join as join2 } from "path";
import { fileURLToPath } from "url";

// lib/prefs.ts
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
function getPrefsFilePath() {
  return join(getPluginDataDir(), "prefs.json");
}
function readPrefs() {
  try {
    const raw = readFileSync(getPrefsFilePath(), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function isFirstRun() {
  return !readPrefs().welcomeCompleted;
}

// hooks/session-start-handler.ts
var DEFAULT_DEPS = {
  isFirstRun,
  buildFirstRunAdditionalContext,
  isAnalysisPending,
  buildPendingAnalysisAdditionalContext
};
function readHookInput(raw) {
  try {
    const payload = raw ?? readFileSync2(0, "utf-8").trim();
    return payload ? JSON.parse(payload) : {};
  } catch {
    return {};
  }
}
function handleSessionStartHook(input, deps = DEFAULT_DEPS) {
  if (input.source === "compact") {
    return null;
  }
  if (deps.isFirstRun()) {
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: deps.buildFirstRunAdditionalContext()
      }
    };
  }
  if (deps.isAnalysisPending()) {
    return {
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: deps.buildPendingAnalysisAdditionalContext()
      }
    };
  }
  return null;
}
function main() {
  const pluginRoot = join2(dirname2(fileURLToPath(import.meta.url)), "..", "..");
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