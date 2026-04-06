/**
 * Worker Insights - Common types for Phase 2 Worker strengths/growthAreas output
 *
 * v3.1 Workers (2026-02):
 * - ThinkingQuality: Planning + Critical Thinking
 * - CommunicationPatterns: Communication patterns + Signature quotes
 * - LearningBehavior: Knowledge Gaps + Repeated Mistakes (redesigned)
 * - ContextEfficiency: Token efficiency patterns (retained)
 * - SessionOutcome: Goals, friction, success rates
 *
 * Each worker outputs domain-specific strengths and growth areas using shared types.
 * This decentralized approach allows workers to directly identify positive/negative
 * patterns within their capability domain.
 *
 * @module models/worker-insights
 */

import { z } from 'zod';

// ============================================================================
// Insight Evidence Schema (NEW - utterance-linked evidence)
// ============================================================================

/**
 * Structured evidence with utterance ID linking.
 *
 * This enables linking evidence quotes back to original developer utterances
 * for verification and detailed context display in the frontend.
 *
 * Format from LLM: "utteranceId:quote:context" parsed into this structure.
 */
export const InsightEvidenceSchema = z.object({
  /** Utterance ID from Phase 1 (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),

  /** Direct quote or paraphrase from the developer's message */
  quote: z.string(),

  /** Brief context description (optional) */
  context: z.string().optional(),

  /** Explicit session ID for multi-session evidence grouping (v2) */
  sessionId: z.string().optional(),

  /** What behavior the developer exhibited in this moment (v2) */
  behaviorDescription: z.string().optional(),
});
export type InsightEvidence = z.infer<typeof InsightEvidenceSchema>;

/**
 * Evidence can be either a simple string (legacy) or structured with utterance linking (new).
 * Union type enables backward compatibility with existing data.
 */
export const EvidenceItemSchema = z.union([
  z.string(),
  InsightEvidenceSchema,
]);
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

// ============================================================================
// Worker Strength Schema
// ============================================================================

/**
 * A strength identified by a Phase 2 Worker in its domain.
 *
 * Each worker identifies 1-4 strengths with supporting evidence.
 * Evidence quotes link back to Phase 1 utteranceIds for verification.
 */
export const WorkerStrengthSchema = z.object({
  /** Clear, specific title (e.g., "Systematic Output Verification") */
  title: z.string(),

  /** 6-10 sentences providing comprehensive analysis */
  description: z.string(),

  /**
   * Direct quotes from developer messages demonstrating this (2-8 items).
   * Can be simple strings (legacy) or structured with utterance linking (new).
   */
  evidence: z.array(EvidenceItemSchema).min(1).max(8),

  /** Truncated description preview for free tier blur teaser (set by ContentGateway) */
  descriptionPreview: z.string().optional(),
});
export type WorkerStrength = z.infer<typeof WorkerStrengthSchema>;

// ============================================================================
// Worker Growth Schema
// ============================================================================

/**
 * Severity level for growth areas.
 *
 * - critical: 70%+ occurrence or fundamental skill gap
 * - high: 40-70% occurrence or significant impact
 * - medium: 20-40% occurrence or moderate impact
 * - low: <20% occurrence or minor impact
 */
export const WorkerGrowthSeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type WorkerGrowthSeverity = z.infer<typeof WorkerGrowthSeveritySchema>;

/**
 * A growth area identified by a Phase 2 Worker in its domain.
 *
 * Each worker identifies 1-4 growth areas with supporting evidence
 * and actionable recommendations.
 */
export const WorkerGrowthSchema = z.object({
  /** Clear, specific title (e.g., "Error Loop Pattern") */
  title: z.string(),

  /** 6-10 sentences providing comprehensive analysis */
  description: z.string(),

  /**
   * Direct quotes from developer messages showing this pattern (2-8 items).
   * Can be simple strings (legacy) or structured with utterance linking (new).
   */
  evidence: z.array(EvidenceItemSchema).min(1).max(8),

  /** 4-6 sentences with step-by-step actionable advice */
  recommendation: z.string(),

  /** How critical this growth area is to address */
  severity: WorkerGrowthSeveritySchema.optional(),

  /** Truncated description preview for free tier blur teaser (set by ContentGateway) */
  descriptionPreview: z.string().optional(),

  /** Truncated recommendation preview for free tier blur teaser (set by ContentGateway) */
  recommendationPreview: z.string().optional(),

  /**
   * Verifiable next-session action — a concrete, checkable behavior change.
   *
   * Each growth area proposes an action the developer can take in their NEXT
   * session. The action must be specific enough to verify by examining future
   * session logs (e.g., checking for specific tool_use blocks, keywords in
   * user messages, or behavioral sequences).
   *
   * Optional for backward compatibility; required by quality gate for new analyses.
   *
   * @example
   * {
   *   action: "In your next debugging session, run the failing test via Bash before making any code changes to establish a baseline.",
   *   checkDescription: "Session starts with Bash tool_use containing 'test' or 'vitest' command before any Edit tool_use.",
   *   toolOrPattern: "Bash test execution"
   * }
   */
  verifiableAction: z.object({
    /** Concrete action to take in the next session (min 50 chars) */
    action: z.string().min(50),
    /** How to verify this action was taken by checking session logs (min 30 chars) */
    checkDescription: z.string().min(30),
    /** Specific tool, command, file, or behavioral pattern targeted */
    toolOrPattern: z.string().optional(),
  }).optional(),

  /**
   * v2 evidence moments in Pattern→Evidence→Action format.
   * Each moment is a distinct exchange from a specific session with:
   * - sessionId: explicit session reference
   * - quote: the developer's exact words
   * - behaviorDescription: what behavior this moment demonstrates
   *
   * Minimum 2 moments required to establish a pattern.
   * When present, supersedes legacy `evidence` array for display.
   */
  evidenceMoments: z.array(z.object({
    utteranceId: z.string(),
    sessionId: z.string(),
    quote: z.string(),
    behaviorDescription: z.string(),
    context: z.string().optional(),
    /**
     * ISO 8601 timestamp of the session moment (from UserUtterance.timestamp).
     * Optional for backward compatibility; populated by new analysis runs.
     */
    timestamp: z.string().optional(),
  })).min(2).optional(),

  /**
   * Low-confidence flag — set when evidence is sparse (fewer distinct
   * sessions than ideal). Never produce empty reports; surface this flag
   * so UI can show a confidence indicator instead.
   */
  lowConfidence: z.boolean().optional(),

  // ── PEA Display Fields (populated by peaToWorkerGrowth converter) ────

  /**
   * Specific tools, files, APIs, or technologies from the PEA pattern.
   * Displayed as tag pills in the Pattern section of PEA-format cards.
   * Only populated when growth area originates from PEA pipeline.
   */
  toolsFilesApis: z.array(z.string()).optional(),

  /**
   * Why the recommended action matters for this builder's goals.
   * From PEA action.goalRelevance — connects action to real-world impact.
   * Displayed in the Action section of PEA-format cards.
   */
  actionGoalRelevance: z.string().optional(),

  // ── KB Tip Attachment (post-processing by deterministic matcher) ──────

  /**
   * Best-match knowledge base tip attached by the deterministic KB matcher.
   * Populated post-generation during report assembly — NOT LLM-generated.
   * One best-match tip per growth area, or absent if no item exceeds
   * the relevance threshold.
   *
   * Includes source credibility signal for scoring transparency.
   */
  kbTip: z.object({
    /** Knowledge item or professional insight ID */
    tipId: z.string(),
    /** Tip title */
    title: z.string(),
    /** Brief actionable content from the tip */
    summary: z.string(),
    /** Source URL for attribution */
    sourceUrl: z.string(),
    /** Source author name */
    sourceAuthor: z.string(),
    /** Source platform (e.g., 'reddit', 'twitter', 'web', 'youtube') */
    sourcePlatform: z.string().optional(),
    /** Source credibility tier: 'high' | 'medium' | 'standard' */
    credibilityTier: z.enum(['high', 'medium', 'standard']).optional(),
    /** Match relevance score (0-1), only tips above threshold attached */
    relevanceScore: z.number().min(0).max(1),
  }).optional(),

  /**
   * Best-match knowledge tip — canonical display field name.
   *
   * Same content as `kbTip` but uses the canonical user-facing name used
   * by report renderers and UI components. Populated by the same deterministic
   * KB matcher. Use `knowledgeTip` in new code; `kbTip` is the legacy field.
   */
  knowledgeTip: z.object({
    /** Knowledge item or professional insight ID */
    tipId: z.string(),
    /** Tip title */
    title: z.string(),
    /** Brief actionable content from the tip */
    summary: z.string(),
    /** Source URL for attribution */
    sourceUrl: z.string(),
    /** Source author name */
    sourceAuthor: z.string(),
    /** Source platform (e.g., 'reddit', 'twitter', 'web', 'youtube') */
    sourcePlatform: z.string().optional(),
    /** Source credibility tier: 'high' | 'medium' | 'standard' */
    credibilityTier: z.enum(['high', 'medium', 'standard']).optional(),
    /** Match relevance score (0-1), only tips above threshold attached */
    relevanceScore: z.number().min(0).max(1),
  }).optional(),
});
export type WorkerGrowth = z.infer<typeof WorkerGrowthSchema>;

// ============================================================================
// Worker Insights Container (for each Worker)
// ============================================================================

/**
 * Referenced insight from Knowledge Base (imported for container schema).
 * Full schema is defined in thinking-quality-data.ts.
 */
export const ReferencedInsightSchema = z.object({
  /** Insight ID (e.g., "pi-001") */
  id: z.string(),
  /** Human-readable title (e.g., "Skill Atrophy Self-Diagnosis") */
  title: z.string(),
  /** Source URL for the insight */
  url: z.string(),
  /** Main insight text */
  keyTakeaway: z.string(),
  /** Actionable tips array */
  actionableAdvice: z.array(z.string()),
  /** Insight category: diagnosis | trend | tool | type-specific */
  category: z.string(),
  /** Author name from source */
  sourceAuthor: z.string(),
});
export type ReferencedInsight = z.infer<typeof ReferencedInsightSchema>;

/**
 * Container for a single Worker's strengths and growth areas.
 *
 * Each Phase 2 Worker outputs this structure alongside its domain-specific data.
 */
export const WorkerInsightsContainerSchema = z.object({
  /** Strengths identified in this domain (1-6 items) */
  strengths: z.array(WorkerStrengthSchema).min(1).max(6),

  /** Growth areas identified in this domain (1-6 items) */
  growthAreas: z.array(WorkerGrowthSchema).min(1).max(6),

  /** Domain-specific score (0-100) */
  domainScore: z.number().min(0).max(100).optional(),

  /** Referenced insights from Knowledge Base (post-processed from [pi-XXX] references) */
  referencedInsights: z.array(ReferencedInsightSchema).optional(),
});
export type WorkerInsightsContainer = z.infer<typeof WorkerInsightsContainerSchema>;

// ============================================================================
// Structured LLM Output Schemas (NEW - replaces pipe-delimited strings)
// ============================================================================

/**
 * Structured evidence for LLM output.
 *
 * This is the LLM output format - each evidence is a JSON object with:
 * - utteranceId: Required - sessionId_turnIndex (e.g., "abc123_5")
 * - quote: Required - the developer's exact words (min 15 chars)
 * - context: Optional - additional context
 *
 * Gemini Nesting Depth Analysis (4 levels max, arrays don't count):
 * root{} → strengths[] → strength{} → evidence[] → evidenceItem{}
 *   L1                      L2                         L3 (safe)
 */
export const StructuredEvidenceLLMSchema = z.object({
  /** Utterance ID from Phase 1 (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),

  /** Direct quote from the developer's message (min 15 chars) */
  quote: z.string(),

  /** Brief context description (optional) */
  context: z.string().optional(),

  /** Explicit session ID for multi-session evidence grouping (v2, optional for backward compat) */
  sessionId: z.string().optional(),

  /** What behavior the developer exhibited (v2, optional for backward compat) */
  behaviorDescription: z.string().optional(),
});
export type StructuredEvidenceLLM = z.infer<typeof StructuredEvidenceLLMSchema>;

/**
 * v2 Evidence Moment for Pattern→Evidence→Action growth areas.
 *
 * Unlike StructuredEvidenceLLMSchema where sessionId and behaviorDescription
 * are optional, this schema requires all fields. Each moment captures a
 * distinct exchange from a specific session that demonstrates a growth pattern.
 *
 * Used by StructuredGrowthMomentLLMSchema for new growth area generation.
 * Minimum 2 moments per growth area to establish a repeating pattern.
 *
 * Gemini Nesting Depth: same L3 as base evidence (safe).
 */
export const StructuredEvidenceMomentLLMSchema = z.object({
  /** Utterance ID for source verification (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),

  /** Explicit session ID — which session this moment comes from */
  sessionId: z.string(),

  /** Direct quote from the developer's message (min 15 chars) */
  quote: z.string().min(15),

  /** What behavior this moment demonstrates in the growth pattern */
  behaviorDescription: z.string().min(20),

  /** Brief context label (optional, for UI badges like "debugging") */
  context: z.string().optional(),

  /**
   * ISO 8601 timestamp of the session moment (from UserUtterance.timestamp).
   * Optional for backward compatibility; populated by new analysis runs.
   * Enables temporal verification of distinctness and chronological ordering.
   */
  timestamp: z.string().optional(),
});
export type StructuredEvidenceMomentLLM = z.infer<typeof StructuredEvidenceMomentLLMSchema>;

/**
 * Structured strength for LLM output.
 *
 * Uses StructuredEvidenceLLMSchema for evidence to provide type-safe structured output.
 *
 * Gemini Nesting Depth (arrays don't count toward 4-level limit):
 * root{} → strengths[] → strength{} → evidence[] → evidenceItem{}
 *   L1                      L2                         L3 (safe)
 */
export const StructuredStrengthLLMSchema = z.object({
  /** Clear, specific title (e.g., "Systematic Output Verification") */
  title: z.string(),

  /** 6-10 sentences providing comprehensive analysis (min 300 chars) */
  description: z.string().min(300),

  /**
   * Evidence objects with utteranceId linking (2-8 items).
   * Each item: {utteranceId: "sessionId_turnIndex", quote: "...", context?: "..."}
   */
  evidence: z.array(StructuredEvidenceLLMSchema).min(1).max(8),
});
export type StructuredStrengthLLM = z.infer<typeof StructuredStrengthLLMSchema>;

/**
 * Structured growth area for LLM output.
 *
 * Uses StructuredEvidenceLLMSchema for evidence to provide type-safe structured output.
 */
export const StructuredGrowthLLMSchema = z.object({
  /** Clear, specific title (e.g., "Error Loop Pattern") */
  title: z.string(),

  /** 6-10 sentences providing comprehensive analysis (min 300 chars) */
  description: z.string().min(300),

  /**
   * Evidence objects with utteranceId linking (2-8 items).
   * Each item: {utteranceId: "sessionId_turnIndex", quote: "...", context?: "..."}
   */
  evidence: z.array(StructuredEvidenceLLMSchema).min(1).max(8),

  /** 4-6 sentences with step-by-step actionable advice (min 150 chars) */
  recommendation: z.string().min(150),

  /** Severity level: critical | high | medium | low */
  severity: WorkerGrowthSeveritySchema.optional(),

  /**
   * Verifiable next-session action — the concrete behavior change this
   * growth area proposes. Must be specific enough to verify by checking
   * future session logs (tool_use blocks, keyword patterns, etc.).
   *
   * @example
   * {
   *   action: "In your next debugging session, use Grep to search for the error message across the codebase before asking the AI to guess the cause.",
   *   checkDescription: "Session contains Grep tool_use with error-related pattern before any 'fix this' or 'debug' user message.",
   *   toolOrPattern: "Grep tool for error search"
   * }
   */
  verifiableAction: z.object({
    action: z.string().min(50),
    checkDescription: z.string().min(30),
    toolOrPattern: z.string().optional(),
  }).optional(),
});
export type StructuredGrowthLLM = z.infer<typeof StructuredGrowthLLMSchema>;

/**
 * v2 Growth Area LLM Schema — Pattern→Evidence→Action format.
 *
 * This is the NEW LLM output format for growth areas that enforces:
 * - 2-3+ distinct evidence moments from different sessions
 * - Each moment has explicit sessionId, direct quote, and behavior description
 * - Low-confidence flag for sparse evidence scenarios
 *
 * Quality rubric criteria enforced:
 * - distinct_moments: min 2 evidence moments with explicit sessionIds
 * - verifiable_action: recommendation is concrete enough to verify in session logs
 * - pattern_specificity: description min 300 chars with specific behavioral patterns
 * - tool_file_naming: title/description should name specific tools/files/APIs
 *
 * Gemini Nesting Depth:
 * root{} → growthAreas[] → area{} → evidenceMoments[] → moment{}
 *   L1                      L2                            L3 (safe)
 */
export const StructuredGrowthMomentLLMSchema = z.object({
  /** Clear, specific title naming tools/files/APIs the builder interacted with */
  title: z.string(),

  /** 6-10 sentences: Pattern description specific to this builder's actual behavior (min 300 chars) */
  description: z.string().min(300),

  /**
   * 2-8 evidence moments from distinct sessions.
   * Each moment: {utteranceId, sessionId, quote (min 15 chars), behaviorDescription (min 20 chars)}
   */
  evidenceMoments: z.array(StructuredEvidenceMomentLLMSchema).min(2).max(8),

  /** Legacy evidence for backward compatibility (auto-populated from evidenceMoments) */
  evidence: z.array(StructuredEvidenceLLMSchema).optional(),

  /** 4-6 sentences with step-by-step actionable advice (min 150 chars) */
  recommendation: z.string().min(150),

  /** Severity level: critical | high | medium | low */
  severity: WorkerGrowthSeveritySchema,

  /**
   * Low-confidence flag — set true when:
   * - Evidence comes from fewer than 3 distinct sessions
   * - Pattern observed in <20% of analyzed sessions
   * - Corpus size is small (<10 sessions)
   * Never produce empty reports; flag sparse evidence instead.
   */
  lowConfidence: z.boolean().optional(),

  /**
   * Verifiable next-session action — the concrete behavior change this
   * growth area proposes. REQUIRED for v2 growth areas (Pattern→Evidence→Action).
   *
   * The "Action" in Pattern→Evidence→Action must be:
   * 1. Specific to the developer's actual toolchain (names tools/files/commands)
   * 2. Executable in a single next session (not a multi-week plan)
   * 3. Verifiable by checking session logs (observable signal described in checkDescription)
   *
   * @example
   * {
   *   action: "Before your next refactoring session, create a CLAUDE.md entry listing the files you plan to modify and the acceptance criteria for each change.",
   *   checkDescription: "Session contains Edit or Write tool_use targeting CLAUDE.md with file list and criteria before any source code modifications.",
   *   toolOrPattern: "CLAUDE.md constraint specification"
   * }
   */
  verifiableAction: z.object({
    action: z.string().min(50),
    checkDescription: z.string().min(30),
    toolOrPattern: z.string().optional(),
  }),
});
export type StructuredGrowthMomentLLM = z.infer<typeof StructuredGrowthMomentLLMSchema>;

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse a single evidence item with REQUIRED utteranceId format.
 *
 * Format: "utteranceId:quote[:context]"
 * - utteranceId: Required - sessionId_turnIndex (e.g., "abc123_5")
 * - quote: Required - the developer's exact words
 * - context: Optional - additional context
 *
 * Returns null if utteranceId is missing or invalid, which will be filtered out.
 * This ensures all evidence can be verified against original utterances.
 *
 * @param evidenceStr - Raw evidence string from LLM output
 * @returns InsightEvidence object or null if utteranceId is missing/invalid
 */
export function parseEvidenceItem(evidenceStr: string): InsightEvidence | null {
  const trimmed = evidenceStr.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) {
    return null;
  }

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex <= 0) {
    if (trimmed.length > 0) {
      console.warn(`[parseEvidenceItem] No utteranceId found (missing colon): "${trimmed.slice(0, 50)}..."`);
    }
    return null;
  }

  const utteranceId = trimmed.slice(0, colonIndex);

  // Validate utteranceId format: must end with _<number>
  if (!/_\d+$/.test(utteranceId)) {
    console.warn(`[parseEvidenceItem] Invalid utteranceId format: "${utteranceId}" (must match sessionId_turnIndex pattern)`);
    return null;
  }

  const remainder = trimmed.slice(colonIndex + 1);
  const secondColonIndex = remainder.indexOf(':');

  if (secondColonIndex > 0) {
    return {
      utteranceId,
      quote: remainder.slice(0, secondColonIndex).trim(),
      context: remainder.slice(secondColonIndex + 1).trim() || undefined,
    };
  }

  return {
    utteranceId,
    quote: remainder.trim(),
  };
}

/**
 * Parse strengthsData string into structured array.
 * Format: "title|description|evidence1,evidence2,evidence3|frequency;..."
 *
 * Evidence items MUST have utteranceId format: "sessionId_turnIndex:quote[:context]"
 * Evidence without valid utteranceId will be filtered out.
 *
 * @example
 * parseWorkerStrengthsData("Systematic Verification|You consistently verify...|session1_5:let me check:verifying,session1_8:looks good|75")
 */
export function parseWorkerStrengthsData(data: string | undefined): WorkerStrength[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      const title = parts[0]?.trim() || '';
      const description = parts[1]?.trim() || '';
      const evidenceStr = parts[2]?.trim() || '';

      // Track seen quotes for deduplication within this strength item
      const seenQuotes = new Set<string>();

      // Parse evidence: comma-separated, each item MUST have utteranceId
      // parseEvidenceItem returns null for items without valid utteranceId
      // Require minimum quote length of 15 chars to filter out corrupted/too-short quotes
      // Deduplicate by normalized quote text
      const evidence: EvidenceItem[] = evidenceStr
        .split(',')
        .map((e) => parseEvidenceItem(e))
        .filter((e): e is InsightEvidence => {
          if (e === null || e.quote.length < 15) return false;
          const normalizedQuote = e.quote.trim().toLowerCase();
          if (seenQuotes.has(normalizedQuote)) {
            console.warn(
              `[parseWorkerStrengthsData] Duplicate quote filtered: "${e.quote.slice(0, 50)}..."`
            );
            return false;
          }
          seenQuotes.add(normalizedQuote);
          return true;
        });

      const result: WorkerStrength = { title, description, evidence };

      return result;
    })
    .filter((s) => s.title && s.description && s.evidence.length > 0);
}

/**
 * Parse growthAreasData string into structured array.
 * Format: "title|description|evidence1,evidence2|recommendation|severity|frequency;..."
 *
 * Evidence items MUST have utteranceId format: "sessionId_turnIndex:quote[:context]"
 * Evidence without valid utteranceId will be filtered out.
 *
 * @example
 * parseWorkerGrowthAreasData("Error Loop|You tend to retry...|session1_3:fix it:debugging,session1_5:still broken|Try pausing...|high|65")
 */
export function parseWorkerGrowthAreasData(data: string | undefined): WorkerGrowth[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      const title = parts[0]?.trim() || '';
      const description = parts[1]?.trim() || '';
      const evidenceStr = parts[2]?.trim() || '';
      const recommendation = parts[3]?.trim() || '';
      const severityStr = parts[4]?.trim() as WorkerGrowthSeverity | undefined;

      // Track seen quotes for deduplication within this growth area item
      const seenQuotes = new Set<string>();

      // Parse evidence: comma-separated, each item MUST have utteranceId
      // parseEvidenceItem returns null for items without valid utteranceId
      // Require minimum quote length of 15 chars to filter out corrupted/too-short quotes
      // Deduplicate by normalized quote text
      const evidence: EvidenceItem[] = evidenceStr
        .split(',')
        .map((e) => parseEvidenceItem(e))
        .filter((e): e is InsightEvidence => {
          if (e === null || e.quote.length < 15) return false;
          const normalizedQuote = e.quote.trim().toLowerCase();
          if (seenQuotes.has(normalizedQuote)) {
            console.warn(
              `[parseWorkerGrowthAreasData] Duplicate quote filtered: "${e.quote.slice(0, 50)}..."`
            );
            return false;
          }
          seenQuotes.add(normalizedQuote);
          return true;
        });

      const result: WorkerGrowth = {
        title,
        description,
        evidence,
        recommendation,
      };

      if (severityStr && ['critical', 'high', 'medium', 'low'].includes(severityStr)) {
        result.severity = severityStr;
      }

      return result;
    })
    .filter((g) => g.title && g.description && g.evidence.length > 0);
}

// ============================================================================
// Structured Parsing Functions (for StructuredStrengthLLM/StructuredGrowthLLM)
// ============================================================================

/**
 * Parse structured evidence objects from LLM output.
 *
 * Each evidence item is already a JSON object: {utteranceId, quote, context?}
 * This function validates, filters, and deduplicates the evidence objects.
 *
 * Deduplication is performed by normalizing quote text (trimmed, lowercased).
 * This handles cases where LLMs hallucinate different utteranceIds for the same quote,
 * or when users genuinely repeated the same message across different turns.
 * Only the first occurrence is kept.
 *
 * @param evidenceObjects - Array of StructuredEvidenceLLM from LLM output
 * @returns Array of InsightEvidence objects (invalid/duplicate items filtered out)
 */
export function parseStructuredEvidence(
  evidenceObjects: StructuredEvidenceLLM[]
): InsightEvidence[] {
  const seenQuotes = new Set<string>(); // Track seen quotes for deduplication

  return evidenceObjects
    .filter((e) => {
      // Validate utteranceId format: sessionId_turnIndex
      if (!e.utteranceId || !/_\d+$/.test(e.utteranceId)) {
        console.warn(
          `[parseStructuredEvidence] Invalid utteranceId format: "${e.utteranceId}"`
        );
        return false;
      }
      // Validate quote minimum length
      if (!e.quote || e.quote.length < 15) {
        console.warn(
          `[parseStructuredEvidence] Quote too short (min 15 chars): "${e.quote?.slice(0, 30)}..."`
        );
        return false;
      }

      // Deduplicate by normalized quote text (trim + lowercase)
      const normalizedQuote = e.quote.trim().toLowerCase();
      if (seenQuotes.has(normalizedQuote)) {
        console.warn(
          `[parseStructuredEvidence] Duplicate quote filtered: "${e.quote.slice(0, 50)}..."`
        );
        return false;
      }
      seenQuotes.add(normalizedQuote);

      return true;
    })
    .map((e) => ({
      utteranceId: e.utteranceId,
      quote: e.quote.trim(),
      context: e.context?.trim() || undefined,
    }));
}

/**
 * Convert structured LLM strengths to WorkerStrength array.
 *
 * Directly maps structured evidence objects (no string parsing needed).
 *
 * @param llmStrengths - Array of StructuredStrengthLLM from LLM output
 * @returns Array of WorkerStrength with validated evidence
 */
export function parseStructuredStrengths(
  llmStrengths: StructuredStrengthLLM[] | undefined
): WorkerStrength[] {
  if (!llmStrengths || llmStrengths.length === 0) return [];

  return llmStrengths
    .map((s) => ({
      title: s.title,
      description: s.description,
      evidence: parseStructuredEvidence(s.evidence),
    }))
    .filter((s) => s.title && s.description && s.evidence.length > 0);
}

/**
 * Convert structured LLM growth areas to WorkerGrowth array.
 *
 * Directly maps structured evidence objects (no string parsing needed).
 * Preserves verifiableAction when present in LLM output.
 *
 * @param llmGrowthAreas - Array of StructuredGrowthLLM from LLM output
 * @returns Array of WorkerGrowth with validated evidence and verifiable actions
 */
export function parseStructuredGrowthAreas(
  llmGrowthAreas: StructuredGrowthLLM[] | undefined
): WorkerGrowth[] {
  if (!llmGrowthAreas || llmGrowthAreas.length === 0) return [];

  return llmGrowthAreas
    .map((g) => {
      const result: WorkerGrowth = {
        title: g.title,
        description: g.description,
        evidence: parseStructuredEvidence(g.evidence),
        recommendation: g.recommendation,
        severity: g.severity,
      };

      // Preserve verifiableAction from LLM output when present
      if (g.verifiableAction) {
        result.verifiableAction = {
          action: g.verifiableAction.action,
          checkDescription: g.verifiableAction.checkDescription,
          ...(g.verifiableAction.toolOrPattern && {
            toolOrPattern: g.verifiableAction.toolOrPattern,
          }),
        };
      }

      return result;
    })
    .filter((g) => g.title && g.description && g.evidence.length > 0);
}

// ============================================================================
// v2 Evidence Moment Parsing (Pattern→Evidence→Action format)
// ============================================================================

/**
 * Evidence moment type used in v2 growth areas.
 * Inline type matching the evidenceMoments Zod schema on WorkerGrowthSchema.
 */
export interface EvidenceMoment {
  utteranceId: string;
  sessionId: string;
  quote: string;
  behaviorDescription: string;
  context?: string;
  /**
   * ISO 8601 timestamp of the session moment (from UserUtterance.timestamp).
   * Optional for backward compatibility; populated by new analysis runs.
   * Enables temporal verification of distinctness and chronological ordering.
   */
  timestamp?: string;
}

/**
 * Validate and parse v2 evidence moments from LLM output.
 *
 * Validates:
 * - utteranceId format ({sessionId}_{turnIndex})
 * - sessionId is non-empty
 * - quote minimum length (15 chars)
 * - behaviorDescription minimum length (20 chars)
 * - Deduplicates by normalized quote text
 *
 * @param moments - Array of StructuredEvidenceMomentLLM from LLM output
 * @returns Validated EvidenceMoment array (invalid/duplicate items filtered out)
 */
export function parseEvidenceMoments(
  moments: StructuredEvidenceMomentLLM[]
): EvidenceMoment[] {
  const seenQuotes = new Set<string>();

  return moments
    .filter((m) => {
      // Validate utteranceId format
      if (!m.utteranceId || !/_\d+$/.test(m.utteranceId)) {
        console.warn(
          `[parseEvidenceMoments] Invalid utteranceId format: "${m.utteranceId}"`
        );
        return false;
      }
      // Validate sessionId
      if (!m.sessionId || m.sessionId.trim().length === 0) {
        console.warn(
          `[parseEvidenceMoments] Missing sessionId for utterance: "${m.utteranceId}"`
        );
        return false;
      }
      // Validate quote minimum length
      if (!m.quote || m.quote.length < 15) {
        console.warn(
          `[parseEvidenceMoments] Quote too short (min 15 chars): "${m.quote?.slice(0, 30)}..."`
        );
        return false;
      }
      // Validate behaviorDescription minimum length
      if (!m.behaviorDescription || m.behaviorDescription.length < 20) {
        console.warn(
          `[parseEvidenceMoments] behaviorDescription too short (min 20 chars): "${m.behaviorDescription?.slice(0, 30)}..."`
        );
        return false;
      }
      // Deduplicate by normalized quote text
      const normalizedQuote = m.quote.trim().toLowerCase();
      if (seenQuotes.has(normalizedQuote)) {
        console.warn(
          `[parseEvidenceMoments] Duplicate quote filtered: "${m.quote.slice(0, 50)}..."`
        );
        return false;
      }
      seenQuotes.add(normalizedQuote);
      return true;
    })
    .map((m) => ({
      utteranceId: m.utteranceId,
      sessionId: m.sessionId,
      quote: m.quote.trim(),
      behaviorDescription: m.behaviorDescription.trim(),
      context: m.context?.trim() || undefined,
      timestamp: m.timestamp || undefined,
    }));
}

/**
 * Convert v2 evidence moments to legacy InsightEvidence array.
 *
 * Generates backward-compatible evidence from EvidenceMoment objects
 * so that existing components (ExpandableEvidence) can render them
 * without modification. The behaviorDescription maps to the context field.
 *
 * @param moments - Validated EvidenceMoment array
 * @returns InsightEvidence array for legacy evidence field
 */
export function evidenceMomentsToLegacy(moments: EvidenceMoment[]): InsightEvidence[] {
  return moments.map((m) => ({
    utteranceId: m.utteranceId,
    quote: m.quote,
    context: m.behaviorDescription,
    sessionId: m.sessionId,
    behaviorDescription: m.behaviorDescription,
  }));
}

/**
 * Convert v2 structured growth area LLM output to WorkerGrowth array.
 *
 * Handles the new StructuredGrowthMomentLLMSchema format with evidence moments.
 * Auto-populates legacy `evidence` from `evidenceMoments` for backward compat.
 *
 * @param llmGrowthAreas - Array of StructuredGrowthMomentLLM from LLM output
 * @returns Array of WorkerGrowth with both evidenceMoments and legacy evidence
 */
export function parseStructuredGrowthMoments(
  llmGrowthAreas: StructuredGrowthMomentLLM[] | undefined
): WorkerGrowth[] {
  if (!llmGrowthAreas || llmGrowthAreas.length === 0) return [];

  return llmGrowthAreas
    .map((g) => {
      const validatedMoments = parseEvidenceMoments(g.evidenceMoments);
      const legacyEvidence = evidenceMomentsToLegacy(validatedMoments);

      return {
        title: g.title,
        description: g.description,
        evidence: legacyEvidence,
        evidenceMoments: validatedMoments,
        recommendation: g.recommendation,
        severity: g.severity,
        lowConfidence: g.lowConfidence,
      };
    })
    .filter((g) => g.title && g.description && g.evidenceMoments.length >= 2);
}

/**
 * Extract distinct session IDs from evidence moments.
 * Used to verify the "2-3+ distinct sessions" quality criterion.
 *
 * @param moments - Evidence moment array
 * @returns Set of unique session IDs
 */
export function getDistinctSessions(moments: EvidenceMoment[]): Set<string> {
  return new Set(moments.map((m) => m.sessionId));
}

// ============================================================================
// Aggregated Worker Insights (for VerboseEvaluation)
// ============================================================================

/**
 * All Worker insights aggregated for the VerboseEvaluation.
 *
 * Each worker's insights are accessed by key for direct frontend rendering.
 */
export interface AggregatedWorkerInsights {
  // =========================================================================
  // v3.1 Unified Workers
  // =========================================================================

  /** Thinking Quality domain insights (planning + critical thinking) */
  thinkingQuality?: WorkerInsightsContainer;

  /** Communication Patterns domain insights (communication + signature quotes) */
  communicationPatterns?: WorkerInsightsContainer;

  /** Learning Behavior domain insights (knowledge gaps + repeated mistakes) */
  learningBehavior?: WorkerInsightsContainer;

  /** Context Efficiency domain insights */
  contextEfficiency?: WorkerInsightsContainer;

  /** Session Outcome domain insights (goals, friction, success rates) */
  sessionOutcome?: WorkerInsightsContainer;

  // =========================================================================
  // Legacy workers (kept for cached data compatibility)
  // =========================================================================

  /** Knowledge & Learning domain insights (legacy, use learningBehavior instead) */
  knowledgeGap?: WorkerInsightsContainer;
}

/**
 * Metadata for a Worker domain (used in frontend rendering).
 */
export interface WorkerDomainConfig {
  key: keyof AggregatedWorkerInsights;
  icon: string;
  title: string;
  subtitle: string;
  scoreLabel: string;
  contextDescription: string;
}

/**
 * Configuration for v3.1 Worker domains.
 * Used by frontend to render consistent UI sections.
 *
 * Tab order: Thinking → Communication → Learning → Context
 */
export const WORKER_DOMAIN_CONFIGS: WorkerDomainConfig[] = [
  {
    key: 'thinkingQuality',
    icon: '🧠',
    title: 'Thinking Quality',
    subtitle: 'How intentionally and critically do you work?',
    scoreLabel: 'Thinking Score',
    contextDescription: 'Analyzed: planning before coding, verifying AI outputs, questioning assumptions, catching errors early.',
  },
  {
    key: 'communicationPatterns',
    icon: '💬',
    title: 'Communication',
    subtitle: 'How clearly do you express your needs?',
    scoreLabel: 'Communication Score',
    contextDescription: 'Analyzed: how you phrase requests, context you provide, specificity of instructions, prompt patterns.',
  },
  {
    key: 'learningBehavior',
    icon: '📈',
    title: 'Learning Behavior',
    subtitle: 'How much do you learn from AI?',
    scoreLabel: 'Learning Score',
    contextDescription: 'Analyzed: knowledge gaps encountered, whether mistakes repeat, how you build on past sessions.',
  },
  {
    key: 'contextEfficiency',
    icon: '⚡',
    title: 'Context Efficiency',
    subtitle: 'How efficiently do you use tokens?',
    scoreLabel: 'Efficiency Score',
    contextDescription: 'Analyzed: token usage patterns, unnecessary repetition, context window management, session efficiency.',
  },
  {
    key: 'sessionOutcome',
    icon: '🎯',
    title: 'Session Success',
    subtitle: 'How successful are your AI collaboration sessions?',
    scoreLabel: 'Success Rate',
    contextDescription: 'Analyzed: goal completion, session friction points, recovery from blockers, overall success rates.',
  },
];

// ============================================================================
// Worker-to-Dimension Mapping (for Phase 2.75 fallback insights)
// ============================================================================

/**
 * Maps Worker domain keys to Phase 2.75 dimension names.
 *
 * Phase 2.75 KnowledgeResourceMatcher groups resources by DimensionNameEnum
 * (e.g., 'TrustVerification', 'CommunicationPatterns'), while the frontend
 * Worker tabs use AggregatedWorkerInsights keys (e.g., 'thinkingQuality').
 *
 * This mapping enables retrieving fallback professionalInsights for each Worker tab
 * when LLM doesn't reference any [pi-XXX] insights.
 *
 * Dimension names match DimensionNameEnum in dimension-schema.ts:
 * - TrustVerification: Verification behavior, critical thinking
 * - WorkflowHabit: Planning habits, structured approach
 * - CommunicationPatterns: Communication clarity, prompt patterns
 * - KnowledgeGap: Learning behavior, knowledge gaps
 * - ContextEfficiency: Token efficiency, context management
 */
export const WORKER_TO_DIMENSIONS: Record<keyof AggregatedWorkerInsights, string[]> = {
  thinkingQuality: ['TrustVerification', 'WorkflowHabit'],
  communicationPatterns: ['CommunicationPatterns'],
  learningBehavior: ['KnowledgeGap'],
  contextEfficiency: ['ContextEfficiency'],
  sessionOutcome: ['SessionOutcome'],  // NEW - maps to SessionOutcome insights
  // Legacy worker (kept for backward compatibility)
  knowledgeGap: ['KnowledgeGap'],
};

/**
 * Convert MatchedProfessionalInsight to ReferencedInsight format.
 *
 * MatchedProfessionalInsight (from Phase 2.75) has matchScore and priority fields
 * that ReferencedInsight doesn't need. This helper extracts the common fields
 * for consistent display in the frontend.
 *
 * @param matched - Professional insight from Phase 2.75 matching
 * @returns ReferencedInsight format for GrowthCard display
 */
export function matchedInsightToReferenced(matched: {
  id: string;
  title: string;
  sourceUrl: string;
  keyTakeaway: string;
  actionableAdvice: string[];
  category: string;
  sourceAuthor: string;
}): ReferencedInsight {
  return {
    id: matched.id,
    title: matched.title,
    url: matched.sourceUrl,
    keyTakeaway: matched.keyTakeaway,
    actionableAdvice: matched.actionableAdvice,
    category: matched.category,
    sourceAuthor: matched.sourceAuthor,
  };
}

// ============================================================================
// Translation Key Mapping
// ============================================================================

/**
 * Map worker domain keys to TranslatedAgentInsights keys.
 *
 * v3 workers (thinkingQuality, learningBehavior, contextEfficiency) are processed
 * by the Phase 4 Translator stage which populates TranslatedAgentInsights with
 * matching keys. This mapping enables the frontend to look up translated data
 * for each domain when rendering non-English reports.
 *
 * Legacy keys (knowledgeGap) are kept for cached data compatibility.
 */
export const DOMAIN_TO_TRANSLATION_KEY: Record<string, string> = {
  thinkingQuality: 'thinkingQuality',
  communicationPatterns: 'communicationPatterns',
  learningBehavior: 'learningBehavior',
  contextEfficiency: 'contextEfficiency',
  sessionOutcome: 'sessionOutcome',
  knowledgeGap: 'knowledgeGap',
};

// ============================================================================
// Translation Overlay Functions
// ============================================================================

/**
 * Apply translated strengths data to WorkerStrength array.
 *
 * Supports two input formats:
 * - New: Array of {title, description} objects (from structured JSON translation)
 * - Legacy: Pipe-delimited string "title|description|quotes;..." (from cached data)
 *
 * Overlays translated title/description while preserving original evidence quotes.
 *
 * @param strengths - Original WorkerStrength array (English)
 * @param translatedData - Translated data (array or legacy string) from TranslatedAgentInsights
 * @returns WorkerStrength array with translated title/description
 */
export function applyTranslatedStrengths(
  strengths: WorkerStrength[],
  translatedData: Array<{ title: string; description: string }> | string | undefined
): WorkerStrength[] {
  if (!translatedData) return strengths;

  // New format: structured array
  if (Array.isArray(translatedData)) {
    return strengths.map((strength, i) => {
      const t = translatedData[i];
      if (!t) return strength;
      return {
        ...strength,
        title: t.title || strength.title,
        // Preserve locked state: empty description means ContentGateway locked this domain
        description: strength.description === '' ? '' : (t.description || strength.description),
      };
    });
  }

  // Legacy format: pipe-delimited string (backward compat for cached data)
  if (typeof translatedData === 'string' && translatedData.trim()) {
    const translations = translatedData.split(';').filter(Boolean);
    return strengths.map((strength, index) => {
      const translationEntry = translations[index];
      if (!translationEntry) return strength;

      const parts = translationEntry.split('|');
      if (parts.length < 2) return strength;

      const translatedTitle = parts[0]?.trim();
      const translatedDescription = parts[1]?.trim();

      return {
        ...strength,
        title: translatedTitle || strength.title,
        // Preserve locked state: empty description means ContentGateway locked this domain
        description: strength.description === '' ? '' : (translatedDescription || strength.description),
      };
    });
  }

  return strengths;
}

/**
 * Apply translated growth areas data to WorkerGrowth array.
 *
 * Supports two input formats:
 * - New: Array of {title, description, recommendation} objects
 * - Legacy: Pipe-delimited string "title|desc|evidence|rec|freq|severity|priority;..."
 *
 * Overlays translated title/description/recommendation while preserving
 * original evidence quotes and numeric fields.
 *
 * CRITICAL: Preserves locked state — if original recommendation is empty (''),
 * it stays empty even if translation exists, preventing premium content leakage.
 *
 * @param growthAreas - Original WorkerGrowth array (English)
 * @param translatedData - Translated data (array or legacy string) from TranslatedAgentInsights
 * @returns WorkerGrowth array with translated title/description/recommendation
 */
export function applyTranslatedGrowthAreas(
  growthAreas: WorkerGrowth[],
  translatedData: Array<{ title: string; description: string; recommendation: string }> | string | undefined
): WorkerGrowth[] {
  if (!translatedData) return growthAreas;

  // New format: structured array
  if (Array.isArray(translatedData)) {
    return growthAreas.map((growth, i) => {
      const t = translatedData[i];
      if (!t) return growth;
      return {
        ...growth,
        title: t.title || growth.title,
        // Preserve locked state: empty description means ContentGateway locked this domain
        description: growth.description === '' ? '' : (t.description || growth.description),
        // Preserve locked state for free tier
        recommendation: growth.recommendation
          ? (t.recommendation || growth.recommendation)
          : growth.recommendation,
      };
    });
  }

  // Legacy format: pipe-delimited string (backward compat for cached data)
  if (typeof translatedData === 'string' && translatedData.trim()) {
    const translations = translatedData.split(';').filter(Boolean);
    return growthAreas.map((growth, index) => {
      const translationEntry = translations[index];
      if (!translationEntry) return growth;

      const parts = translationEntry.split('|');
      if (parts.length < 4) return growth;

      const translatedTitle = parts[0]?.trim();
      const translatedDescription = parts[1]?.trim();
      // parts[2] is evidence (keep original)
      const translatedRecommendation = parts[3]?.trim();

      return {
        ...growth,
        title: translatedTitle || growth.title,
        // Preserve locked state: empty description means ContentGateway locked this domain
        description: growth.description === '' ? '' : (translatedDescription || growth.description),
        recommendation: growth.recommendation
          ? (translatedRecommendation || growth.recommendation)
          : growth.recommendation,
      };
    });
  }

  return growthAreas;
}
