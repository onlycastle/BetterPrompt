#!/usr/bin/env node

/**
 * BetterPrompt CLI
 *
 * Lightweight CLI that replaces the MCP server. Each subcommand wraps
 * the same lib/ functions the MCP tools used, with identical validation
 * and persistence logic.
 *
 * Usage: node dist/cli/index.js <command> [options]
 *
 * Output convention:
 * - Small results: JSON printed to stdout
 * - Large results: written to ~/.betterprompt/tmp/<name>.json,
 *   stdout contains { status: "ok", outputFile: "<path>" }
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureNativeDeps } from '../lib/native-deps.js';

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
ensureNativeDeps({ pluginRoot, fatal: true });

const COMMANDS: Record<string, () => Promise<{ execute: (args: Record<string, unknown>) => Promise<string> }>> = {
  'scan-sessions':          () => import('./commands/scan-sessions.js'),
  'extract-data':           () => import('./commands/extract-data.js'),
  'get-prompt-context':     () => import('./commands/get-prompt-context.js'),
  'save-stage-output':      () => import('./commands/save-stage-output.js'),
  'get-stage-output':       () => import('./commands/get-stage-output.js'),
  'save-domain-results':    () => import('./commands/save-domain-results.js'),
  'get-domain-results':     () => import('./commands/get-domain-results.js'),
  'get-run-progress':       () => import('./commands/get-run-progress.js'),
  'classify-developer-type': () => import('./commands/classify-developer-type.js'),
  'verify-evidence':        () => import('./commands/verify-evidence.js'),
  'generate-report':        () => import('./commands/generate-report.js'),
  'sync-to-team':           () => import('./commands/sync-to-team.js'),
  'get-user-prefs':         () => import('./commands/get-user-prefs.js'),
  'save-user-prefs':        () => import('./commands/save-user-prefs.js'),
};

/** Convert kebab-case to camelCase: "include-projects" → "includeProjects" */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseArgs(argv: string[]): { command: string; args: Record<string, unknown> } {
  const [command, ...rest] = argv;
  const args: Record<string, unknown> = {};

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!;
    if (token.startsWith('--')) {
      const key = toCamelCase(token.slice(2));
      const next = rest[i + 1];

      // Boolean flag (no value or next token is also a flag)
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
        continue;
      }

      // Try to parse as JSON (for objects/arrays/numbers/booleans)
      try {
        args[key] = JSON.parse(next);
      } catch {
        args[key] = next;
      }
      i++;
    }
  }

  return { command: command ?? '', args };
}

async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv.slice(2));

  if (!command || command === 'help') {
    const commands = Object.keys(COMMANDS).sort().join('\n  ');
    console.log(`BetterPrompt CLI\n\nUsage: betterprompt-cli <command> [--arg value ...]\n\nCommands:\n  ${commands}`);
    process.exit(0);
  }

  const loader = COMMANDS[command];
  if (!loader) {
    console.error(JSON.stringify({
      status: 'error',
      message: `Unknown command: ${command}. Run with "help" to see available commands.`,
    }));
    process.exit(1);
  }

  try {
    const mod = await loader();
    const result = await mod.execute(args);
    console.log(result);
  } catch (error) {
    console.error(JSON.stringify({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }));
    process.exit(1);
  }
}

main();
