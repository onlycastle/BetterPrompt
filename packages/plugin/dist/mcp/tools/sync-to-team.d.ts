/**
 * sync_to_team MCP Tool
 *
 * Sends analysis results to a team server (self-hosted or cloud).
 * Optional tool — uses the configured plugin server URL unless overridden.
 */
export declare const definition: {
    name: string;
    description: string;
};
export declare function execute(args: {
    serverUrl?: string;
}): Promise<string>;
