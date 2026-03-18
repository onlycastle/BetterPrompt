/**
 * get_stage_output MCP Tool
 *
 * Reads a previously saved pipeline stage output from the local DB.
 * Used by downstream skills to access results from earlier stages
 * (e.g., project summarizer reads session summaries from Phase 1.5).
 *
 * @module plugin/mcp/tools/get-stage-output
 */
export declare const definition: {
    name: string;
    description: string;
};
export declare function execute(args: {
    stage?: string;
}): Promise<string>;
