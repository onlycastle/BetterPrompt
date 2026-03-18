/**
 * get_prompt_context MCP Tool
 *
 * Returns stage- or domain-specific prompt payloads derived from the current
 * canonical analysis run so skills do not need to reread raw Phase 1 files.
 *
 * @module plugin/mcp/tools/get-prompt-context
 */
import { z } from 'zod';
import { PROMPT_CONTEXT_KINDS } from '../../lib/prompt-context.js';
export declare const definition: {
    name: string;
    description: string;
};
export declare const GetPromptContextInputSchema: z.ZodObject<{
    kind: z.ZodEnum<{
        sessionSummaries: "sessionSummaries";
        projectSummaries: "projectSummaries";
        weeklyInsights: "weeklyInsights";
        typeClassification: "typeClassification";
        evidenceVerification: "evidenceVerification";
        contentWriter: "contentWriter";
        translation: "translation";
        domainAnalysis: "domainAnalysis";
    }>;
    domain: z.ZodOptional<z.ZodEnum<{
        thinkingQuality: "thinkingQuality";
        communicationPatterns: "communicationPatterns";
        learningBehavior: "learningBehavior";
        contextEfficiency: "contextEfficiency";
        sessionOutcome: "sessionOutcome";
    }>>;
}, z.core.$strip>;
export declare function execute(args: {
    kind: typeof PROMPT_CONTEXT_KINDS[number];
    domain?: string;
}): Promise<string>;
