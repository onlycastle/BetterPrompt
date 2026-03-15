/**
 * generate_report MCP Tool
 *
 * Generates a standalone HTML report from analysis results
 * and serves it on a local HTTP server.
 */
export declare const definition: {
    name: string;
    description: string;
};
export declare const inputSchema: {
    port: {
        type: "number";
        description: string;
    };
    openBrowser: {
        type: "boolean";
        description: string;
    };
};
export declare function execute(args: {
    port?: number;
    openBrowser?: boolean;
}): Promise<string>;
