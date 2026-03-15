/**
 * sync_to_team MCP Tool
 *
 * Sends analysis results to a team server (self-hosted or cloud).
 * Optional tool — only works when BETTERPROMPT_SERVER_URL is configured.
 */
export declare const definition: {
    name: string;
    description: string;
};
export declare const inputSchema: {
    serverUrl: {
        type: "string";
        description: string;
    };
};
export declare function execute(args: {
    serverUrl?: string;
}): Promise<string>;
