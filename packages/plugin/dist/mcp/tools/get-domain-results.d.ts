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
        thinkingQuality: "thinkingQuality";
        communicationPatterns: "communicationPatterns";
        learningBehavior: "learningBehavior";
        contextEfficiency: "contextEfficiency";
        sessionOutcome: "sessionOutcome";
    }>>;
}, z.core.$strip>;
export declare function execute(args: {
    domain?: string;
}): Promise<string>;
