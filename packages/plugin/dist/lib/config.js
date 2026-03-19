/**
 * Plugin Configuration
 *
 * Claude Code injects plugin.json settings into the plugin runtime.
 * BetterPrompt treats these as plugin settings, not as a user-facing
 * environment-variable configuration surface.
 */
import { join } from 'node:path';
import { getPluginDataDir as resolvePluginDataDir } from './core/session-scanner.js';
const DEFAULTS = {
    serverUrl: 'http://localhost:3000',
    autoAnalyze: true,
    analyzeThreshold: 5,
};
let cachedConfig = null;
export function getConfig() {
    if (cachedConfig)
        return cachedConfig;
    cachedConfig = {
        serverUrl: (process.env.BETTERPROMPT_SERVER_URL ?? DEFAULTS.serverUrl).replace(/\/$/, ''),
        autoAnalyze: process.env.BETTERPROMPT_AUTO_ANALYZE !== 'false',
        analyzeThreshold: Number.parseInt(process.env.BETTERPROMPT_ANALYZE_THRESHOLD ?? '', 10) || DEFAULTS.analyzeThreshold,
    };
    return cachedConfig;
}
/** Reset cached config (for testing) */
export function resetConfig() {
    cachedConfig = null;
}
/** Base directory for plugin state files */
export function getPluginDataDir() {
    return resolvePluginDataDir();
}
/** Path to the plugin state file (debounce tracking) */
export function getStateFilePath() {
    return join(getPluginDataDir(), 'plugin-state.json');
}
/** Path to the insight cache database */
export function getCacheDbPath() {
    return join(getPluginDataDir(), 'insight-cache.db');
}
/** Path to the error log */
export function getErrorLogPath() {
    return join(getPluginDataDir(), 'plugin-errors.log');
}
//# sourceMappingURL=config.js.map