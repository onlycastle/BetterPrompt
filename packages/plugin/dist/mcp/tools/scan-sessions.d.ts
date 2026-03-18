/**
 * scan_sessions MCP Tool
 *
 * Scans all supported local session sources and caches fully parsed sessions.
 * Returns session metadata (count, date range, total messages).
 */
export declare const definition: {
    name: string;
    description: string;
};
export declare function execute(_args: Record<string, unknown>): Promise<string>;
