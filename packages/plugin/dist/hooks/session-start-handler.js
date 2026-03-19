#!/usr/bin/env node
import {
  buildPendingAnalysisAdditionalContext
} from "../chunk-FE2ZIUDY.js";
import {
  isAnalysisPending
} from "../chunk-V53KKR74.js";

// hooks/session-start-handler.ts
import { readFileSync, existsSync } from "fs";
import { execFileSync } from "child_process";
import { join } from "path";
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
function ensureNativeDeps() {
  const pluginDataDir = process.env.CLAUDE_PLUGIN_DATA;
  if (!pluginDataDir) return;
  const marker = join(pluginDataDir, "node_modules", "better-sqlite3", "build", "Release", "better_sqlite3.node");
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