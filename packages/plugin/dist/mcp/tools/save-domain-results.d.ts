/**
 * save_domain_results MCP Tool
 *
 * Accepts structured analysis results for a specific domain.
 * Validates the input against shared schemas (including domain-specific
 * typed data) and stores it in the results database.
 *
 * Called by domain analysis skills after the host LLM completes analysis.
 */
import { z } from 'zod';
export declare const definition: {
    name: string;
    description: string;
};
export declare const EvidenceSchema: z.ZodObject<{
    utteranceId: z.ZodString;
    quote: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const StrengthSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
        utteranceId: z.ZodString;
        quote: z.ZodString;
        context: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const GrowthAreaSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    severity: z.ZodEnum<{
        critical: "critical";
        high: "high";
        medium: "medium";
        low: "low";
    }>;
    recommendation: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
        utteranceId: z.ZodString;
        quote: z.ZodString;
        context: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const DomainResultInputSchema: z.ZodObject<{
    domain: z.ZodEnum<{
        content: "content";
        contextEfficiency: "contextEfficiency";
        sessionOutcome: "sessionOutcome";
        thinkingQuality: "thinkingQuality";
        learningBehavior: "learningBehavior";
        communicationPatterns: "communicationPatterns";
    }>;
    overallScore: z.ZodNumber;
    confidenceScore: z.ZodOptional<z.ZodNumber>;
    strengths: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
            utteranceId: z.ZodString;
            quote: z.ZodString;
            context: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    growthAreas: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        severity: z.ZodEnum<{
            critical: "critical";
            high: "high";
            medium: "medium";
            low: "low";
        }>;
        recommendation: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
            utteranceId: z.ZodString;
            quote: z.ZodString;
            context: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare function execute(args: Record<string, unknown>): Promise<string>;
