/**
 * Evidence Verifier Prompts - LLM prompts for Phase 2.8 evidence verification
 *
 * Uses PTCF framework (Persona · Task · Context · Format) for structured prompts.
 * Evaluates whether worker-selected evidence actually supports the claimed insights.
 *
 * @module analyzer/stages/evidence-verifier-prompts
 */

import type { EvidenceVerificationPair } from '../../models/evidence-verification-data';

// ============================================================================
// System Prompt
// ============================================================================

/**
 * System prompt for evidence relevance verification.
 *
 * The verifier acts as a strict quality control layer, ensuring that
 * evidence quotes genuinely support their associated insights.
 */
export const EVIDENCE_VERIFIER_SYSTEM_PROMPT = `You are an evidence quality verifier for developer behavior analysis.

## Persona
You are a rigorous evidence evaluator who ensures that quoted developer messages genuinely support the insights they're paired with. You have deep expertise in developer-AI collaboration patterns and can distinguish between relevant and tangential evidence.

## Task
For each (insight, evidence) pair provided, determine if the evidence quote genuinely supports or demonstrates the insight being claimed. Be strict in your evaluation.

## Scoring Criteria (0-100)

| Score Range | Meaning | Example |
|------------|---------|---------|
| 80-100 | Evidence DIRECTLY demonstrates the insight | Insight: "Verifies AI output" → Quote: "Let me check if this code handles edge cases" |
| 60-79 | Evidence MODERATELY supports the insight | Insight: "Asks clarifying questions" → Quote: "Can you explain the API?" |
| 40-59 | Evidence has WEAK/TANGENTIAL connection | Insight: "Plans before coding" → Quote: "Let's do this step by step" (vague) |
| 20-39 | Evidence BARELY relates to the insight | Insight: "Tests code thoroughly" → Quote: "Run the build" |
| 0-19 | Evidence is IRRELEVANT or CONTRADICTS | Insight: "Verifies AI output" → Quote: "Save the file" |

## Important Guidelines

1. **Be Strict**: A generic quote like "save the file" does NOT support insights about verification, testing, or planning unless it shows explicit verification intent.

2. **Context Matters**: Consider what the quote reveals about the developer's behavior, not just keyword matching.

3. **Avoid False Positives**: Just because a quote contains relevant words doesn't mean it demonstrates the insight. Look for actual behavioral evidence.

4. **Consider the Full Insight**: Both title and description define what needs to be demonstrated.

## Format

Return a JSON object with a "results" array containing one verification result per input pair.`;

// ============================================================================
// User Prompt Builder
// ============================================================================

/**
 * Build the user prompt for evidence verification.
 *
 * Formats all (insight, evidence) pairs into a structured list for LLM evaluation.
 * Keeps the prompt concise to minimize token usage.
 *
 * @param pairs - Evidence pairs to verify
 * @returns Formatted user prompt string
 */
export function buildEvidenceVerifierUserPrompt(pairs: EvidenceVerificationPair[]): string {
  // Format pairs as a compact but readable structure
  const pairsData = pairs.map((pair) => ({
    pairId: pair.pairId,
    domain: pair.workerDomain,
    type: pair.insightType,
    insight: {
      title: pair.insightTitle,
      description: truncateText(pair.insightDescription, 200),
    },
    evidence: truncateText(pair.evidenceQuote, 300),
  }));

  return `Verify the relevance of each evidence quote to its paired insight.

## Evidence Pairs to Verify (${pairs.length} total)

${JSON.stringify(pairsData, null, 2)}

## Instructions

1. For each pair, evaluate how well the evidence supports the insight claim.
2. Assign a relevance score (0-100) based on the scoring criteria.
3. Provide brief reasoning (1-2 sentences) explaining your score.

Return your evaluation as a JSON object with a "results" array.`;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate text to a maximum length, adding ellipsis if truncated.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Estimate token count for a prompt (rough approximation).
 * Used to warn if batch size might exceed limits.
 */
export function estimatePromptTokens(pairs: EvidenceVerificationPair[]): number {
  const prompt = buildEvidenceVerifierUserPrompt(pairs);
  // Rough estimate: ~4 characters per token for mixed content
  return Math.ceil((EVIDENCE_VERIFIER_SYSTEM_PROMPT.length + prompt.length) / 4);
}

/**
 * Maximum recommended pairs per batch to stay within token limits.
 * Gemini Flash has a 1M token context, but we want to keep costs low.
 */
export const MAX_PAIRS_PER_BATCH = 100;

/**
 * Check if a batch should be split due to size.
 */
export function shouldSplitBatch(pairs: EvidenceVerificationPair[]): boolean {
  return pairs.length > MAX_PAIRS_PER_BATCH;
}
