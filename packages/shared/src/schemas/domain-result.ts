/**
 * Domain Result Schema
 *
 * Expanded DomainResult with typed domain-specific data,
 * replacing the previous Record<string, unknown> catch-all.
 *
 * @module @betterprompt/shared/schemas/domain-result
 */

import { z } from 'zod';
import { Phase1SessionMetricsSchema } from './phase1-output.js';
import { DeterministicScoresSchema, DeterministicTypeResultSchema } from './deterministic-scores.js';
import { KbTipAttachmentSchema, PEAPatternSchema, DistinctMomentSchema, PEAActionSchema } from './growth-area-pea.js';

// ============================================================================
// Evidence Schema (shared across all domains)
// ============================================================================

export const EvidenceSchema = z.object({
  utteranceId: z.string(),
  quote: z.string(),
  context: z.string().optional(),
  /** Explicit session ID for multi-session evidence grouping (v2) */
  sessionId: z.string().optional(),
  /** What behavior the developer exhibited in this moment (v2) */
  behaviorDescription: z.string().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

// ============================================================================
// Evidence Moment Schema (v2 — Pattern→Evidence→Action format)
// ============================================================================

/**
 * Rich evidence moment for Pattern→Evidence→Action growth areas.
 *
 * Unlike the base EvidenceSchema where sessionId and behaviorDescription
 * are optional (backward compat), EvidenceMomentSchema requires all fields.
 * Each moment captures a distinct exchange from a specific session that
 * demonstrates the growth pattern.
 *
 * Required fields:
 * - sessionId: Which session this moment comes from
 * - quote: The developer's exact words (direct quote)
 * - behaviorDescription: What behavior this moment demonstrates
 * - utteranceId: Links back to the original utterance for verification
 */
export const EvidenceMomentSchema = z.object({
  /** Utterance ID for source verification (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),
  /** Explicit session ID — enables grouping evidence by session and verifying distinct sessions */
  sessionId: z.string(),
  /** Direct quote from the developer's message */
  quote: z.string(),
  /** What behavior the developer exhibited — describes the pattern this moment demonstrates */
  behaviorDescription: z.string(),
  /** Brief context label (optional, for UI badges like "debugging", "reviewing") */
  context: z.string().optional(),
  /**
   * ISO 8601 timestamp of the session moment (from UserUtterance.timestamp).
   * Enables temporal verification of distinctness: moments from the same
   * timestamp are likely the same exchange, not independent evidence.
   * Also enables chronological ordering of evidence in reports and
   * cross-referencing with session JSONL logs by time.
   */
  timestamp: z.string().optional(),
});
export type EvidenceMoment = z.infer<typeof EvidenceMomentSchema>;

// ============================================================================
// Verifiable Action Schema (v2 — session-log-checkable next-session actions)
// ============================================================================

/**
 * Verifiable next-session action for a growth area.
 *
 * Each growth area must propose a concrete action the developer can take
 * in their NEXT session, specific enough to verify by checking future
 * session logs. The action describes WHAT to do, and the check describes
 * the observable signal a reviewer (or automated system) would look for
 * in subsequent session logs to confirm the action was attempted.
 *
 * Quality rubric criterion: verifiable_action
 * - Action is concrete enough to verify by checking future session logs
 * - References specific tools, commands, prompt patterns, or behaviors
 * - Describes a single, focused behavior change (not a vague aspiration)
 *
 * @example
 * {
 *   action: "In your next session, begin by using /plan or TodoWrite to outline task structure before writing any implementation code.",
 *   checkDescription: "First 3 messages contain /plan invocation or TodoWrite tool_use block with task breakdown.",
 *   toolOrPattern: "/plan command or TodoWrite tool"
 * }
 */
export const VerifiableActionSchema = z.object({
  /** Concrete action to take in the next session (min 50 chars) */
  action: z.string().min(50),
  /**
   * How to verify this action was taken by checking session logs (min 30 chars).
   * Must describe an observable signal: tool_use blocks, specific keywords in
   * user messages, prompt structure patterns, or behavioral sequences.
   */
  checkDescription: z.string().min(30),
  /**
   * The specific tool, command, file, API, or behavioral pattern this action
   * targets. Used for cross-referencing with session log tool_use events.
   * Examples: "/plan command", "Grep tool", "test suite execution via Bash",
   * "CLAUDE.md constraints", "TodoWrite task decomposition"
   */
  toolOrPattern: z.string().optional(),
});
export type VerifiableAction = z.infer<typeof VerifiableActionSchema>;

// ============================================================================
// Strength / Growth Area Schemas
// ============================================================================

export const DomainStrengthSchema = z.object({
  title: z.string(),
  description: z.string().min(100),
  evidence: z.array(EvidenceSchema).min(1),
});
export type DomainStrength = z.infer<typeof DomainStrengthSchema>;

export const DomainGrowthAreaSchema = z.object({
  title: z.string(),
  description: z.string().min(100),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  recommendation: z.string().min(50),
  /** Legacy evidence array — backward compatible, accepts base EvidenceSchema items */
  evidence: z.array(EvidenceSchema).min(1),
  /**
   * v2 evidence moments in Pattern→Evidence→Action format.
   * Each moment is a distinct exchange from a specific session with:
   * - sessionId: explicit session reference
   * - quote: the developer's exact words
   * - behaviorDescription: what behavior this moment demonstrates
   *
   * Minimum 2 moments required to establish a pattern (not a one-off).
   * When present, supersedes legacy `evidence` array for display.
   */
  evidenceMoments: z.array(EvidenceMomentSchema).min(2).optional(),
  /**
   * Low-confidence flag — set when evidence is sparse (fewer distinct
   * sessions than ideal). Reports should never be empty; instead they
   * surface this flag so the UI can show a confidence indicator.
   */
  lowConfidence: z.boolean().optional(),
  /**
   * Verifiable next-session action — a concrete behavior change
   * checkable against future session logs. Optional for backward
   * compatibility with old data; required by quality gate for new analyses.
   *
   * Quality rubric: verifiable_action criterion requires that the proposed
   * action is specific enough to verify by checking future session logs.
   * Actions that pass: "Use /plan before implementation" (checkable via tool_use).
   * Actions that fail: "Try to plan more" (not observable in logs).
   */
  verifiableAction: VerifiableActionSchema.optional(),
  /**
   * Why this growth area matters for what the builder is trying to achieve.
   * Connects the observed pattern to the builder's actual goals, not abstract
   * best practices. Must reference the builder's specific project context,
   * technology stack, or stated objectives.
   *
   * Evaluation criterion: goal_relevance
   * - Explains WHY the pattern matters for the builder's specific goals
   * - References the builder's actual project/technology/objective
   * - Not abstract advice like "this will make you more productive"
   *
   * Optional for backward compatibility with old data; required by quality
   * gate for new analyses.
   *
   * @example "Your Express API handles payment webhooks — untested error paths
   *           in middleware could silently drop Stripe events, causing revenue loss"
   */
  goalRelevance: z.string().min(30).optional(),
  /**
   * Specific tools, files, APIs, or technologies the builder actually interacted
   * with that are relevant to this growth area pattern.
   *
   * Examples: ["Express.js", "middleware/auth.ts", "Prisma ORM", "jest"]
   *
   * Rubric criterion: tool_file_naming — at least one entry required in new analyses.
   * Renders as tag pills in the Pattern section of PEA-format growth area cards.
   * Optional for backward compatibility with pre-PEA growth areas.
   */
  toolsFilesApis: z.array(z.string()).min(1).max(10).optional(),

  /**
   * Best-match knowledge base tip attached by the deterministic KB matcher.
   * Populated post-generation during report assembly — NOT LLM-generated.
   * Absent if no KB item exceeds the relevance threshold for this growth area.
   *
   * Includes source credibility signal for transparency.
   */
  kbTip: KbTipAttachmentSchema.optional(),

  /**
   * Best-match knowledge tip — canonical display field name.
   *
   * Functionally identical to `kbTip` but uses the canonical user-facing name
   * used by report renderers and UI components. Populated by the same
   * deterministic KB matcher as `kbTip`.
   *
   * Use `knowledgeTip` in new code; `kbTip` is the legacy internal field.
   */
  knowledgeTip: KbTipAttachmentSchema.optional(),
  /**
   * Freeform LLM-generated behavioral category tags for cross-developer
   * clustering in team views. NOT constrained to a fixed taxonomy — the
   * LLM picks descriptive tags during analysis.
   *
   * Examples: ["error-handling", "test-coverage", "express-middleware"]
   *
   * Populated when growth area originates from the PEA pipeline.
   * Used by team aggregation to detect shared patterns across developers
   * via tag overlap (2+ shared tags = same cluster).
   *
   * Optional for backward compatibility with pre-PEA growth areas.
   */
  categoryTags: z.array(z.string()).min(1).max(5).optional(),

  /**
   * Structured Pattern → Evidence → Action sub-object.
   *
   * Provides distinct, typed fields for the three parts of a growth area
   * instead of embedding them in freeform `description` and `recommendation`
   * text blobs. When present, the save-domain-results quality gate runs the
   * 4-criteria quality rubric (evaluateQualityRubric) on this structure.
   *
   * - pattern: The specific observed behavioral pattern with tools/files named
   * - evidence: 2-8 distinct moments from actual sessions (DistinctMomentSchema)
   * - action: Concrete next-session action verifiable in future session logs
   *
   * Optional for backward compatibility with data generated before PEA format.
   * Required by quality gate for all new growth areas from the PEA pipeline.
   *
   * Maps to the LLM output schema GrowthAreaPEALLMOutputSchema (shared package).
   */
  pea: z.object({
    /** The specific observed behavioral pattern */
    pattern: PEAPatternSchema,

    /**
     * 2-8 distinct moments from actual sessions demonstrating the pattern.
     * Uses DistinctMomentSchema (with `observation` field) rather than
     * EvidenceMomentSchema (with `behaviorDescription`) to maintain the
     * PEA vocabulary distinction at the schema level.
     */
    evidence: z.array(DistinctMomentSchema).min(2).max(8),

    /** Concrete next-session action with verifiable signal */
    action: PEAActionSchema,
  }).optional(),
});
export type DomainGrowthArea = z.infer<typeof DomainGrowthAreaSchema>;

// ============================================================================
// Domain Names
// ============================================================================

/**
 * Legacy 6-domain names — kept for backward compatibility with old runs.
 * New analyses use DOMAIN_NAMES (5-dimension framework).
 */
export const LEGACY_DOMAIN_NAMES = [
  'thinkingQuality',
  'communicationPatterns',
  'learningBehavior',
  'contextEfficiency',
  'sessionOutcome',
  'content',
] as const;

export type LegacyDomainName = typeof LEGACY_DOMAIN_NAMES[number];

/**
 * 5-dimension framework (v2):
 * - aiPartnership: merged AI Collaboration + AI Control
 * - sessionCraft: merged Context Engineering + Burnout Risk
 * - toolMastery: unchanged Tool Mastery
 * - skillResilience: unchanged Skill Resilience
 * - sessionMastery: NEW absence-of-anti-pattern scoring
 */
export const DOMAIN_NAMES = [
  'aiPartnership',
  'sessionCraft',
  'toolMastery',
  'skillResilience',
  'sessionMastery',
] as const;

export type DomainName = typeof DOMAIN_NAMES[number];

// ============================================================================
// Complete Domain Result Schema
// ============================================================================

export const DomainResultSchema = z.object({
  domain: z.enum([
    'aiPartnership',
    'sessionCraft',
    'toolMastery',
    'skillResilience',
    'sessionMastery',
    // Legacy domains accepted for backward compat with old runs
    'thinkingQuality',
    'communicationPatterns',
    'learningBehavior',
    'contextEfficiency',
    'sessionOutcome',
    'content',
  ]),
  overallScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1),
  strengths: z.array(DomainStrengthSchema),
  growthAreas: z.array(DomainGrowthAreaSchema),
  /** Domain-specific typed data. Validated per domain when available. */
  data: z.record(z.string(), z.unknown()).optional(),
  analyzedAt: z.string(),
});
export type DomainResult = z.infer<typeof DomainResultSchema>;

// ============================================================================
// Analysis Report (local plugin assembly)
// ============================================================================

export const AnalysisReportSchema = z.object({
  userId: z.string(),
  analyzedAt: z.string(),
  phase1Metrics: Phase1SessionMetricsSchema,
  deterministicScores: DeterministicScoresSchema,
  typeResult: DeterministicTypeResultSchema.nullable(),
  domainResults: z.array(DomainResultSchema),
  content: z.object({
    topFocusAreas: z.array(z.object({
      title: z.string(),
      narrative: z.string().optional(),
      description: z.string().optional(),
      actions: z.object({
        start: z.string(),
        stop: z.string(),
        continue: z.string(),
      }).optional(),
    })).optional(),
    personalitySummary: z.array(z.string()).optional(),
  }).optional(),
});
export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;
