/**
 * Debug Logger
 *
 * Environment-gated logging utility for the BetterPrompt plugin.
 * All output goes to stderr (stdout is reserved for JSON-RPC).
 *
 * Enable with: BETTERPROMPT_DEBUG=1
 *
 * Output format: [bp:<tag>] <message> {optional JSON}\n
 */

const enabled = process.env.BETTERPROMPT_DEBUG === '1';

function write(tag: string, msg: string, data?: Record<string, unknown>): void {
  const suffix = data ? ` ${JSON.stringify(data)}` : '';
  process.stderr.write(`[bp:${tag}] ${msg}${suffix}\n`);
}

/** Debug-level log — no-op when BETTERPROMPT_DEBUG is not set. */
export function debug(tag: string, msg: string, data?: Record<string, unknown>): void {
  if (!enabled) return;
  write(tag, msg, data);
}

/** Info-level log — always emits (lifecycle events, install status). */
export function info(tag: string, msg: string, data?: Record<string, unknown>): void {
  write(tag, msg, data);
}

/** Error-level log — always emits regardless of BETTERPROMPT_DEBUG. */
export function error(tag: string, msg: string, data?: Record<string, unknown>): void {
  write(tag, msg, data);
}
