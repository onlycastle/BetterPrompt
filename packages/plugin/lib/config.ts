/**
 * Plugin Configuration
 *
 * Reads configuration from environment variables (set by Claude Code
 * from plugin.json configuration schema).
 *
 * Environment variable mapping (Claude Code convention):
 *   plugin.json key  → env var
 *   serverUrl        → BETTERPROMPT_SERVER_URL
 *   authToken        → BETTERPROMPT_AUTH_TOKEN
 *   autoAnalyze      → BETTERPROMPT_AUTO_ANALYZE
 *   analyzeThreshold → BETTERPROMPT_ANALYZE_THRESHOLD
 */

import { join } from 'node:path';
import { homedir } from 'node:os';

export interface PluginConfig {
  serverUrl: string;
  authToken: string;
  autoAnalyze: boolean;
  analyzeThreshold: number;
}

const DEFAULTS: PluginConfig = {
  serverUrl: 'http://localhost:3000',
  authToken: '',
  autoAnalyze: true,
  analyzeThreshold: 5,
};

let cachedConfig: PluginConfig | null = null;

export function getConfig(): PluginConfig {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    serverUrl: (
      process.env.BETTERPROMPT_SERVER_URL ??
      process.env.BETTERPROMPT_API_URL ??
      DEFAULTS.serverUrl
    ).replace(/\/$/, ''),

    authToken:
      process.env.BETTERPROMPT_AUTH_TOKEN ??
      process.env.BETTERPROMPT_AUTH_TOKEN ??
      DEFAULTS.authToken,

    autoAnalyze:
      process.env.BETTERPROMPT_AUTO_ANALYZE !== 'false',

    analyzeThreshold: Number.parseInt(
      process.env.BETTERPROMPT_ANALYZE_THRESHOLD ?? '',
      10,
    ) || DEFAULTS.analyzeThreshold,
  };

  return cachedConfig;
}

/** Reset cached config (for testing) */
export function resetConfig(): void {
  cachedConfig = null;
}

/** Base directory for plugin state files */
export function getPluginDataDir(): string {
  return join(homedir(), '.betterprompt');
}

/** Path to the plugin state file (debounce tracking) */
export function getStateFilePath(): string {
  return join(getPluginDataDir(), 'plugin-state.json');
}

/** Path to the insight cache database */
export function getCacheDbPath(): string {
  return join(getPluginDataDir(), 'insight-cache.db');
}

/** Path to the error log */
export function getErrorLogPath(): string {
  return join(getPluginDataDir(), 'plugin-errors.log');
}
