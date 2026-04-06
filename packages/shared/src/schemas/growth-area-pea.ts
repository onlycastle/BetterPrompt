/**
 * Growth Area — Pattern → Evidence → Action (PEA) Schema
 *
 * Restructures growth areas into a 3-part format:
 *   Pattern:  What behavioral pattern was observed (specific, named)
 *   Evidence: Proof from actual sessions (2-3+ distinct moments)
 *   Action:   Concrete next-session action (verifiable in future logs)
 *
 * Every growth area must pass a 4-criteria quality rubric (hard gate):
 *   1. distinct_moments   — References 2-3+ distinct specific moments
 *   2. verifiable_action  — Action is concrete enough to check in future logs
 *   3. pattern_specificity — Specific to this builder's actual behavior
 *   4. tool_file_naming   — Names specific tools, files, APIs, or technologies
 *
 * Backward compatibility:
 *   - PEA schema is a strict superset of existing DomainGrowthArea fields
 *   - `peaToDomainGrowthArea()` converts PEA → legacy format for existing consumers
 *   - `peaToWorkerGrowth()` converts PEA → WorkerGrowth for worker pipeline
 *
 * Gemini nesting depth (4 levels max, arrays don't count):
 *   root{} → growthAreas[] → pea{} → pattern{} → (flat fields) = L3 ✓
 *   root{} → growthAreas[] → pea{} → evidence[] → moment{} = L3 ✓
 *   root{} → growthAreas[] → pea{} → action{} → (flat fields) = L3 ✓
 *   root{} → growthAreas[] → pea{} → kbTip{} → (flat fields) = L3 ✓
 *
 * @module @betterprompt/shared/schemas/growth-area-pea
 */

import { z } from 'zod';

// ============================================================================
// Severity (reused from existing worker-outputs)
// ============================================================================

/**
 * Severity level for growth areas.
 * Reuse the same semantics as WorkerGrowthSeverity:
 * - critical: 70%+ occurrence or fundamental skill gap
 * - high: 40-70% occurrence or significant impact
 * - medium: 20-40% occurrence or moderate impact
 * - low: <20% occurrence or minor impact
 */
export const PEASeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export type PEASeverity = z.infer<typeof PEASeveritySchema>;

// ============================================================================
// Pattern — What behavioral pattern was observed
// ============================================================================

/**
 * The observed behavioral pattern.
 *
 * Must be specific to the builder's actual behavior, not generic advice.
 * Must name specific tools, files, APIs, or technologies the builder interacted with.
 *
 * Rubric criteria addressed: pattern_specificity, tool_file_naming
 */
export const PEAPatternSchema = z.object({
  /**
   * Concise, specific title naming the pattern and relevant technology.
   * BAD:  "Error Handling Issues"
   * GOOD: "Untested Error Handling in Express Middleware Routes"
   */
  title: z.string(),

  /**
   * 4-6 sentences describing what the pattern is and why it matters
   * for what the builder is trying to achieve (goal_relevance).
   * Must reference specific behavior, not generic descriptions.
   */
  description: z.string().min(100),

  /** How critical this pattern is to address */
  severity: PEASeveritySchema,

  /**
   * Specific tools, files, APIs, or technologies the builder actually
   * interacted with that are relevant to this pattern.
   * Examples: ["Express.js", "middleware/auth.ts", "Prisma ORM", "jest"]
   *
   * Rubric: tool_file_naming — at least one item required.
   */
  toolsFilesApis: z.array(z.string()).min(1).max(10),
});
export type PEAPattern = z.infer<typeof PEAPatternSchema>;

// ============================================================================
// Evidence — Distinct moments from actual sessions
// ============================================================================

/**
 * A distinct moment from an actual session where the pattern was observed.
 *
 * Each moment is a specific exchange (not just a count) linked to an utterance.
 * The 2-3+ distinct moments requirement ensures the pattern isn't a one-off.
 *
 * Rubric criteria addressed: distinct_moments
 */
export const DistinctMomentSchema = z.object({
  /**
   * ISO 8601 timestamp of the session moment (from UserUtterance.timestamp).
   * Optional for backward compatibility; populated by new analysis runs.
   *
   * Enables:
   * 1. Temporal verification that moments are from distinct times
   * 2. Chronological ordering of evidence in reports
   * 3. Cross-referencing with session JSONL logs by timestamp
   */
  timestamp: z.string().optional(),

  /**
   * Utterance ID from Phase 1 (format: {sessionId}_{turnIndex}).
   * Required for evidence verification and linking back to original session.
   */
  utteranceId: z.string(),

  /**
   * Explicit session ID — which session this moment comes from.
   * Enables distinct-session verification (2-3+ distinct sessions required)
   * and multi-session evidence grouping in team aggregation views.
   *
   * Extracted from the utteranceId prefix (everything before the last _turnIndex)
   * or provided directly by the LLM when session context is available.
   */
  sessionId: z.string(),

  /**
   * Direct quote from the developer's message — MUST be verbatim from the
   * session event data provided in the LLM prompt context (min 15 chars).
   *
   * Source mapping (from extraction stage output):
   *   `quotes[n].text` → `quote`  (copy character-for-character)
   *
   * The LLM MUST copy this field verbatim — no paraphrasing, summarizing,
   * or cleaning up. If the developer wrote "just add a try-catch and move on",
   * that is the exact quote. Paraphrasing ("added error handling without tests")
   * fails the distinct_moments rubric criterion.
   *
   * The quote serves as a citation anchor: the utteranceId links back to the
   * session JSONL log, and the quote must match what appears at that position
   * in the actual session data to pass evidence verification.
   */
  quote: z.string().min(15),

  /**
   * What was happening at this moment — enough context to understand
   * the significance of the quote within the session flow.
   */
  context: z.string().min(20),

  /**
   * What specific behavior this moment demonstrates (behavior description).
   * Connects the raw quote to the growth area's pattern.
   * Example: "Retried the same failing approach without reading the error message"
   */
  observation: z.string().min(20),
});
export type DistinctMoment = z.infer<typeof DistinctMomentSchema>;

// ============================================================================
// Action — Concrete next-session action
// ============================================================================

/**
 * A concrete, verifiable action for the builder's next session.
 *
 * Must be specific enough that checking future session logs would reveal
 * whether the action was taken. Generic advice fails the rubric.
 *
 * Rubric criteria addressed: verifiable_action, goal_relevance
 */
export const PEAActionSchema = z.object({
  /**
   * The specific action to take in the next session.
   * Must be concrete enough to verify by checking future session logs.
   *
   * BAD:  "Be more careful with error handling"
   * GOOD: "Before writing catch blocks in Express middleware, add a test
   *        case for the error path using jest.spyOn on the failing service"
   */
  instruction: z.string().min(50),

  /**
   * How to verify this action was taken by checking future session logs.
   * Describes what evidence would appear in a session where the action was applied.
   *
   * Example: "Session log should show test file creation before or alongside
   *           error handling code, with jest.spyOn or mock patterns visible"
   */
  verificationCheck: z.string().min(30),

  /**
   * Why this action matters for what the builder is trying to achieve.
   * Connects the action to the builder's actual goals, not abstract best practices.
   *
   * Must reference the builder's specific project context, technology stack,
   * or stated objectives — not generic platitudes like "improves code quality".
   *
   * GOOD: "Your Express API handles payment webhooks — untested error paths
   *        in middleware could silently drop Stripe events, causing revenue loss"
   * GOOD: "You're building a multi-tenant SaaS dashboard with Prisma — schema
   *        migrations without diff checks risk breaking tenant data isolation"
   *
   * BAD:  "This will help you write better code" (generic, no project context)
   * BAD:  "Testing is important for code quality" (platitude, not personalized)
   *
   * Evaluation criterion: goal_relevance
   * - Explains WHY the pattern matters for the builder's specific goals
   * - References the builder's actual project, technology, or stated objectives
   * - Connects observed behavior to real-world professional consequences
   */
  goalRelevance: z.string().min(50),
});
export type PEAAction = z.infer<typeof PEAActionSchema>;

// ============================================================================
// Quality Rubric — 4-criteria hard gate
// ============================================================================

/**
 * 4-criteria quality rubric for growth areas.
 *
 * ALL four criteria must be true for a growth area to pass.
 * This is a non-negotiable hard gate — failing growth areas are rejected,
 * not displayed with a warning.
 *
 * Applied as a post-generation validation step.
 */
export const QualityRubricSchema = z.object({
  /**
   * References 2-3+ distinct specific moments from actual sessions
   * with specific exchanges, not just a count.
   */
  distinctMoments: z.boolean(),

  /**
   * Proposed next-session action is concrete enough to verify
   * by checking future session logs.
   */
  verifiableAction: z.boolean(),

  /**
   * Growth area is specific to this builder's actual behavior,
   * not dressed-up generic advice that could apply to anyone.
   */
  patternSpecificity: z.boolean(),

  /**
   * Growth area names specific tools, files, APIs, or technologies
   * the builder actually interacted with.
   */
  toolFileNaming: z.boolean(),
});
export type QualityRubric = z.infer<typeof QualityRubricSchema>;

/**
 * Check whether a quality rubric passes all four criteria.
 * @param rubric - The rubric to validate
 * @returns true if ALL four criteria are met
 */
export function passesQualityRubric(rubric: QualityRubric): boolean {
  return (
    rubric.distinctMoments &&
    rubric.verifiableAction &&
    rubric.patternSpecificity &&
    rubric.toolFileNaming
  );
}

// ============================================================================
// KB Tip Attachment — One best-match knowledge tip per growth area
// ============================================================================

/**
 * A knowledge base tip attached to a growth area via deterministic matching.
 *
 * Attached post-generation by the KB matcher (not LLM-generated).
 * One best-match tip per growth area, or none if below relevance threshold.
 *
 * Source credibility signal is required for scoring transparency.
 */
export const KbTipAttachmentSchema = z.object({
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

  /**
   * Source platform (e.g., 'reddit', 'twitter', 'web', 'youtube').
   * Used as a credibility signal alongside credibilityTier.
   */
  sourcePlatform: z.string().optional(),

  /**
   * Source credibility tier.
   * - 'high': Recognized authority, official docs, peer-reviewed
   * - 'medium': Known practitioner, established blog
   * - 'standard': Community content, forum posts
   */
  credibilityTier: z.enum(['high', 'medium', 'standard']).optional(),

  /**
   * Match relevance score (0-1).
   * Determined by KB matcher's keyword + dimension overlap scoring.
   * Only tips above the relevance threshold are attached.
   */
  relevanceScore: z.number().min(0).max(1),
});
export type KbTipAttachment = z.infer<typeof KbTipAttachmentSchema>;

/** Default relevance threshold — tips below this score are not attached */
export const KB_TIP_RELEVANCE_THRESHOLD = 0.3;

// ============================================================================
// Complete Growth Area PEA Schema
// ============================================================================

/**
 * A complete growth area in Pattern → Evidence → Action format.
 *
 * This is the primary output schema for growth areas in the analysis pipeline.
 * It combines the LLM-generated PEA content with:
 *   - Post-generation quality rubric validation
 *   - Post-generation KB tip attachment
 *   - Team aggregation metadata (category tags)
 *
 * @example
 * {
 *   pattern: {
 *     title: "Untested Error Handling in Express Middleware Routes",
 *     description: "Across multiple sessions, you consistently write catch blocks...",
 *     severity: "high",
 *     toolsFilesApis: ["Express.js", "middleware/auth.ts", "jest"]
 *   },
 *   evidence: [
 *     {
 *       utteranceId: "sess_abc123_5",
 *       quote: "Let me just add a try-catch here and move on",
 *       context: "Working on payment webhook handler in middleware/stripe.ts",
 *       observation: "Added error handling without writing test for the error path"
 *     },
 *     {
 *       utteranceId: "sess_def456_12",
 *       quote: "The middleware is crashing but I'm not sure which catch is wrong",
 *       context: "Debugging auth middleware failure in production-like environment",
 *       observation: "Previous untested catch block masked the real error source"
 *     }
 *   ],
 *   action: {
 *     instruction: "Before writing any catch block in Express middleware, first create a test file...",
 *     verificationCheck: "Session log should show test file creation alongside error handling code",
 *     goalRelevance: "Your Express API handles payment webhooks — unhandled errors drop Stripe events"
 *   },
 *   qualityRubric: {
 *     distinctMoments: true,
 *     verifiableAction: true,
 *     patternSpecificity: true,
 *     toolFileNaming: true
 *   },
 *   kbTip: {
 *     tipId: "kb-express-error-testing",
 *     title: "Test-Driven Error Handling in Express",
 *     summary: "Write error path tests before implementing catch blocks...",
 *     sourceUrl: "https://...",
 *     sourceAuthor: "Kent C. Dodds",
 *     sourcePlatform: "blog",
 *     credibilityTier: "high",
 *     relevanceScore: 0.85
 *   },
 *   domain: "thinkingQuality",
 *   categoryTags: ["error-handling", "test-coverage", "express-middleware"],
 *   lowConfidence: false
 * }
 */
export const GrowthAreaPEASchema = z.object({
  // ── Pattern ──────────────────────────────────────────────────────────
  /** The observed behavioral pattern */
  pattern: PEAPatternSchema,

  // ── Evidence ─────────────────────────────────────────────────────────
  /**
   * 2-8 distinct moments from actual sessions demonstrating the pattern.
   * Minimum 2 ensures this isn't a one-off observation.
   */
  evidence: z.array(DistinctMomentSchema).min(2).max(8),

  // ── Action ───────────────────────────────────────────────────────────
  /** Concrete next-session action */
  action: PEAActionSchema,

  // ── Quality Gate ─────────────────────────────────────────────────────
  /** 4-criteria rubric — all must be true to ship */
  qualityRubric: QualityRubricSchema,

  // ── KB Enrichment (post-processing) ──────────────────────────────────
  /** Best-match KB tip, attached by deterministic matcher. Absent if below threshold. */
  kbTip: KbTipAttachmentSchema.optional(),

  /**
   * Best-match knowledge tip — canonical field name for UI rendering.
   *
   * Populated post-generation by the deterministic KB matcher.
   * One tip per growth area, or absent if no item exceeds the relevance threshold.
   *
   * This is the forward-facing field name used by the report renderer.
   * `kbTip` is the internal pipeline field; `knowledgeTip` is the display field.
   * Both are populated by the same KB matcher — use `knowledgeTip` in new code.
   *
   * Source credibility tier required for scoring transparency (source_credibility criterion).
   */
  knowledgeTip: KbTipAttachmentSchema.optional(),

  // ── Domain & Metadata ────────────────────────────────────────────────
  /** Which analysis domain produced this growth area */
  domain: z.string(),

  /**
   * Freeform LLM-generated category tags for team-level clustering.
   * NOT constrained to a fixed taxonomy — the LLM picks descriptive tags.
   * Examples: ["error-handling", "test-coverage", "express-middleware"]
   *
   * Populated during analysis; used by team aggregation for cross-developer
   * pattern detection with natural clustering.
   */
  categoryTags: z.array(z.string()).optional(),

  /**
   * Flag for growth areas with sparse evidence.
   * Set when evidence count is at the minimum (2) or when confidence
   * in the pattern is low. Never produce empty reports — flag instead.
   */
  lowConfidence: z.boolean().optional(),

  // ── Preview fields (free tier gating) ────────────────────────────────
  /** Truncated pattern description for free tier blur teaser */
  descriptionPreview: z.string().optional(),
  /** Truncated action instruction for free tier blur teaser */
  actionPreview: z.string().optional(),
});
export type GrowthAreaPEA = z.infer<typeof GrowthAreaPEASchema>;

// ============================================================================
// LLM Structured Output Schema (for Claude/Gemini structured output)
// ============================================================================

/**
 * Structured output schema for LLM generation of PEA growth areas.
 *
 * This is the schema passed to the LLM's structured output mode.
 * It excludes post-processing fields (kbTip, qualityRubric) that
 * are added after LLM generation.
 *
 * Gemini nesting depth: L1(root) → L2(growthArea) → L3(pattern|action|moment) = safe
 */
export const GrowthAreaPEALLMOutputSchema = z.object({
  /** The observed behavioral pattern */
  pattern: PEAPatternSchema,

  /**
   * 2-8 distinct moments from session event data demonstrating the pattern.
   *
   * VERBATIM REQUIREMENT: Each moment's `quote` field MUST be copied
   * character-for-character from the extraction stage quotes array
   * (`quotes[n].text`). The LLM must not paraphrase, summarize, or
   * clean up developer quotes — they are evidence anchors that must
   * match the actual session event data.
   *
   * DISTINCTNESS REQUIREMENT: Each moment must have a unique utteranceId.
   * Moments from different sessions (distinct sessionId values) are preferred
   * as they prove the pattern recurs across work — same-session evidence
   * is valid but triggers `lowConfidence: true`.
   */
  evidence: z.array(DistinctMomentSchema).min(2).max(8),

  /** Concrete next-session action */
  action: PEAActionSchema,

  /** Which analysis domain this belongs to */
  domain: z.string(),

  /** Freeform category tags for team clustering */
  categoryTags: z.array(z.string()).min(1).max(5),

  /**
   * Low-confidence flag — set when evidence is at the minimum (2 moments)
   * or all from a single session. Never produce an empty report; flag instead.
   */
  lowConfidence: z.boolean().optional(),
});
export type GrowthAreaPEALLMOutput = z.infer<typeof GrowthAreaPEALLMOutputSchema>;

// ============================================================================
// Team Aggregation Types
// ============================================================================

/**
 * Enhanced team-level growth area aggregate with PEA structure.
 *
 * Extends the existing TeamGrowthAreaAggregate concept with:
 *   - Freeform LLM-generated category tags (not fixed taxonomy)
 *   - Cross-developer pattern detection
 *   - Actionable team-level recommendations
 */
export const TeamGrowthAreaPEAAggregateSchema = z.object({
  /** Pattern title (shared across affected members) */
  patternTitle: z.string(),

  /** Analysis domain */
  domain: z.string(),

  /** Human-readable domain label */
  domainLabel: z.string(),

  /** Highest severity across affected members */
  predominantSeverity: PEASeveritySchema,

  /** How many team members exhibit this pattern */
  memberCount: z.number().min(1),

  /** Names of affected team members */
  affectedMembers: z.array(z.string()),

  /**
   * Freeform LLM-generated category tags aggregated from individual
   * growth areas. De-duplicated and frequency-ranked.
   */
  categoryTags: z.array(z.string()),

  /**
   * Actionable team-level recommendation a manager could implement.
   * Must be specific enough to act on (e.g., "Schedule a 1-hour workshop
   * on Express error handling patterns" not "Improve error handling").
   *
   * Rubric: team_actionability
   */
  teamRecommendation: z.string(),

  /** Sample evidence summary from the most affected member */
  sampleEvidenceSummary: z.string(),

  /** Per-member severity breakdown for the heatmap/detail view */
  memberSeverities: z.array(z.object({
    memberName: z.string(),
    severity: PEASeveritySchema,
  })),

  /** Best-match KB tip from among individual members' tips (if any) */
  kbTip: KbTipAttachmentSchema.optional(),

  /**
   * Best-match knowledge tip — canonical display field for team-level growth area cards.
   * Populated from the highest-relevance individual member kbTip during aggregation.
   * Absent if no member had a qualifying KB tip above the threshold.
   */
  knowledgeTip: KbTipAttachmentSchema.optional(),
});
export type TeamGrowthAreaPEAAggregate = z.infer<typeof TeamGrowthAreaPEAAggregateSchema>;

// ============================================================================
// Backward Compatibility Converters
// ============================================================================

/**
 * Convert a PEA growth area to the legacy DomainGrowthArea format.
 *
 * Used by downstream consumers that haven't been updated to PEA yet.
 * Maps:
 *   pattern.title → title
 *   pattern.description → description
 *   pattern.severity → severity
 *   action.instruction → recommendation
 *   evidence[].{utteranceId, quote, context} → evidence[]
 */
export function peaToDomainGrowthArea(pea: GrowthAreaPEA): {
  title: string;
  description: string;
  severity: PEASeverity;
  recommendation: string;
  evidence: Array<{ utteranceId: string; quote: string; context?: string; sessionId?: string; behaviorDescription?: string }>;
  evidenceMoments: Array<{ utteranceId: string; sessionId: string; quote: string; behaviorDescription: string; context?: string }>;
  verifiableAction: { action: string; checkDescription: string; toolOrPattern?: string };
  lowConfidence?: boolean;
  categoryTags?: string[];
} {
  return {
    title: pea.pattern.title,
    description: pea.pattern.description,
    severity: pea.pattern.severity,
    recommendation: pea.action.instruction,
    evidence: pea.evidence.map(m => ({
      utteranceId: m.utteranceId,
      quote: m.quote,
      context: m.context,
      sessionId: m.sessionId,
      behaviorDescription: m.observation,
      ...(m.timestamp ? { timestamp: m.timestamp } : {}),
    })),
    evidenceMoments: pea.evidence.map(m => ({
      utteranceId: m.utteranceId,
      sessionId: m.sessionId,
      quote: m.quote,
      behaviorDescription: m.observation,
      context: m.context,
      ...(m.timestamp ? { timestamp: m.timestamp } : {}),
    })),
    // Map PEA action to VerifiableAction format for legacy consumers
    verifiableAction: {
      action: pea.action.instruction,
      checkDescription: pea.action.verificationCheck,
      toolOrPattern: pea.pattern.toolsFilesApis[0],
    },
    lowConfidence: pea.lowConfidence,
    // Freeform LLM-generated behavioral category tags for team clustering
    ...(pea.categoryTags?.length ? { categoryTags: pea.categoryTags } : {}),
  };
}

/**
 * Convert a PEA growth area to the legacy WorkerGrowth format.
 *
 * Used by worker pipeline consumers that expect WorkerGrowth objects.
 * Maps:
 *   pattern.title → title
 *   pattern.description → description
 *   pattern.severity → severity
 *   action.instruction → recommendation
 *   evidence[].{utteranceId, quote, context} → evidence[]
 */
export function peaToWorkerGrowth(pea: GrowthAreaPEA): {
  title: string;
  description: string;
  evidence: Array<{ utteranceId: string; quote: string; context?: string; sessionId?: string; behaviorDescription?: string }>;
  evidenceMoments: Array<{ utteranceId: string; sessionId: string; quote: string; behaviorDescription: string; context?: string }>;
  recommendation: string;
  severity?: PEASeverity;
  verifiableAction: { action: string; checkDescription: string; toolOrPattern?: string };
  lowConfidence?: boolean;
  toolsFilesApis?: string[];
  actionGoalRelevance?: string;
  categoryTags?: string[];
  kbTip?: KbTipAttachment;
} {
  return {
    title: pea.pattern.title,
    description: pea.pattern.description,
    evidence: pea.evidence.map(m => ({
      utteranceId: m.utteranceId,
      quote: m.quote,
      context: m.context,
      sessionId: m.sessionId,
      behaviorDescription: m.observation,
      ...(m.timestamp ? { timestamp: m.timestamp } : {}),
    })),
    evidenceMoments: pea.evidence.map(m => ({
      utteranceId: m.utteranceId,
      sessionId: m.sessionId,
      quote: m.quote,
      behaviorDescription: m.observation,
      context: m.context,
      ...(m.timestamp ? { timestamp: m.timestamp } : {}),
    })),
    recommendation: pea.action.instruction,
    severity: pea.pattern.severity,
    // Map PEA action to VerifiableAction format for worker pipeline consumers
    verifiableAction: {
      action: pea.action.instruction,
      checkDescription: pea.action.verificationCheck,
      toolOrPattern: pea.pattern.toolsFilesApis[0],
    },
    lowConfidence: pea.lowConfidence,
    // PEA display fields — thread through for rich UI rendering
    toolsFilesApis: pea.pattern.toolsFilesApis,
    actionGoalRelevance: pea.action.goalRelevance,
    // Freeform LLM-generated behavioral category tags for team clustering
    ...(pea.categoryTags?.length ? { categoryTags: pea.categoryTags } : {}),
    // KB tip — one best-match tip per growth area, attached by deterministic matcher
    ...(pea.kbTip ? { kbTip: pea.kbTip } : {}),
  };
}

/**
 * Convert a PEA growth area to the legacy MemberGrowthArea format.
 *
 * Used by enterprise dashboard consumers.
 */
export function peaToMemberGrowthArea(pea: GrowthAreaPEA): {
  title: string;
  domain: string;
  severity: PEASeverity;
  recommendation: string;
  evidenceMoments: Array<{ sessionId: string; quote: string; behaviorDescription: string }>;
  lowConfidence?: boolean;
  /**
   * Why this growth area matters for the builder's specific goals.
   * Connects the pattern to their actual project context, technology stack,
   * or stated objectives — not abstract best practices.
   *
   * AC 5: Every growth area must explain WHY the pattern matters for
   * what the builder is trying to achieve.
   */
  goalRelevance: string;
  categoryTags?: string[];
  toolsFilesApis?: string[];
  /**
   * Best-match knowledge tip from deterministic KB matcher.
   * Populated when the source GrowthAreaPEA has a kbTip above the relevance threshold.
   * Threaded through so enterprise/team views can display the tip without re-matching.
   */
  knowledgeTip?: KbTipAttachment;
} {
  return {
    title: pea.pattern.title,
    domain: pea.domain,
    severity: pea.pattern.severity,
    recommendation: pea.action.instruction,
    evidenceMoments: pea.evidence.map(m => ({
      sessionId: m.sessionId,
      quote: m.quote,
      behaviorDescription: m.observation,
      ...(m.timestamp ? { timestamp: m.timestamp } : {}),
    })),
    lowConfidence: pea.lowConfidence,
    // AC 5: Why this pattern matters for the builder's specific goals
    goalRelevance: pea.action.goalRelevance,
    // Freeform LLM-generated behavioral category tags for team clustering
    ...(pea.categoryTags?.length ? { categoryTags: pea.categoryTags } : {}),
    // Specific tools/files/APIs for tool_file_naming rubric
    toolsFilesApis: pea.pattern.toolsFilesApis,
    // KB tip threaded through from PEA enrichment (knowledgeTip is canonical display name)
    ...(pea.kbTip ? { knowledgeTip: pea.kbTip } : {}),
    ...(pea.knowledgeTip ? { knowledgeTip: pea.knowledgeTip } : {}),
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Result of evidence distinctness validation.
 *
 * Used by both the PEA quality rubric (generation-time gate) and the
 * save-domain-results quality gate (storage-time gate) to enforce the
 * minimum evidence threshold.
 */
export interface EvidenceDistinctnessResult {
  /** Whether evidence meets the minimum distinctness threshold */
  valid: boolean;
  /** Whether evidence is sparse enough to warrant a lowConfidence flag */
  lowConfidence: boolean;
  /** Number of distinct utterance IDs (must be >= 2) */
  distinctUtteranceCount: number;
  /** Number of distinct session IDs (1 = single-session, may flag lowConfidence) */
  distinctSessionCount: number;
  /** Human-readable reason if validation fails */
  reason?: string;
}

/**
 * Validate that evidence moments meet the minimum distinctness threshold.
 *
 * A growth area must demonstrate a **pattern**, not a one-off incident.
 * This requires:
 *   - At least 2 evidence moments (structural — also enforced by Zod .min(2))
 *   - At least 2 **distinct** utterance IDs (not the same moment cited twice)
 *   - Ideally from 2+ distinct sessions (single-session evidence is flagged
 *     as lowConfidence but not rejected — same-session patterns are still valid)
 *
 * This function is used by:
 *   - `evaluateQualityRubric()` for the distinct_moments criterion
 *   - `validateContentQuality()` in save-domain-results for storage gating
 *
 * @param moments - Array of evidence moments to validate
 * @returns EvidenceDistinctnessResult with validation outcome
 */
export function validateDistinctEvidence(
  moments: ReadonlyArray<{ utteranceId: string; sessionId: string }>,
): EvidenceDistinctnessResult {
  // Baseline: need at least 2 moments total
  if (moments.length < 2) {
    return {
      valid: false,
      lowConfidence: true,
      distinctUtteranceCount: new Set(moments.map(m => m.utteranceId)).size,
      distinctSessionCount: new Set(moments.map(m => m.sessionId)).size,
      reason: `Need at least 2 evidence moments to establish a pattern (have ${moments.length}).`,
    };
  }

  const distinctUtteranceIds = new Set(moments.map(m => m.utteranceId));
  const distinctSessionIds = new Set(moments.map(m => m.sessionId));

  // Hard gate: must have 2+ distinct utterance IDs
  // (same utteranceId repeated = same exact moment cited twice = not a pattern)
  if (distinctUtteranceIds.size < 2) {
    return {
      valid: false,
      lowConfidence: true,
      distinctUtteranceCount: distinctUtteranceIds.size,
      distinctSessionCount: distinctSessionIds.size,
      reason: `Evidence moments reference only ${distinctUtteranceIds.size} distinct utterance(s). Need at least 2 distinct moments (different utteranceIds) to establish a pattern, not the same moment cited multiple times.`,
    };
  }

  // Soft flag: single-session evidence is valid but lowConfidence
  // (a pattern within one session is still a pattern, but cross-session
  // evidence is much stronger proof of a recurring behavior)
  const isSingleSession = distinctSessionIds.size < 2;

  return {
    valid: true,
    lowConfidence: isSingleSession || moments.length <= 2,
    distinctUtteranceCount: distinctUtteranceIds.size,
    distinctSessionCount: distinctSessionIds.size,
    reason: isSingleSession
      ? `All ${moments.length} evidence moments come from the same session. Cross-session evidence is stronger proof of a recurring pattern.`
      : undefined,
  };
}

// ============================================================================
// Tool / File / API Recognition Patterns
// ============================================================================

/**
 * Patterns that match specific tool, file, API, or technology names.
 *
 * Used by the tool_file_naming rubric criterion to validate that growth area
 * titles and toolsFilesApis entries reference real, recognizable tools —
 * not vague placeholders like "the tool" or "some API".
 *
 * Categories:
 * - Claude Code tools (Read, Edit, Grep, Glob, Bash, Write, Task, etc.)
 * - Build/test CLI tools (npm, vitest, jest, pytest, cargo, docker, etc.)
 * - Frameworks and libraries (Express, React, Next.js, Prisma, etc.)
 * - File names and path patterns (*.ts, package.json, CLAUDE.md, etc.)
 * - API and service names (Stripe, OpenAI, GitHub API, etc.)
 * - Slash commands (/plan, /compact, /review, etc.)
 */
export const TOOL_FILE_API_PATTERNS: RegExp[] = [
  // Claude Code tools (appear as tool_use blocks in session logs)
  /\b(Read|Edit|Grep|Glob|Bash|Write|Task|TodoWrite|WebSearch|WebFetch|MultiEdit|NotebookEdit)\b/,
  // Slash commands
  /\/(plan|compact|clear|review|commit|test|help|init)\b/,
  // Build/test CLI tools
  /\b(npm|npx|yarn|pnpm|git|vitest|jest|pytest|cargo|make|docker|curl|webpack|vite|eslint|prettier|tsc|tsx|pip|poetry|terraform|kubectl|helm|ansible)\b/,
  // Programming languages (when named as technology, not as generic words)
  /\b(Python|TypeScript|JavaScript|Rust|Go|Java|Ruby|Swift|Kotlin|C\+\+|C#|Elixir|Haskell|Scala)\b/,
  // Common frameworks and libraries (case-sensitive for precision)
  /\b(Express|React|Next\.js|Prisma|Drizzle|Tailwind|Zod|PostgreSQL|MongoDB|Redis|GraphQL|REST|Vue|Angular|Svelte|Django|Flask|FastAPI|Spring|Rails)\b/i,
  // React ecosystem (hooks, common libraries)
  /\b(useMemo|useCallback|useEffect|useState|useRef|useContext|React\.memo|Recharts|Chart\.js|D3|react-query|zustand|redux)\b/,
  // Python ecosystem (data science, web, packages)
  /\b(pandas|numpy|pathlib|asyncio|FastAPI|SQLAlchemy|Alembic|celery|airflow|dbt|Great Expectations)\b/,
  // DevOps and IaC tools
  /\b(Terraform|Kubernetes|Ansible|Helm|Pulumi|CloudFormation|ArgoCD|Jenkins|CircleCI|Datadog|Prometheus|Grafana)\b/,
  // Specific file names (common config/doc files)
  /\b(CLAUDE\.md|package\.json|tsconfig\.json|\.env|README\.md|Dockerfile|Makefile|\.gitignore)\b/,
  // File paths with extensions (e.g., middleware/auth.ts, src/api/routes.ts)
  /\b[\w/-]+\.(ts|tsx|js|jsx|py|rs|go|java|rb|sql|yaml|yml|toml|json|md|css|scss|html)\b/,
  // API and service names
  /\b(Stripe|OpenAI|Anthropic|GitHub|AWS|GCP|Azure|Supabase|Vercel|Netlify|Firebase)\b/,
  // Database and ORM tools
  /\b(SQLite|MySQL|Postgres|DynamoDB|Mongoose|Sequelize|Knex|TypeORM|Drizzle)\b/i,
  // Generic but specific-enough technology names
  /\b(middleware|webhook|API endpoint|REST API|GraphQL query|database migration|schema)\b/i,
];

/**
 * Check whether a text string contains at least one recognizable tool, file,
 * API, or technology reference.
 *
 * Used for validating:
 * - Growth area titles name specific technologies
 * - toolsFilesApis entries look like real tools (not generic strings)
 * - Description text references actual tools the builder interacted with
 *
 * @param text - Text to scan for tool/file/API references
 * @returns true if at least one recognizable reference found
 */
export function containsToolFileApiReference(text: string): boolean {
  return TOOL_FILE_API_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Validate that a toolsFilesApis entry looks like a real tool, file, or API name.
 *
 * Rejects vague entries like "the tool", "some API", "a framework", or
 * single-character placeholder strings. Each entry must either:
 * - Match a known tool/file/API pattern, OR
 * - Be at least 2 characters long and not be a common English word
 *
 * @param entry - A single toolsFilesApis array entry
 * @returns true if the entry looks like a real tool/file/API reference
 */
export function isValidToolFileApiEntry(entry: string): boolean {
  const trimmed = entry.trim();
  // Reject empty or single-char entries
  if (trimmed.length < 2) return false;
  // Reject vague placeholder entries
  const VAGUE_ENTRIES = /^(the tool|some (tool|api|framework|library)|a (tool|api|framework)|tool|api|framework|library|technology|unknown|n\/a|none|tbd)$/i;
  if (VAGUE_ENTRIES.test(trimmed)) return false;
  // Accept if it matches a known pattern
  if (containsToolFileApiReference(trimmed)) return true;
  // Accept entries that look like file paths, package names, or specific identifiers
  // (e.g., "auth.ts", "@prisma/client", "express-validator", "src/lib/utils")
  if (/[./@-]/.test(trimmed) || /^[A-Z]/.test(trimmed)) return true;
  // Accept entries >= 3 chars that aren't common English words (generous fallback)
  return trimmed.length >= 3;
}

/**
 * Patterns that indicate a verifiable action references observable session-log signals.
 * At least one must appear in the action instruction or verificationCheck for the
 * verifiable_action rubric criterion to pass.
 *
 * These map to things that actually appear in JSONL session logs:
 * - Tool names from tool_use blocks (Read, Edit, Grep, Glob, Bash, Write, Task, TodoWrite, WebSearch)
 * - Commands and slash-commands (/plan, /compact, npm, git, vitest, etc.)
 * - Prompt structural patterns (first message, constraint keywords, etc.)
 * - Session-level behaviors (session start, fresh session, etc.)
 */
const VERIFIABLE_SIGNAL_PATTERNS: RegExp[] = [
  // Claude Code tools (appear as tool_use blocks in session logs)
  // Includes MultiEdit and NotebookEdit for broader tool coverage
  /\b(Read|Edit|MultiEdit|Grep|Glob|Bash|Write|Task|TodoWrite|WebSearch|WebFetch|NotebookEdit)\b/,
  // Slash commands (appear in user messages)
  /\/(plan|compact|clear|review|commit|test|help)\b/,
  // CLI commands (appear in Bash tool_use) — includes Python quality tools
  /\b(npm|npx|git|vitest|jest|pytest|cargo|make|docker|curl|ruff|mypy|black|pylint|pre-commit|tsc|tsx)\b/,
  // File patterns (appear in tool_use arguments)
  /\b(CLAUDE\.md|package\.json|tsconfig|\.env|README)\b/,
  /\.\w{1,4}\b/, // file extensions like .ts, .tsx, .json, .md, .py, .rs
  // Prompt structure patterns (verifiable in user message content)
  /\b(first (message|prompt|3 messages)|session start|before (any|writing|coding|implementation))\b/i,
  // Behavioral sequence patterns (verifiable in message ordering)
  /\b(before|after|then|followed by|prior to)\b.*\b(tool_use|message|prompt|command|edit|change)\b/i,
  // Session-level patterns
  /\b(fresh session|new session|separate session|session contains|session log)\b/i,
  // Testing patterns
  /\b(test suite|test file|test case|unit test|integration test|run tests)\b/i,
  // tool_use block references (explicit JSONL session log artifact names)
  /\btool_use\b/i,
];

/**
 * Check whether a verifiable action references at least one observable
 * session-log signal (tool name, command, file reference, prompt pattern, etc.).
 *
 * This is the core of the verifiable_action rubric criterion: the action must
 * describe something that would produce a checkable artifact in session logs,
 * not a vague aspiration like "try to plan more".
 *
 * Examples that PASS:
 * - "Use /plan before implementation" → matches /plan slash command
 * - "Run vitest via Bash after each edit" → matches vitest CLI command and Bash tool
 * - "Create a test file before writing source code" → matches test file pattern
 *
 * Examples that FAIL:
 * - "Be more careful with error handling" → no observable signal
 * - "Try to plan more" → no tool/command/pattern reference
 * - "Improve your testing habits" → no specific tool or command
 *
 * @param instruction - The action instruction text
 * @param verificationCheck - How to verify in session logs
 * @returns true if at least one observable signal found
 */
export function hasObservableSignal(instruction: string, verificationCheck: string): boolean {
  const combined = `${instruction} ${verificationCheck}`;
  return VERIFIABLE_SIGNAL_PATTERNS.some(pattern => pattern.test(combined));
}

/**
 * Validate a PEA growth area against the quality rubric.
 *
 * Computes rubric criteria from the growth area content itself
 * (doesn't trust the LLM's self-assessment).
 *
 * verifiable_action criterion enforces THREE checks:
 * 1. Instruction length >= 50 chars (not a vague one-liner)
 * 2. Verification check length >= 30 chars (describes what to look for)
 * 3. Observable signal present — references tool names, commands, files,
 *    or behavioral patterns that appear in session logs. This prevents
 *    generic advice like "be more careful" from passing the gate.
 *
 * @param pea - LLM-generated PEA growth area (without rubric)
 * @returns Quality rubric with each criterion evaluated
 */
export function evaluateQualityRubric(pea: GrowthAreaPEALLMOutput): QualityRubric {
  // 1. distinct_moments: At least 2 moments with different utteranceIds
  //    Uses validateDistinctEvidence() for consistent enforcement across
  //    both generation-time (here) and storage-time (save-domain-results) gates.
  const evidenceResult = validateDistinctEvidence(pea.evidence);
  const distinctMoments = evidenceResult.valid;

  // 2. verifiable_action: Three-part check
  //    a) Action instruction is substantial (min 50 chars — not a vague one-liner)
  //    b) Verification check describes what to look for (min 30 chars)
  //    c) Combined text references at least one observable session-log signal
  //       (tool name, CLI command, file reference, prompt pattern, etc.)
  //       This prevents generic advice from passing the gate.
  const verifiableAction =
    pea.action.instruction.length >= 50 &&
    pea.action.verificationCheck.length >= 30 &&
    hasObservableSignal(pea.action.instruction, pea.action.verificationCheck);

  // 3. pattern_specificity: Pattern description references specific behavior
  //    Heuristic: title + description + evidence should not be generic
  //    Check that toolsFilesApis has at least one specific item
  const patternSpecificity =
    pea.pattern.toolsFilesApis.length >= 1 &&
    pea.pattern.description.length >= 100;

  // 4. tool_file_naming: Names specific tools, files, APIs, or technologies
  //    Three-part validation (ALL must pass):
  //    a) toolsFilesApis array has at least one entry
  //    b) At least one entry passes isValidToolFileApiEntry() — not a vague placeholder
  //    c) Title or description contains at least one recognizable tool/file/API reference
  //       This ensures the named technology appears in the visible growth area text,
  //       not just hidden in a metadata array the user might not see.
  const hasValidEntries = pea.pattern.toolsFilesApis.length >= 1 &&
    pea.pattern.toolsFilesApis.some(isValidToolFileApiEntry);
  const titleOrDescContainsTool =
    containsToolFileApiReference(pea.pattern.title) ||
    containsToolFileApiReference(pea.pattern.description);
  const toolFileNaming = hasValidEntries && titleOrDescContainsTool;

  return {
    distinctMoments,
    verifiableAction,
    patternSpecificity,
    toolFileNaming,
  };
}

/**
 * Process LLM output into a validated PEA growth area.
 *
 * Steps:
 * 1. Evaluate quality rubric
 * 2. Reject if rubric fails (returns null)
 * 3. Attach rubric to the growth area
 *
 * KB tip attachment happens separately (post-processing).
 *
 * @param llmOutput - Raw LLM-generated PEA growth area
 * @returns Validated GrowthAreaPEA or null if rubric fails
 */
export function processLLMOutputToPEA(
  llmOutput: GrowthAreaPEALLMOutput,
): GrowthAreaPEA | null {
  const rubric = evaluateQualityRubric(llmOutput);

  if (!passesQualityRubric(rubric)) {
    return null;
  }

  // Flag low confidence using evidence distinctness analysis.
  // validateDistinctEvidence() checks both moment count and session diversity,
  // so this captures: minimal evidence (<=2), single-session patterns, and
  // any LLM-flagged low confidence from sparse source data.
  const evidenceResult = validateDistinctEvidence(llmOutput.evidence);
  const lowConfidence = evidenceResult.lowConfidence || llmOutput.lowConfidence === true;

  return {
    pattern: llmOutput.pattern,
    evidence: llmOutput.evidence,
    action: llmOutput.action,
    qualityRubric: rubric,
    domain: llmOutput.domain,
    categoryTags: llmOutput.categoryTags,
    lowConfidence: lowConfidence || undefined,
  };
}

/**
 * Process a batch of LLM outputs, filtering to only those that pass the rubric.
 *
 * @param llmOutputs - Array of raw LLM-generated PEA growth areas
 * @returns Array of validated GrowthAreaPEA (rubric failures excluded)
 */
export function processLLMOutputBatchToPEA(
  llmOutputs: GrowthAreaPEALLMOutput[],
): GrowthAreaPEA[] {
  return llmOutputs
    .map(processLLMOutputToPEA)
    .filter((pea): pea is GrowthAreaPEA => pea !== null);
}

// ============================================================================
// Low-Confidence Helpers
// ============================================================================

/**
 * Reason categories for why a growth area is flagged as low-confidence.
 *
 * Used by the UI to display specific, actionable guidance about what
 * additional sessions would strengthen the evidence for this pattern.
 */
export type LowConfidenceReason =
  | 'single_session'
  | 'minimal_evidence'
  | 'single_session_minimal'
  | 'llm_flagged';

/**
 * Structured low-confidence detail for UI display.
 *
 * Contains:
 *   - reason: machine-readable category
 *   - label: short UI label (e.g., "Emerging Pattern")
 *   - message: full user-facing message explaining WHY and WHAT HELPS
 *   - distinctSessions: how many distinct sessions contributed evidence
 *   - distinctMoments: how many distinct evidence moments exist
 */
export interface LowConfidenceDetail {
  /** Machine-readable reason category */
  reason: LowConfidenceReason;
  /** Short UI label */
  label: string;
  /** Full user-facing message */
  message: string;
  /** Number of distinct sessions in evidence */
  distinctSessions: number;
  /** Number of distinct evidence moments */
  distinctMoments: number;
}

/**
 * Generate a human-readable low-confidence detail for a growth area.
 *
 * Analyzes the evidence moments to determine WHY the pattern is
 * low-confidence and generates specific guidance about what additional
 * sessions would help strengthen it.
 *
 * Returns null if the growth area is NOT low-confidence (sufficient evidence).
 *
 * @param evidence - Array of evidence moments from the growth area
 * @param llmFlaggedLowConfidence - Whether the LLM explicitly flagged this as low-confidence
 * @returns LowConfidenceDetail or null if not low-confidence
 */
export function getLowConfidenceDetail(
  evidence: ReadonlyArray<{ utteranceId: string; sessionId: string }>,
  llmFlaggedLowConfidence?: boolean,
): LowConfidenceDetail | null {
  const result = validateDistinctEvidence(evidence);

  // Not low-confidence — sufficient evidence from multiple sessions
  if (!result.lowConfidence && !llmFlaggedLowConfidence) {
    return null;
  }

  const isSingleSession = result.distinctSessionCount < 2;
  const isMinimalEvidence = evidence.length <= 2;

  if (isSingleSession && isMinimalEvidence) {
    return {
      reason: 'single_session_minimal',
      label: 'Emerging Pattern',
      message: `Observed in ${evidence.length} moment${evidence.length === 1 ? '' : 's'} from 1 session — more sessions needed to confirm this is a recurring pattern, not a one-off.`,
      distinctSessions: result.distinctSessionCount,
      distinctMoments: result.distinctUtteranceCount,
    };
  }

  if (isSingleSession) {
    return {
      reason: 'single_session',
      label: 'Emerging Pattern',
      message: `All ${evidence.length} evidence moments come from the same session. Observing this pattern across additional sessions would strengthen confidence that it's a recurring behavior.`,
      distinctSessions: result.distinctSessionCount,
      distinctMoments: result.distinctUtteranceCount,
    };
  }

  if (isMinimalEvidence) {
    return {
      reason: 'minimal_evidence',
      label: 'Emerging Pattern',
      message: `Based on only ${evidence.length} moments across ${result.distinctSessionCount} session${result.distinctSessionCount === 1 ? '' : 's'} — additional sessions will help confirm whether this is a consistent pattern.`,
      distinctSessions: result.distinctSessionCount,
      distinctMoments: result.distinctUtteranceCount,
    };
  }

  // LLM flagged but evidence looks adequate — respect the LLM's judgment
  // (e.g., sparse extraction data, ambiguous behavioral signals)
  return {
    reason: 'llm_flagged',
    label: 'Emerging Pattern',
    message: 'Pattern detected but evidence quality suggests more sessions are needed to confirm with higher confidence.',
    distinctSessions: result.distinctSessionCount,
    distinctMoments: result.distinctUtteranceCount,
  };
}

/**
 * Quick check: should a growth area be flagged as low-confidence?
 *
 * Convenience wrapper around getLowConfidenceDetail() for pipeline use
 * where you just need the boolean flag, not the full detail.
 *
 * @param evidence - Array of evidence moments
 * @param llmFlaggedLowConfidence - Whether the LLM flagged this
 * @returns true if the growth area should be flagged as low-confidence
 */
export function shouldFlagLowConfidence(
  evidence: ReadonlyArray<{ utteranceId: string; sessionId: string }>,
  llmFlaggedLowConfidence?: boolean,
): boolean {
  return getLowConfidenceDetail(evidence, llmFlaggedLowConfidence) !== null;
}

// ============================================================================
// Evidence Content Distinctness Validation (Sub-AC 2c)
// ============================================================================

// NOTE: Jaccard similarity is re-implemented here (not imported from
// canonical-analysis.ts) to avoid a circular dependency:
//   canonical-analysis.ts → schemas/index.ts → growth-area-pea.ts
// The implementation is kept intentionally identical to the one in
// canonical-analysis.ts so deduplication thresholds stay consistent.

/**
 * Word-level Jaccard similarity between two strings.
 * Module-private — used only by validateEvidenceContentDistinctness().
 */
function _tokenizeForContentCheck(text: string): string[] {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

function _quoteJaccardSimilarity(a: string, b: string): number {
  const tokensA = _tokenizeForContentCheck(a);
  const tokensB = _tokenizeForContentCheck(b);
  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const freqB = new Map<string, number>();
  for (const t of tokensB) freqB.set(t, (freqB.get(t) ?? 0) + 1);

  let intersection = 0;
  const used = new Map<string, number>();
  for (const t of tokensA) {
    const available = (freqB.get(t) ?? 0) - (used.get(t) ?? 0);
    if (available > 0) {
      intersection++;
      used.set(t, (used.get(t) ?? 0) + 1);
    }
  }

  const union = tokensA.length + tokensB.length - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Similarity thresholds for repeated-content detection.
 *
 * Same-session quotes are held to a lower threshold because the builder
 * may legitimately repeat phrasing within a single session turn sequence.
 * Cross-session quotes at high similarity almost always indicate the LLM
 * re-used the same quote rather than finding a distinct moment.
 *
 * Same-session threshold is 0.65 (not 0.7) to catch paraphrases like
 * "just add a try catch here to handle errors and move on" ↔
 * "just add try catch here to handle the error and keep going"
 * which share ~67% word overlap but are the same behavioral moment.
 */
const REPEATED_CONTENT_THRESHOLD_SAME_SESSION = 0.65;
const REPEATED_CONTENT_THRESHOLD_CROSS_SESSION = 0.8;

/**
 * Generic observation phrases that indicate a vague rather than specific
 * behavior description. These patterns produce observations that could
 * apply to any developer in any context, failing the distinct_moments criterion.
 *
 * Pattern design principle: catch SHORT label-type sentences (≤ ~8 words total)
 * that describe the problem generically without naming a specific tool, file,
 * command, or behavioral sequence. Long observations (> 35 chars after the
 * verb+adjective) are more likely to be specific even if they use these verbs.
 */
const GENERIC_OBSERVATION_PATTERNS: RegExp[] = [
  // Pure adjective+noun labels with no tool/file/tech context
  /^(bad|poor|wrong|incorrect|invalid|improper)\s+(error handling|testing|planning|code|approach)[\s.!]*$/i,
  // "Needs/need improvement" patterns
  /^(needs?|need)\s+(improvement|to improve|better|more|fixing)[\s.!]*$/i,
  // "Not testing/planning/..." patterns
  /^(not|doesn'?t?|did not)\s+(test|plan|verify|check|read|document)[\s.!]*$/i,
  // "Shows/demonstrates/indicates bad/poor [1-4 words]" — catches multi-word labels
  // up to ~35 chars after the verb+adjective to avoid false positives on specific descriptions
  /^(shows?|demonstrates?|indicates?)\s+(bad|poor|lack of|absence of)\s+\w[\w\s]{0,34}[\s.!]*$/i,
  // Developer-centric generic labels
  /^developer\s+(made|has|shows?)\s+(a\s+)?(mistake|error|issue|problem)\b[\s.!]*$/i,
  /^(this|the developer)\s+(shows?|demonstrates?)\s+(the\s+)?(pattern|problem|issue|behavior)[\s.!]*$/i,
  /^(suggests?|indicates?|implies?)\s+(poor|bad|weak|lack of)\b/i,
];

/**
 * Check if an observation/behaviorDescription is vague rather than specific.
 *
 * A weak observation labels the problem generically without describing
 * what specific behavior was demonstrated in that session moment.
 */
function _isWeakObservation(observation: string): boolean {
  if (observation.trim().length < 25) return true;
  return GENERIC_OBSERVATION_PATTERNS.some(p => p.test(observation.trim()));
}

/**
 * Check if a context field references at least one concrete session anchor.
 *
 * Per the PEA format specification, every context must include at least one:
 *   (a) tool name (Read, Edit, Bash, npm, git, etc.) via containsToolFileApiReference()
 *   (b) file path (middleware/auth.ts, package.json, etc.) via containsToolFileApiReference()
 *   (c) technology/API name (Express, Prisma, Stripe, etc.) via containsToolFileApiReference()
 *   (d) project-name-like identifier (hyphenated or CamelCase) as fallback
 *
 * Note: We intentionally allow project-name patterns (hyphenated identifiers) as
 * a fallback because project names won't match TOOL_FILE_API_PATTERNS but ARE
 * concrete anchors that ground the context in the actual session.
 */
function _hasConcreteContextAnchor(context: string): boolean {
  // Primary: recognizable tool, file path, technology, API, or CLI command
  if (containsToolFileApiReference(context)) return true;

  // Fallback: project-name-like identifier (e.g. "payment-api", "my-project",
  // "UserDashboard", "BetterPrompt"). These won't match the tool patterns
  // but are still concrete session anchors.
  const projectNamePattern = /\b[a-z][a-z0-9]*(-[a-z][a-z0-9]*)+\b|\b[A-Z][a-z]+[A-Z][a-z]+\b/;
  return projectNamePattern.test(context);
}

/**
 * A content quality issue detected in a single evidence moment.
 *
 * Each issue identifies:
 *   - Which moment is problematic (by index and utteranceId)
 *   - What type of content problem was found
 *   - A human-readable message explaining the problem and how to fix it
 *   - (For repeated_content) which other moment it is similar to
 */
export interface EvidenceContentIssue {
  /** Zero-based index of the problematic moment in the evidence array */
  momentIndex: number;
  /** utteranceId of the problematic moment */
  utteranceId: string;
  /** Type of content problem detected */
  issueType: 'repeated_content' | 'generic_context' | 'weak_observation';
  /**
   * Human-readable explanation of the problem and how to fix it.
   * Designed to be actionable retry guidance — the LLM writer reads
   * this when save-domain-results returns a quality_error.
   */
  message: string;
  /** For repeated_content: index of the earlier moment this is similar to */
  similarToIndex?: number;
  /** For repeated_content: Jaccard similarity score (0-1) */
  similarity?: number;
}

/**
 * Result of evidence content distinctness validation.
 *
 * Checks the full evidence array for three types of content problems:
 *   1. repeated_content — near-identical quotes (even with different utteranceIds)
 *   2. generic_context  — context fields with no concrete session anchors
 *   3. weak_observation — observations that don't describe specific behavior
 *
 * A growth area is valid only when:
 *   - Zero repeated-content issues (any repetition invalidates distinctness)
 *   - Fewer than half the moments have generic context
 *   - Fewer than half the moments have weak observations
 *
 * Never-produce-empty-reports policy: individual weak moments don't block
 * the growth area unless they dominate the evidence. One strong moment
 * alongside one weak moment is accepted (weak moment gets flagged).
 */
export interface EvidenceContentDistinctnessResult {
  /** Whether the evidence passes all content distinctness checks */
  valid: boolean;
  /** Per-moment issues for actionable retry feedback */
  issues: EvidenceContentIssue[];
  /** Number of moments rejected for near-identical content */
  repeatedContentCount: number;
  /** Number of moments flagged for generic context */
  genericContextCount: number;
  /** Number of moments flagged for weak observation */
  weakObservationCount: number;
}

/**
 * Post-generation validation step: checks each growth area's evidence array
 * for genuinely distinct moment references.
 *
 * Enforces three evidence quality requirements from the PEA specification:
 *
 * ### 1. No Repeated Content
 * Evidence moments with near-identical quote text (≥ 70-80% word Jaccard
 * similarity) are rejected as "repeated evidence" even when they carry
 * different utteranceIds. This catches the common LLM pattern of re-using
 * the same quote with slightly modified IDs or minor paraphrasing.
 *
 * Thresholds:
 *   - Same session: 70% similarity → blocked (same-session quotes are
 *     naturally more similar; lower threshold is still conservative)
 *   - Cross-session: 80% similarity → blocked (near-verbatim across
 *     sessions means re-use, not coincidental phrasing overlap)
 *
 * ### 2. Concrete Context Anchors
 * Every `context` field must reference at least one concrete session anchor:
 *   - A recognizable tool name (Read, Edit, Bash, npm, git, vitest)
 *   - A file path (middleware/auth.ts, package.json)
 *   - A technology or API name (Express, Prisma, Stripe)
 *   - A project-name-like identifier (payment-api, UserDashboard)
 *
 * Generic descriptions like "working on a backend task" or "debugging an
 * issue" fail this check because they could describe any session.
 *
 * ### 3. Specific Observations
 * The `observation` (or `behaviorDescription`) must name the specific
 * behavior demonstrated — not just label the problem with vague language.
 * Observations under 25 chars or matching generic templates are rejected.
 *
 * This function is called by the `save-domain-results` quality gate to
 * reject low-quality evidence before persistence. When it returns issues,
 * the write skills receive actionable error messages and retry.
 *
 * @param moments - Evidence array to validate (supports both PEA and flat formats)
 * @returns Detailed result with per-moment diagnostics for retry guidance
 */
export function validateEvidenceContentDistinctness(
  moments: ReadonlyArray<{
    utteranceId: string;
    sessionId: string;
    quote: string;
    context: string;
    observation: string;
  }>,
): EvidenceContentDistinctnessResult {
  const issues: EvidenceContentIssue[] = [];
  let repeatedContentCount = 0;
  let genericContextCount = 0;
  let weakObservationCount = 0;

  for (let i = 0; i < moments.length; i++) {
    const moment = moments[i];

    // ── 1. Repeated-content check ─────────────────────────────────────────
    // Compare this moment's quote against all earlier moments.
    // Stop at the first detected repetition (report once per problematic moment).
    let foundRepeat = false;
    for (let j = 0; j < i; j++) {
      if (foundRepeat) break;
      const earlier = moments[j];
      const sameSess = moment.sessionId === earlier.sessionId;
      const threshold = sameSess
        ? REPEATED_CONTENT_THRESHOLD_SAME_SESSION
        : REPEATED_CONTENT_THRESHOLD_CROSS_SESSION;
      const similarity = _quoteJaccardSimilarity(moment.quote, earlier.quote);

      if (similarity >= threshold) {
        repeatedContentCount++;
        foundRepeat = true;
        issues.push({
          momentIndex: i,
          utteranceId: moment.utteranceId,
          issueType: 'repeated_content',
          message:
            `Evidence moment [${i}] (utteranceId: "${moment.utteranceId}") shares ` +
            `${Math.round(similarity * 100)}% word similarity with moment [${j}] ` +
            `(utteranceId: "${earlier.utteranceId}"). ` +
            `Repeated quotes — even with different utteranceIds — do not establish ` +
            `a pattern. Fix: replace with a genuinely distinct quote from a DIFFERENT ` +
            `session turn that shows the same behavioral pattern from a new angle ` +
            `(e.g., a consequence of the first behavior, or the same behavior in a ` +
            `different project context). Check quotes[n].utteranceId to confirm ` +
            `the replacement comes from a different turn in the extraction data.`,
          similarToIndex: j,
          similarity,
        });
      }
    }

    // ── 2. Generic context check ──────────────────────────────────────────
    if (!_hasConcreteContextAnchor(moment.context)) {
      genericContextCount++;
      const truncatedContext = moment.context.length > 80
        ? `${moment.context.slice(0, 80)}...`
        : moment.context;
      issues.push({
        momentIndex: i,
        utteranceId: moment.utteranceId,
        issueType: 'generic_context',
        message:
          `Evidence moment [${i}] (utteranceId: "${moment.utteranceId}") has a generic ` +
          `context that does not reference any concrete session anchor: "${truncatedContext}". ` +
          `Fix: context MUST include at least one of: ` +
          `(a) tool name from quotes[n].toolCallsBefore — e.g., "after Read then Bash calls", ` +
          `(b) project name from quotes[n].projectName — e.g., "in the payment-api project", ` +
          `(c) specific file path or technology from the quote text — e.g., ` +
          `"editing middleware/stripe.ts" or "while running npm test". ` +
          `BAD: "working on a backend task". ` +
          `GOOD: "in the payment-api project, after Read then Bash on middleware/stripe.ts".`,
      });
    }

    // ── 3. Weak observation check ─────────────────────────────────────────
    if (_isWeakObservation(moment.observation)) {
      weakObservationCount++;
      const truncatedObs = moment.observation.length > 80
        ? `${moment.observation.slice(0, 80)}...`
        : moment.observation;
      issues.push({
        momentIndex: i,
        utteranceId: moment.utteranceId,
        issueType: 'weak_observation',
        message:
          `Evidence moment [${i}] (utteranceId: "${moment.utteranceId}") has a weak ` +
          `observation that does not describe the specific behavior demonstrated: ` +
          `"${truncatedObs}". ` +
          `Fix: observation must name the SPECIFIC behavior — the tool used, command ` +
          `run, or interaction pattern — and why it matters for the pattern. ` +
          `BAD: "shows bad error handling" or "not testing" (generic labels). ` +
          `GOOD: "wrapped failing Stripe webhook handler in a generic catch block ` +
          `without writing a jest test for the error path first — the catch silently ` +
          `swallows the validation error".`,
      });
    }
  }

  // ── Validity determination ────────────────────────────────────────────────
  // Any repeated content = hard reject (distinctness is fundamentally broken).
  // Generic context or weak observations = soft: block only when they dominate
  // (majority of moments). One weak moment alongside strong ones is acceptable
  // — the growth area still has substance. The policy: never produce empty
  // reports; reject only when evidence quality is broadly compromised.
  const majority = Math.ceil(moments.length / 2);
  const valid =
    repeatedContentCount === 0 &&
    genericContextCount < majority &&
    weakObservationCount < majority;

  return {
    valid,
    issues,
    repeatedContentCount,
    genericContextCount,
    weakObservationCount,
  };
}
