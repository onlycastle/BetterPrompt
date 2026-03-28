#!/usr/bin/env node
import {
  debug
} from "../chunk-FW6ZW4J3.js";
import "../chunk-NSBPE2FW.js";

// hooks/pre-tool-use-handler.ts
import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
function readHookInput(raw) {
  try {
    const payload = raw ?? readFileSync(0, "utf-8").trim();
    return payload ? JSON.parse(payload) : {};
  } catch {
    return {};
  }
}
function resolvePluginCliPath() {
  const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  return resolve(pluginRoot, "dist", "cli", "index.js");
}
function expandHomePath(filePath) {
  if (filePath.startsWith("~/")) {
    return join(homedir(), filePath.slice(2));
  }
  return filePath;
}
function isBetterPromptCliCommand(command, cliPath) {
  return command.includes(cliPath);
}
function isBetterPromptTmpWrite(filePath) {
  const expanded = expandHomePath(filePath);
  const bpTmpDir = join(homedir(), ".betterprompt", "tmp");
  return expanded.startsWith(bpTmpDir);
}
function isBetterPromptRead(filePath) {
  const expanded = expandHomePath(filePath);
  const bpDir = join(homedir(), ".betterprompt");
  return expanded.startsWith(bpDir);
}
function handlePreToolUse(input, cliPath) {
  const toolName = input.tool_name;
  const toolInput = input.tool_input;
  if (!toolName || !toolInput) {
    return null;
  }
  const resolvedCliPath = cliPath ?? resolvePluginCliPath();
  if (toolName === "Bash" && typeof toolInput.command === "string") {
    if (isBetterPromptCliCommand(toolInput.command, resolvedCliPath)) {
      debug("hook", "pre-tool-use: approved Bash CLI command");
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: "BetterPrompt CLI command"
        }
      };
    }
  }
  if (toolName === "Write" && typeof toolInput.file_path === "string") {
    if (isBetterPromptTmpWrite(toolInput.file_path)) {
      debug("hook", "pre-tool-use: approved Write to plugin tmp dir");
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: "BetterPrompt plugin data write"
        }
      };
    }
  }
  if (toolName === "Read" && typeof toolInput.file_path === "string") {
    if (isBetterPromptRead(toolInput.file_path)) {
      debug("hook", "pre-tool-use: approved Read from plugin data dir");
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "allow",
          permissionDecisionReason: "BetterPrompt plugin data read"
        }
      };
    }
  }
  return null;
}
function main() {
  const output = handlePreToolUse(readHookInput());
  if (!output) {
    process.exit(0);
  }
  process.stdout.write(JSON.stringify(output));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
export {
  handlePreToolUse,
  readHookInput
};
//# sourceMappingURL=pre-tool-use-handler.js.map