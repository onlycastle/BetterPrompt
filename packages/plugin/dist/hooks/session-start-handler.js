#!/usr/bin/env node
import {
  buildFirstRunAdditionalContext,
  buildPendingAnalysisAdditionalContext
} from "../chunk-ZDSGFUFB.js";
import {
  getPluginDataDir2 as getPluginDataDir,
  isAnalysisPending
} from "../chunk-UH4HUW7Y.js";

// hooks/session-start-handler.ts
import { readFileSync as readFileSync2, existsSync } from "fs";
import { execFileSync } from "child_process";
import { join as join2 } from "path";
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
function ensureNativeDeps() {
  const pluginDataDir = process.env.CLAUDE_PLUGIN_DATA;
  if (!pluginDataDir) return;
  const marker = join2(pluginDataDir, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
  if (existsSync(marker)) return;
  try {
    execFileSync("npm", ["install", "--prefix", pluginDataDir, "better-sqlite3@12.8.0"], {
      stdio: "ignore",
      timeout: 6e4
    });
  } catch (err) {
    process.stderr.write(`[betterprompt] Failed to install better-sqlite3: ${err instanceof Error ? err.message : err}
`);
  }
}
function main() {
  ensureNativeDeps();
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