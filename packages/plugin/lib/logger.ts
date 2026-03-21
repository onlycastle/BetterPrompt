/**
 * Debug Logger
 *
 * Logging utility for the BetterPrompt plugin.
 * Writes to both stderr and ~/.betterprompt/debug.log.
 * Stderr output is gated by BETTERPROMPT_DEBUG=1;
 * the log file always receives all messages.
 *
 * Output format: [bp:<tag>] <message> {optional JSON}\n
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const stderrEnabled = process.env.BETTERPROMPT_DEBUG === '1';

const logDir = join(homedir(), '.betterprompt');
const logPath = join(logDir, 'debug.log');

let dirEnsured = false;

function ensureLogDir(): void {
  if (dirEnsured) return;
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // best-effort
  }
  dirEnsured = true;
}

function format(tag: string, msg: string, data?: Record<string, unknown>): string {
  const suffix = data ? ` ${JSON.stringify(data)}` : '';
  return `[bp:${tag}] ${msg}${suffix}\n`;
}

function writeToFile(line: string): void {
  ensureLogDir();
  try {
    const timestamped = `${new Date().toISOString()} ${line}`;
    appendFileSync(logPath, timestamped);
  } catch {
    // best-effort — never crash the plugin for logging
  }
}

/** Debug-level log — file always, stderr only when BETTERPROMPT_DEBUG=1. */
export function debug(tag: string, msg: string, data?: Record<string, unknown>): void {
  const line = format(tag, msg, data);
  writeToFile(line);
  if (stderrEnabled) process.stderr.write(line);
}

/** Info-level log — always emits to both file and stderr. */
export function info(tag: string, msg: string, data?: Record<string, unknown>): void {
  const line = format(tag, msg, data);
  writeToFile(line);
  process.stderr.write(line);
}

/** Error-level log — always emits to both file and stderr. */
export function error(tag: string, msg: string, data?: Record<string, unknown>): void {
  const line = format(tag, msg, data);
  writeToFile(line);
  process.stderr.write(line);
}
