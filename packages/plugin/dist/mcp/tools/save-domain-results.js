/**
 * save_domain_results MCP Tool
 *
 * Accepts structured analysis results for a specific domain.
 * Validates the input and stores it in the results database.
 *
 * Called by domain analysis skills after the host LLM completes analysis.
 */
import { z } from 'zod';
import { saveDomainResult, getCurrentRunId } from '../../lib/results-db.js';
export const definition = {
    name: 'save_domain_results',
    description: 'Save structured analysis results for a specific domain. ' +
        'Called after analyzing a domain (thinkingQuality, communicationPatterns, ' +
        'learningBehavior, contextEfficiency, sessionOutcome, or content). ' +
        'Input must include domain name, overall score, strengths, and growth areas.',
};
/** Zod schema for validating domain result input (also used by server.ts MCP registration) */
export const EvidenceSchema = z.object({
    utteranceId: z.string(),
    quote: z.string(),
    context: z.string().optional(),
});
export const StrengthSchema = z.object({
    title: z.string(),
    description: z.string().min(100),
    evidence: z.array(EvidenceSchema).min(1),
});
export const GrowthAreaSchema = z.object({
    title: z.string(),
    description: z.string().min(100),
    severity: z.enum(['low', 'medium', 'high']),
    recommendation: z.string().min(50),
    evidence: z.array(EvidenceSchema).min(1),
});
export const DomainResultInputSchema = z.object({
    domain: z.enum([
        'thinkingQuality',
        'communicationPatterns',
        'learningBehavior',
        'contextEfficiency',
        'sessionOutcome',
        'content',
    ]),
    overallScore: z.number().min(0).max(100),
    confidenceScore: z.number().min(0).max(1).optional(),
    strengths: z.array(StrengthSchema),
    growthAreas: z.array(GrowthAreaSchema),
    data: z.record(z.string(), z.unknown()).optional(),
});
export async function execute(args) {
    // Get current run ID
    const runId = getCurrentRunId();
    if (!runId) {
        return JSON.stringify({
            status: 'error',
            message: 'No active analysis run. Call extract_data first to start an analysis.',
        });
    }
    // Validate input
    const parsed = DomainResultInputSchema.safeParse(args);
    if (!parsed.success) {
        return JSON.stringify({
            status: 'validation_error',
            message: 'Invalid domain result format.',
            errors: parsed.error.issues.map(i => ({
                path: i.path.join('.'),
                message: i.message,
            })),
        });
    }
    const domainResult = {
        domain: parsed.data.domain,
        overallScore: parsed.data.overallScore,
        confidenceScore: parsed.data.confidenceScore ?? 0.5,
        strengths: parsed.data.strengths,
        growthAreas: parsed.data.growthAreas,
        data: parsed.data.data,
        analyzedAt: new Date().toISOString(),
    };
    // Save to database
    saveDomainResult(runId, domainResult);
    return JSON.stringify({
        status: 'ok',
        domain: domainResult.domain,
        score: domainResult.overallScore,
        strengthCount: domainResult.strengths.length,
        growthAreaCount: domainResult.growthAreas.length,
        runId,
        message: `Saved ${domainResult.domain} analysis (score: ${domainResult.overallScore}/100) to run #${runId}.`,
    });
}
//# sourceMappingURL=save-domain-results.js.map