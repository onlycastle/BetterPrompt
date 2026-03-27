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
  "scan-sessions": () => import("../scan-sessions-C7ZTXOWT.js"),
  "extract-data": () => import("../extract-data-SA3L25BI.js"),
  "get-prompt-context": () => import("../get-prompt-context-RPLLOGSK.js"),
  "save-stage-output": () => import("../save-stage-output-D2ZQMBHP.js"),
  "get-stage-output": () => import("../get-stage-output-RZT4A4FD.js"),
  "save-domain-results": () => import("../save-domain-results-MGOM6TKS.js"),
  "get-domain-results": () => import("../get-domain-results-AJSUPVA2.js"),
  "get-run-progress": () => import("../get-run-progress-O6LL2U2R.js"),
  "classify-developer-type": () => import("../classify-developer-type-XXBUUHDB.js"),
  "verify-evidence": () => import("../verify-evidence-XTM6E7ST.js"),
  "generate-report": () => import("../generate-report-LCHULA3Z.js"),
  "sync-to-team": () => import("../sync-to-team-TJFZJDZM.js"),
  "get-user-prefs": () => import("../get-user-prefs-Z4HGQUNP.js"),
  "save-user-prefs": () => import("../save-user-prefs-TSPPMLMV.js")
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