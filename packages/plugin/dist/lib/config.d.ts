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
export interface PluginConfig {
    serverUrl: string;
    authToken: string;
    autoAnalyze: boolean;
    analyzeThreshold: number;
}
export declare function getConfig(): PluginConfig;
/** Reset cached config (for testing) */
export declare function resetConfig(): void;
/** Base directory for plugin state files */
export declare function getPluginDataDir(): string;
/** Path to the plugin state file (debounce tracking) */
export declare function getStateFilePath(): string;
/** Path to the insight cache database */
export declare function getCacheDbPath(): string;
/** Path to the error log */
export declare function getErrorLogPath(): string;
