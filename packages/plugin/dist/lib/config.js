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
const DEFAULTS = {
    serverUrl: 'http://localhost:3000',
    authToken: '',
    autoAnalyze: true,
    analyzeThreshold: 5,
};
let cachedConfig = null;
export function getConfig() {
    if (cachedConfig)
        return cachedConfig;
    cachedConfig = {
        serverUrl: (process.env.BETTERPROMPT_SERVER_URL ??
            process.env.BETTERPROMPT_API_URL ??
            DEFAULTS.serverUrl).replace(/\/$/, ''),
        authToken: process.env.BETTERPROMPT_AUTH_TOKEN ??
            process.env.BETTERPROMPT_TOKEN ??
            DEFAULTS.authToken,
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
    return join(homedir(), '.betterprompt');
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