/**
 * Plugin Configuration
 *
 * Claude Code injects plugin.json settings into the plugin runtime.
 * BetterPrompt treats these as plugin settings, not as a user-facing
 * environment-variable configuration surface.
 */

import { join } from 'node:path';
import { getPluginDataDir as resolvePluginDataDir } from './core/session-scanner.js';

export interface PluginConfig {
  serverUrl: string;
  autoAnalyze: boolean;
  analyzeThreshold: number;
}

const DEFAULTS: PluginConfig = {
  serverUrl: 'http://localhost:3000',
  autoAnalyze: true,
  analyzeThreshold: 5,
};

let cachedConfig: PluginConfig | null = null;

export function getConfig(): PluginConfig {
  if (cachedConfig) return cachedConfig;

  cachedConfig = {
    serverUrl: (process.env.BETTERPROMPT_SERVER_URL ?? DEFAULTS.serverUrl).replace(/\/$/, ''),

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
  return resolvePluginDataDir();
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
