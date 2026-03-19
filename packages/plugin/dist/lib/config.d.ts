/**
 * Plugin Configuration
 *
 * Claude Code injects plugin.json settings into the plugin runtime.
 * BetterPrompt treats these as plugin settings, not as a user-facing
 * environment-variable configuration surface.
 */
export interface PluginConfig {
    serverUrl: string;
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
