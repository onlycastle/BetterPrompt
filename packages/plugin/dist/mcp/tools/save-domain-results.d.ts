/**
 * save_domain_results MCP Tool
 *
 * Accepts structured analysis results for a specific domain.
 * Validates the input and stores it in the results database.
 *
 * Called by domain analysis skills after the host LLM completes analysis.
 */
import { z } from 'zod';
export declare const definition: {
    name: string;
    description: string;
};
/** Zod schema for validating domain result input (also used by server.ts MCP registration) */
export declare const EvidenceSchema: z.ZodObject<{
    utteranceId: z.ZodString;
    quote: z.ZodString;
    context: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    utteranceId: string;
    quote: string;
    context?: string | undefined;
}, {
    utteranceId: string;
    quote: string;
    context?: string | undefined;
}>;
export declare const StrengthSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
        utteranceId: z.ZodString;
        quote: z.ZodString;
        context: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        utteranceId: string;
        quote: string;
        context?: string | undefined;
    }, {
        utteranceId: string;
        quote: string;
        context?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    evidence: {
        utteranceId: string;
        quote: string;
        context?: string | undefined;
    }[];
}, {
    title: string;
    description: string;
    evidence: {
        utteranceId: string;
        quote: string;
        context?: string | undefined;
    }[];
}>;
export declare const GrowthAreaSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    severity: z.ZodEnum<["low", "medium", "high"]>;
    recommendation: z.ZodString;
    evidence: z.ZodArray<z.ZodObject<{
        utteranceId: z.ZodString;
        quote: z.ZodString;
        context: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        utteranceId: string;
        quote: string;
        context?: string | undefined;
    }, {
        utteranceId: string;
        quote: string;
        context?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    evidence: {
        utteranceId: string;
        quote: string;
        context?: string | undefined;
    }[];
    severity: "low" | "medium" | "high";
    recommendation: string;
}, {
    title: string;
    description: string;
    evidence: {
        utteranceId: string;
        quote: string;
        context?: string | undefined;
    }[];
    severity: "low" | "medium" | "high";
    recommendation: string;
}>;
export declare const DomainResultInputSchema: z.ZodObject<{
    domain: z.ZodEnum<["thinkingQuality", "communicationPatterns", "learningBehavior", "contextEfficiency", "sessionOutcome", "content"]>;
    overallScore: z.ZodNumber;
    confidenceScore: z.ZodOptional<z.ZodNumber>;
    strengths: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
            utteranceId: z.ZodString;
            quote: z.ZodString;
            context: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            utteranceId: string;
            quote: string;
            context?: string | undefined;
        }, {
            utteranceId: string;
            quote: string;
            context?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description: string;
        evidence: {
            utteranceId: string;
            quote: string;
            context?: string | undefined;
        }[];
    }, {
        title: string;
        description: string;
        evidence: {
            utteranceId: string;
            quote: string;
            context?: string | undefined;
        }[];
    }>, "many">;
    growthAreas: z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        severity: z.ZodEnum<["low", "medium", "high"]>;
        recommendation: z.ZodString;
        evidence: z.ZodArray<z.ZodObject<{
            utteranceId: z.ZodString;
            quote: z.ZodString;
            context: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            utteranceId: string;
            quote: string;
            context?: string | undefined;
        }, {
            utteranceId: string;
            quote: string;
            context?: string | undefined;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description: string;
        evidence: {
            utteranceId: string;
            quote: string;
            context?: string | undefined;
        }[];
        severity: "low" | "medium" | "high";
        recommendation: string;
    }, {
        title: string;
        description: string;
        evidence: {
            utteranceId: string;
            quote: string;
            context?: string | undefined;
        }[];
        severity: "low" | "medium" | "high";
        recommendation: string;
    }>, "many">;
    data: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    growthAreas: {
        title: string;
        description: string;
        evidence: {
            utteranceId: string;
            quote: string;
            context?: string | undefined;
        }[];
        severity: "low" | "medium" | "high";
        recommendation: string;
    }[];
    strengths: {
        title: string;
        description: string;
        evidence: {
            utteranceId: string;
            quote: string;
            context?: string | undefined;
        }[];
    }[];
    domain: "content" | "thinkingQuality" | "communicationPatterns" | "learningBehavior" | "contextEfficiency" | "sessionOutcome";
    overallScore: number;
    confidenceScore?: number | undefined;
    data?: Record<string, unknown> | undefined;
}, {
    growthAreas: {
        title: string;
        description: string;
        evidence: {
            utteranceId: string;
            quote: string;
            context?: string | undefined;
        }[];
        severity: "low" | "medium" | "high";
        recommendation: string;
    }[];
    strengths: {
        title: string;
        description: string;
        evidence: {
            utteranceId: string;
            quote: string;
            context?: string | undefined;
        }[];
    }[];
    domain: "content" | "thinkingQuality" | "communicationPatterns" | "learningBehavior" | "contextEfficiency" | "sessionOutcome";
    overallScore: number;
    confidenceScore?: number | undefined;
    data?: Record<string, unknown> | undefined;
}>;
export declare function execute(args: Record<string, unknown>): Promise<string>;
