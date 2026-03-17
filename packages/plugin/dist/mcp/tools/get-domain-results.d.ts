/**
 * get_domain_results MCP Tool
 *
 * Reads previously saved domain analysis results from the local DB.
 * Used by downstream skills that need the full domain payloads
 * (evidence verification, content writer, translator).
 *
 * @module plugin/mcp/tools/get-domain-results
 */
import { z } from 'zod';
export declare const definition: {
    name: string;
    description: string;
};
export declare const GetDomainResultsInputSchema: z.ZodObject<{
    domain: z.ZodOptional<z.ZodEnum<{
        content: "content";
        contextEfficiency: "contextEfficiency";
        sessionOutcome: "sessionOutcome";
        thinkingQuality: "thinkingQuality";
        learningBehavior: "learningBehavior";
        communicationPatterns: "communicationPatterns";
    }>>;
}, z.core.$strip>;
export declare function execute(args: {
    domain?: string;
}): Promise<string>;
