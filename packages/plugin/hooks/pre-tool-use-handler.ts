#!/usr/bin/env node

/**
 * PreToolUse Hook Handler
 *
 * Auto-approves BetterPrompt CLI commands and plugin data file operations
 * so the analysis pipeline runs without constant permission prompts.
 *
 * Matching patterns:
 * - Bash: commands invoking the plugin's own CLI (dist/cli/index.js)
 * - Write: files under ~/.betterprompt/tmp/
 * - Read: files under ~/.betterprompt/
 *
 * Non-matching tool calls pass through silently (normal permission flow).
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { debug } from '../lib/logger.js';

export interface PreToolUseHookInput {
  tool_name?: string;
  tool_input?: {
    command?: string;
    file_path?: string;
    [key: string]: unknown;
  };
}

export interface PreToolUseHookOutput {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse';
    permissionDecision: 'allow';
    permissionDecisionReason: string;
  };
}

export function readHookInput(raw?: string): PreToolUseHookInput {
  try {
    const payload = raw ?? readFileSync(0, 'utf-8').trim();
    return payload ? (JSON.parse(payload) as PreToolUseHookInput) : {};
  } catch {
    return {};
  }
}

function resolvePluginCliPath(): string {
  const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  return resolve(pluginRoot, 'dist', 'cli', 'index.js');
}

function expandHomePath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return join(homedir(), filePath.slice(2));
  }
  return filePath;
}

function isBetterPromptCliCommand(command: string, cliPath: string): boolean {
  // Match only the fully resolved absolute CLI path to avoid approving
  // unrelated commands that happen to contain a similar relative path.
  return command.includes(cliPath);
}

function isBetterPromptTmpWrite(filePath: string): boolean {
  const expanded = expandHomePath(filePath);
  const bpTmpDir = join(homedir(), '.betterprompt', 'tmp');
  return expanded.startsWith(bpTmpDir);
}

function isBetterPromptRead(filePath: string): boolean {
  const expanded = expandHomePath(filePath);
  const bpDir = join(homedir(), '.betterprompt');
  return expanded.startsWith(bpDir);
}

export function handlePreToolUse(
  input: PreToolUseHookInput,
  cliPath?: string,
): PreToolUseHookOutput | null {
  const toolName = input.tool_name;
  const toolInput = input.tool_input;

  if (!toolName || !toolInput) {
    return null;
  }

  const resolvedCliPath = cliPath ?? resolvePluginCliPath();

  if (toolName === 'Bash' && typeof toolInput.command === 'string') {
    if (isBetterPromptCliCommand(toolInput.command, resolvedCliPath)) {
      debug('hook', 'pre-tool-use: approved Bash CLI command');
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: 'BetterPrompt CLI command',
        },
      };
    }
  }

  if (toolName === 'Write' && typeof toolInput.file_path === 'string') {
    if (isBetterPromptTmpWrite(toolInput.file_path)) {
      debug('hook', 'pre-tool-use: approved Write to plugin tmp dir');
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: 'BetterPrompt plugin data write',
        },
      };
    }
  }

  if (toolName === 'Read' && typeof toolInput.file_path === 'string') {
    if (isBetterPromptRead(toolInput.file_path)) {
      debug('hook', 'pre-tool-use: approved Read from plugin data dir');
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          permissionDecisionReason: 'BetterPrompt plugin data read',
        },
      };
    }
  }

  return null;
}

function main(): void {
  const output = handlePreToolUse(readHookInput());
  if (!output) {
    process.exit(0);
  }

  process.stdout.write(JSON.stringify(output));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
