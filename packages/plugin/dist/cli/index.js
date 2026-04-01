#!/usr/bin/env node
import {
  ensureNativeDeps
} from "../chunk-A6TBYMRP.js";
import "../chunk-FW6ZW4J3.js";
import "../chunk-NSBPE2FW.js";

// cli/index.ts
import { dirname, join } from "path";
import { fileURLToPath } from "url";
var pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
ensureNativeDeps({ pluginRoot, fatal: true });
var COMMANDS = {
  "scan-sessions": () => import("../scan-sessions-N7HMY54J.js"),
  "extract-data": () => import("../extract-data-GHJRQJBX.js"),
  "get-prompt-context": () => import("../get-prompt-context-EZFVGZDL.js"),
  "save-stage-output": () => import("../save-stage-output-LTN2E56K.js"),
  "get-stage-output": () => import("../get-stage-output-G3OSRNUN.js"),
  "save-domain-results": () => import("../save-domain-results-ISO6VRTK.js"),
  "get-domain-results": () => import("../get-domain-results-GMVQWLA5.js"),
  "get-run-progress": () => import("../get-run-progress-J3GMJ6GQ.js"),
  "classify-developer-type": () => import("../classify-developer-type-KAI6DFL5.js"),
  "verify-evidence": () => import("../verify-evidence-S4XZYZIV.js"),
  "generate-report": () => import("../generate-report-X7GZ7GGW.js"),
  "sync-to-team": () => import("../sync-to-team-GPEQPNAS.js"),
  "get-user-prefs": () => import("../get-user-prefs-MWHYJOSV.js"),
  "save-user-prefs": () => import("../save-user-prefs-2QFKIE7V.js")
};
function toCamelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith("--")) {
      const key = toCamelCase(token.slice(2));
      const next = rest[i + 1];
      if (key in args) {
        throw new Error(`Duplicate flag: ${token} (already provided)`);
      }
      if (next === void 0 || next.startsWith("--")) {
        args[key] = true;
        continue;
      }
      try {
        args[key] = JSON.parse(next);
      } catch {
        args[key] = next;
      }
      i++;
    }
  }
  return { command: command ?? "", args };
}
async function main() {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (!command || command === "help") {
    const commands = Object.keys(COMMANDS).sort().join("\n  ");
    console.log(`BetterPrompt CLI

Usage: betterprompt-cli <command> [--arg value ...]

Commands:
  ${commands}`);
    process.exit(0);
  }
  const loader = COMMANDS[command];
  if (!loader) {
    console.error(JSON.stringify({
      status: "error",
      message: `Unknown command: ${command}. Run with "help" to see available commands.`
    }));
    process.exit(1);
  }
  try {
    const mod = await loader();
    const result = await mod.execute(args);
    console.log(result);
  } catch (error) {
    console.error(JSON.stringify({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error"
    }));
    process.exit(1);
  }
}
main();
//# sourceMappingURL=index.js.map