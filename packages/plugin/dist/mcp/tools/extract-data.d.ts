/**
 * extract_data MCP Tool
 *
 * Runs deterministic Phase 1 extraction:
 * 1. Reads parsed sessions from scan cache
 * 2. Extracts developer utterances with structural metadata
 * 3. Computes session metrics (friction, context fill, etc.)
 * 4. Runs DeterministicScorer (rubric-based scoring)
 * 5. Stores Phase1Output in ~/.betterprompt/phase1-output.json
 * 6. Creates an analysis run in the results database
 *
 * Returns summary metrics for the orchestrator.
 */
export declare const definition: {
    name: string;
    description: string;
};
export declare const inputSchema: {
    maxSessions: {
        type: "number";
        description: string;
    };
};
export declare function execute(args: {
    maxSessions?: number;
}): Promise<string>;
