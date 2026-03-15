/**
 * scan_sessions MCP Tool
 *
 * Scans ~/.claude/projects/ for JSONL session logs.
 * Returns session metadata (count, date range, total messages).
 * Stores session list in scan cache for subsequent tools.
 */
export declare const definition: {
    name: string;
    description: string;
};
export declare const inputSchema: {};
export declare function execute(_args: Record<string, unknown>): Promise<string>;
