/**
 * save_domain_results MCP Tool
 *
 * Accepts structured analysis results for a specific domain.
 * Validates the input and stores it in the results database.
 *
 * Called by domain analysis skills after the host LLM completes analysis.
 */
export declare const definition: {
    name: string;
    description: string;
};
export declare const inputSchema: {
    domain: {
        type: "string";
        description: string;
        enum: string[];
    };
    overallScore: {
        type: "number";
        description: string;
    };
    confidenceScore: {
        type: "number";
        description: string;
    };
    strengths: {
        type: "array";
        description: string;
    };
    growthAreas: {
        type: "array";
        description: string;
    };
    data: {
        type: "object";
        description: string;
    };
};
export declare function execute(args: Record<string, unknown>): Promise<string>;
