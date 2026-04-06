/**
 * save-domain-results CLI command
 *
 * Validates and persists structured analysis results for a specific domain.
 * Includes domain-specific Zod validation and quality gates.
 *
 * Usage: betterprompt-cli save-domain-results --file /path/to/domain-result.json
 *   OR:  betterprompt-cli save-domain-results --domain aiPartnership --overallScore 75 ...
 */

import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  DomainStrengthSchema,
  DomainGrowthAreaSchema,
  MultitaskingPatternSchema,
  validateDistinctEvidence,
  validateEvidenceContentDistinctness,
  hasObservableSignal,
  containsToolFileApiReference,
  isValidToolFileApiEntry,
  evaluateQualityRubric,
  passesQualityRubric,
  validateGrowthAreaQuality,
} from '@betterprompt/shared';
import type { GrowthAreaPEALLMOutput, QualityValidationResult } from '@betterprompt/shared';
import { saveDomainResult, getCurrentRunId } from '../../lib/results-db.js';
import { recordStageStatus } from '../../lib/stage-db.js';
import type { DomainResult } from '../../lib/core/types.js';

// Domain-specific data schemas (ported from MCP tool)
const ThinkingQualityDataSchema = z.object({
  planningHabits: z.union([
    z.array(z.object({
      type: z.string(),
      frequency: z.string().optional(),
      examples: z.array(z.string()).optional(),
      effectiveness: z.string().optional(),
    }).passthrough()).min(1),
    z.object({
      dominantType: z.string().optional(),
      typeDistribution: z.record(z.string(), z.number()).optional(),
    }).passthrough(),
  ]),
  verificationBehavior: z.object({ level: z.string() }).passthrough(),
  criticalThinkingMoments: z.array(z.object({
    type: z.string(),
    quote: z.string().optional(),
    result: z.string().optional(),
    utteranceId: z.string().optional(),
    sessionId: z.string().optional(),
  }).passthrough()),
  verificationAntiPatterns: z.array(z.object({
    type: z.string(),
    frequency: z.number().optional(),
    severity: z.string().optional(),
    examples: z.array(z.unknown()).optional(),
    evidence: z.array(z.unknown()).optional(),
    improvement: z.string().optional(),
  }).passthrough()),
  planQualityScore: z.number().min(0).max(100).optional(),
  multitaskingPattern: MultitaskingPatternSchema.optional(),
}).passthrough();

const CommunicationPatternsDataSchema = z.object({
  communicationPatterns: z.array(z.object({
    patternName: z.string().optional(),
    patternId: z.string().optional(),
    title: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    frequency: z.union([z.string(), z.number()]).optional(),
    effectiveness: z.string().optional(),
    tip: z.string().optional(),
    examples: z.array(z.unknown()).optional(),
    evidence: z.array(z.unknown()).optional(),
  }).passthrough()).min(1),
  signatureQuotes: z.array(z.object({ utteranceId: z.string() }).passthrough()).optional(),
  structuralDistribution: z.record(z.string(), z.number()).optional(),
  contextDistribution: z.record(z.string(), z.number()).optional(),
  questioningDistribution: z.record(z.string(), z.number()).optional(),
}).passthrough();

const LearningBehaviorDataSchema = z.object({
  knowledgeGaps: z.array(z.object({
    area: z.string().optional(),
    topic: z.string().optional(),
    severity: z.string().optional(),
    trend: z.string().optional(),
    evidence: z.array(z.unknown()).optional(),
    description: z.string().optional(),
    questionCount: z.number().optional(),
    depth: z.string().optional(),
    example: z.string().optional(),
  }).passthrough()).optional(),
  repeatedMistakePatterns: z.array(z.object({
    category: z.string(),
    description: z.string().optional(),
    mistakeType: z.string().optional(),
    frequency: z.number().optional(),
    occurrenceCount: z.number().optional(),
    sessionsAffected: z.array(z.string()).optional(),
    exampleUtteranceIds: z.array(z.string()).optional(),
    evidence: z.array(z.unknown()).optional(),
    recommendation: z.string().optional(),
  }).passthrough()).optional(),
  learningProgress: z.array(z.object({
    area: z.string().optional(),
    topic: z.string().optional(),
    startLevel: z.string().optional(),
    currentLevel: z.string().optional(),
    evidence: z.unknown().optional(),
    milestones: z.array(z.string()).optional(),
    description: z.string().optional(),
  }).passthrough()).optional(),
  recommendedResources: z.array(z.object({
    name: z.string().optional(),
    topic: z.string().optional(),
    url: z.string().optional(),
    resourceType: z.string().optional(),
    targetGap: z.string().optional(),
    timeInvestment: z.string().optional(),
    priority: z.string().optional(),
  }).passthrough()).optional(),
  topInsights: z.array(z.unknown()).optional(),
}).passthrough();

const ContextEfficiencyDataSchema = z.object({
  inefficiencyPatterns: z.array(z.object({
    type: z.string().optional(),
    pattern: z.string().optional(),
    frequency: z.number().optional(),
    severity: z.string().optional(),
    impact: z.string().optional(),
    description: z.string().optional(),
    evidence: z.array(z.unknown()).optional(),
  }).passthrough()).optional(),
  contextUsagePatterns: z.array(z.object({
    sessionId: z.string().optional(),
    avgFillPercent: z.number().optional(),
    pattern: z.string().optional(),
    trajectory: z.string().optional(),
  }).passthrough()).optional(),
  promptLengthTrends: z.unknown().optional(),
  iterationAnalysis: z.unknown().optional(),
  avgContextFillPercent: z.number().optional(),
  topInsights: z.array(z.unknown()).optional(),
}).passthrough();

const SessionOutcomeDataSchema = z.object({
  sessionAnalyses: z.array(z.object({
    sessionId: z.string(),
    goals: z.array(z.string()).optional(),
    primaryGoal: z.string().optional(),
    sessionType: z.string(),
    outcome: z.string(),
    satisfaction: z.string().optional(),
    satisfactionSignal: z.string().optional(),
    frictionPoints: z.array(z.unknown()).optional(),
    frictionTypes: z.array(z.string()).optional(),
    outcomeScore: z.number().optional(),
    duration: z.string().optional(),
    utteranceCount: z.number().optional(),
    keyMoment: z.string().optional(),
  })).min(1),
  overallSuccessRate: z.number().min(0).max(100).optional(),
  goalDistribution: z.array(z.unknown()).optional(),
  frictionSummary: z.array(z.unknown()).optional(),
  successPatterns: z.array(z.unknown()).optional(),
  failurePatterns: z.array(z.unknown()).optional(),
}).passthrough();

const ToolMasteryDataSchema = z.object({
  toolMastery: z.array(z.object({
    patternName: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    frequency: z.union([z.string(), z.number()]).optional(),
    examples: z.array(z.unknown()).optional(),
    evidence: z.array(z.unknown()).optional(),
  }).passthrough()).min(1),
  signatureQuotes: z.array(z.object({ utteranceId: z.string() }).passthrough()).optional(),
}).passthrough();

const DOMAIN_DATA_SCHEMAS: Record<string, z.ZodTypeAny> = {
  aiPartnership: ThinkingQualityDataSchema.merge(SessionOutcomeDataSchema.partial()).passthrough(),
  sessionCraft: ContextEfficiencyDataSchema.merge(LearningBehaviorDataSchema.partial()).passthrough(),
  toolMastery: ToolMasteryDataSchema,
  skillResilience: z.record(z.string(), z.unknown()),
  sessionMastery: z.record(z.string(), z.unknown()),
  thinkingQuality: ThinkingQualityDataSchema,
  communicationPatterns: CommunicationPatternsDataSchema,
  learningBehavior: LearningBehaviorDataSchema,
  contextEfficiency: ContextEfficiencyDataSchema,
  sessionOutcome: SessionOutcomeDataSchema,
};

const QUALITY_THRESHOLDS = {
  minDescriptionLength: 300,
  minRecommendationLength: 150,
  minEvidenceCount: 2,
  minVerifiableActionLength: 50,
  minCheckDescriptionLength: 30,
  minGoalRelevanceLength: 50,
} as const;

/**
 * Generic placeholder tags that indicate the LLM filled the categoryTags field
 * with template text rather than descriptive behavioral category tags.
 *
 * Used by the AC 13 categoryTags quality gate to detect when all tags are
 * placeholders rather than meaningful behavioral descriptors.
 *
 * When ALL tags in a growth area match this set, the gate rejects the area
 * and asks the LLM to generate specific behavioral tags.
 *
 * Note: A mix of generic and specific tags is allowed (gate only fails when
 * ALL tags are generic — a single specific tag satisfies the requirement).
 */
const GENERIC_CATEGORY_TAG_PLACEHOLDERS = new Set([
  'general', 'tag', 'tag-1', 'tag-2', 'tag-3', 'tag-4', 'tag-5',
  'placeholder', 'category', 'behavioral', 'type', 'skill', 'practice',
  'area', 'pattern', 'issue', 'problem', 'improvement',
]);

// hasObservableSignal and containsToolFileApiReference are imported from @betterprompt/shared.
// The shared implementations are the canonical source of truth for pattern detection — any
// enhancement to the shared signal patterns (e.g., testing patterns, new tool names) automatically
// applies to this quality gate without requiring a duplicate update here.

/**
 * Known generic goal relevance phrases that indicate the LLM produced a platitude
 * rather than a builder-specific explanation of why the pattern matters.
 *
 * Used by the AC 5 goalRelevance quality gate to detect when the text is clearly
 * generic advice that could apply to any developer, rather than being specific to
 * this builder's actual project, technology stack, or stated objectives.
 *
 * Detection strategy: case-insensitive regex patterns matched against the full
 * goalRelevance text. Only unambiguously generic phrases are included — the list
 * is intentionally conservative to avoid false positives (rejecting valid text).
 *
 * A goalRelevance that matches ANY of these patterns is rejected with a message
 * asking the LLM to reference the builder's specific project context.
 *
 * GOOD goal relevance (specific, not matched by these patterns):
 * - "Your Express API handles payment webhooks — untested catch blocks in middleware
 *    silently swallow Stripe signature errors, causing missed revenue"
 * - "You're building a multi-tenant SaaS dashboard with Prisma — migrations without
 *    a diff check can break tenant data isolation"
 *
 * BAD goal relevance (generic, matched by one of these patterns):
 * - "Testing is important for software quality"
 * - "This will help you write better code"
 * - "Better error handling improves reliability"
 * - "Planning saves time in the long run"
 */
const GENERIC_GOAL_RELEVANCE_PATTERNS: ReadonlyArray<RegExp> = [
  // "will help you write better code/software"
  /\bwill\s+help\s+you\s+(write|create|produce)\s+better\s+(code|software|programs?)\b/i,
  // "testing/X is important for software/code quality/reliability"
  /\bis\s+important\s+for\s+(software|code)\s+(quality|reliability)\b/i,
  // "will improve/enhance your (overall) code quality/productivity/efficiency/reliability"
  /\bwill\s+(improve|enhance|boost)\s+your\s+(overall\s+)?(code\s+quality|productivity|efficiency|reliability)\b/i,
  // "will make you more productive/efficient/effective"
  /\bwill\s+make\s+you\s+(a\s+)?more\s+(productive|efficient|effective)\b/i,
  // "planning saves time in the long run"
  /\bplanning\s+saves?\s+time\s+in\s+the\s+long\s+run\b/i,
  // "helps you become a better developer/programmer/engineer"
  /\bhelps?\s+you\s+become\s+a\s+better\s+(developer|programmer|engineer|coder)\b/i,
  // "better X practices will improve your overall Y" (e.g., "better search practices will improve your overall efficiency")
  /\bbetter\s+\w+\s+practices?\s+will\s+(improve|enhance)\s+your\s+(overall\s+)?\w+\b/i,
  // "this will improve your overall efficiency/productivity (and reduce time ...)"
  /\bimprove\s+your\s+overall\s+(efficiency|productivity|workflow|quality)\b/i,
];

const DomainResultInputSchema = z.object({
  domain: z.enum([
    'aiPartnership', 'sessionCraft', 'toolMastery', 'skillResilience', 'sessionMastery',
    'thinkingQuality', 'communicationPatterns', 'learningBehavior', 'contextEfficiency', 'sessionOutcome', 'content',
  ]),
  overallScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1).optional(),
  strengths: z.array(DomainStrengthSchema),
  growthAreas: z.array(DomainGrowthAreaSchema),
  data: z.record(z.string(), z.unknown()).optional(),
});

function parseStringifiedInput(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      throw new Error(
        `Invalid JSON in stringified input: ${err instanceof Error ? err.message : String(err)}. ` +
        `Value starts with: ${trimmed.slice(0, 80)}...`,
      );
    }
  }
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return value;
}

function normalizeDomainResultArgs(args: Record<string, unknown>): Record<string, unknown> {
  return {
    ...args,
    overallScore: parseStringifiedInput(args.overallScore),
    confidenceScore: parseStringifiedInput(args.confidenceScore),
    strengths: parseStringifiedInput(args.strengths),
    growthAreas: parseStringifiedInput(args.growthAreas),
    data: parseStringifiedInput(args.data),
  };
}

interface QualityIssue {
  field: string;
  message: string;
  actual: number;
  required: number;
}

/**
 * Per-growth-area rich quality diagnostic, collected when a PEA growth area
 * fails the 4-criteria rubric.
 *
 * Contains:
 *   - growthAreaTitle: Which growth area this diagnostic applies to
 *   - summary: Human-readable diagnostic built by validateGrowthAreaQuality()
 *   - criteriaScores: Continuous 0-1 scores per rubric criterion
 *   - detectedProblems: List of detected problem types (genericArea, isolatedQuotes, etc.)
 *
 * Included in the quality_error response alongside the flat `issues` array
 * so that LLM writer skills receive both structured issues (for targeted fixes)
 * and the holistic diagnostic (for understanding the severity of each failure).
 *
 * This enables more efficient retries — the LLM can see not just WHAT failed
 * but also HOW BAD the failure is and WHICH PROBLEM TYPE explains it.
 */
interface GrowthAreaQualityDiagnostic {
  growthAreaTitle: string;
  summary: string;
  criteriaScores: {
    distinctMoments: number;
    verifiableAction: number;
    patternSpecificity: number;
    toolFileNaming: number;
  };
  detectedProblems: string[];
}

/**
 * Combined return type for validateContentQuality().
 *
 * - issues: Flat quality gate failures (existing format, backward compatible)
 * - qualityDiagnostics: Rich diagnostics for PEA growth areas that fail the rubric
 */
interface ContentQualityCheckResult {
  issues: QualityIssue[];
  qualityDiagnostics: GrowthAreaQualityDiagnostic[];
}

/**
 * PEA sub-object type for quality gate checks.
 *
 * Matches the `pea` field shape added to DomainGrowthAreaSchema.
 * This type is inferred inline to avoid circular import issues between
 * the CLI command and the shared schema package.
 */
interface GrowthAreaPEASubObject {
  pattern: {
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    toolsFilesApis: string[];
  };
  evidence: Array<{
    utteranceId: string;
    sessionId: string;
    quote: string;
    context: string;
    observation: string;
    timestamp?: string;
  }>;
  action: {
    instruction: string;
    verificationCheck: string;
    goalRelevance: string;
  };
}

function validateContentQuality(
  strengths: Array<{ title: string; description: string; evidence: unknown[] }>,
  growthAreas: Array<{
    title: string;
    description: string;
    recommendation: string;
    evidence: unknown[];
    evidenceMoments?: Array<{ utteranceId: string; sessionId: string; quote: string; behaviorDescription: string; context?: string; timestamp?: string }>;
    verifiableAction?: { action: string; checkDescription: string; toolOrPattern?: string };
    goalRelevance?: string;
    /**
     * Explicit list of tools, files, APIs, or technologies the builder interacted with.
     * When present, entries are included in the tool_file_naming rubric check.
     * Provides a structured alternative to detecting tool names via regex in text.
     */
    toolsFilesApis?: string[];
    /** Structured PEA sub-object — when present, the 4-criteria quality rubric is enforced */
    pea?: GrowthAreaPEASubObject;
    /** Freeform LLM-generated category tags for team clustering */
    categoryTags?: string[];
  }>,
): ContentQualityCheckResult {
  const issues: QualityIssue[] = [];
  const qualityDiagnostics: GrowthAreaQualityDiagnostic[] = [];

  for (const [i, strength] of strengths.entries()) {
    if (strength.description.length < QUALITY_THRESHOLDS.minDescriptionLength) {
      issues.push({
        field: `strengths[${i}].description`,
        message: `Description for "${strength.title}" is too short (${strength.description.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minDescriptionLength} characters required.`,
        actual: strength.description.length,
        required: QUALITY_THRESHOLDS.minDescriptionLength,
      });
    }
    if (strength.evidence.length < QUALITY_THRESHOLDS.minEvidenceCount) {
      issues.push({
        field: `strengths[${i}].evidence`,
        message: `Strength "${strength.title}" needs at least ${QUALITY_THRESHOLDS.minEvidenceCount} evidence items (has ${strength.evidence.length}).`,
        actual: strength.evidence.length,
        required: QUALITY_THRESHOLDS.minEvidenceCount,
      });
    }
  }

  for (const [i, area] of growthAreas.entries()) {
    if (area.description.length < QUALITY_THRESHOLDS.minDescriptionLength) {
      issues.push({
        field: `growthAreas[${i}].description`,
        message: `Description for "${area.title}" is too short (${area.description.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minDescriptionLength} characters required.`,
        actual: area.description.length,
        required: QUALITY_THRESHOLDS.minDescriptionLength,
      });
    }
    if (area.recommendation.length < QUALITY_THRESHOLDS.minRecommendationLength) {
      issues.push({
        field: `growthAreas[${i}].recommendation`,
        message: `Recommendation for "${area.title}" is too short (${area.recommendation.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minRecommendationLength} characters required.`,
        actual: area.recommendation.length,
        required: QUALITY_THRESHOLDS.minRecommendationLength,
      });
    }
    if (area.evidence.length < QUALITY_THRESHOLDS.minEvidenceCount) {
      issues.push({
        field: `growthAreas[${i}].evidence`,
        message: `Growth area "${area.title}" needs at least ${QUALITY_THRESHOLDS.minEvidenceCount} evidence items (has ${area.evidence.length}).`,
        actual: area.evidence.length,
        required: QUALITY_THRESHOLDS.minEvidenceCount,
      });
    }

    // ====================================================================
    // Evidence Moments Distinctness Gate
    //
    // When v2 evidenceMoments are present, validate that they represent
    // genuinely distinct evidence (different utteranceIds), not the same
    // moment cited multiple times. This is the storage-time enforcement
    // of the distinct_moments rubric criterion.
    //
    // - At least 2 moments with distinct utteranceIds (hard gate)
    // - Single-session evidence flags lowConfidence (soft flag)
    // - Works alongside the Zod .min(2) structural check
    //
    // Note: The legacy `evidence` array check above still runs for
    // backward compatibility. This gate adds semantic distinctness
    // validation that Zod cannot express.
    // ====================================================================
    if (area.evidenceMoments && area.evidenceMoments.length > 0) {
      const evidenceResult = validateDistinctEvidence(area.evidenceMoments);
      if (!evidenceResult.valid) {
        issues.push({
          field: `growthAreas[${i}].evidenceMoments`,
          message: `Growth area "${area.title}" has insufficient distinct evidence: ${evidenceResult.reason ?? 'Unknown reason.'}`,
          actual: evidenceResult.distinctUtteranceCount,
          required: 2,
        });
      }
    }

    // ====================================================================
    // Evidence Content Distinctness Gate (Sub-AC 2c)
    //
    // After checking that utteranceIds are distinct (above), also check that
    // the CONTENT of evidence moments is genuinely distinct and grounded in
    // real session data. This gate rejects three types of low-quality evidence:
    //
    //   1. repeated_content — near-identical quote text (≥ 70-80% word
    //      similarity) cited with different utteranceIds. The LLM sometimes
    //      generates the same developer quote multiple times with slightly
    //      different IDs or minor paraphrasing. These are not distinct moments.
    //
    //   2. generic_context — context fields with no concrete session anchor
    //      (no tool name, file path, technology, or project identifier).
    //      Generic contexts like "working on a backend task" could describe
    //      any session and fail the pattern_specificity criterion.
    //
    //   3. weak_observation — observations that label the problem with vague
    //      language rather than describing the specific behavior demonstrated.
    //      "shows bad error handling" doesn't describe a distinct moment.
    //
    // Policy: Any repeated content blocks the growth area (hard gate).
    // Generic context or weak observations block only when they dominate
    // (majority of moments) — single weak moments are flagged in the error
    // but don't block when the rest of the evidence is strong.
    //
    // For evidenceMoments (flat format), observation = behaviorDescription.
    // For pea.evidence (PEA format), observation = observation.
    // Both are checked independently to support both generation formats.
    //
    // When this gate fires, the LLM writer skill reads the per-moment
    // diagnostics from the quality_error response and retries with
    // corrected evidence — same retry mechanism as all other quality gates.
    // ====================================================================

    // Check flat-format evidenceMoments (v2 format)
    if (area.evidenceMoments && area.evidenceMoments.length >= 2) {
      // Normalize to the common interface (behaviorDescription → observation)
      const normalizedMoments = area.evidenceMoments.map(m => ({
        utteranceId: m.utteranceId,
        sessionId: m.sessionId,
        quote: m.quote,
        context: m.context ?? '',
        observation: m.behaviorDescription,
      }));
      const contentResult = validateEvidenceContentDistinctness(normalizedMoments);
      if (!contentResult.valid) {
        const issueSummary = [
          contentResult.repeatedContentCount > 0
            ? `${contentResult.repeatedContentCount} moment(s) have near-identical quote content`
            : '',
          contentResult.genericContextCount > 0
            ? `${contentResult.genericContextCount} moment(s) have generic context (no session anchor)`
            : '',
          contentResult.weakObservationCount > 0
            ? `${contentResult.weakObservationCount} moment(s) have vague behavior descriptions`
            : '',
        ].filter(Boolean).join('; ');

        issues.push({
          field: `growthAreas[${i}].evidenceMoments`,
          message:
            `Growth area "${area.title}" has evidence content quality issues: ${issueSummary}. ` +
            `Distinct moment requirements: (1) Each quote must be from a DIFFERENT session turn — ` +
            `near-identical quotes with different utteranceIds are not distinct moments. ` +
            `(2) Every context must reference a concrete anchor (tool name, file path, project name, ` +
            `or technology — not "working on a feature"). ` +
            `(3) Every observation must describe the specific behavior demonstrated, naming the ` +
            `tool, command, or pattern involved. Per-moment diagnostics: ` +
            contentResult.issues.map(iss => `[${iss.momentIndex}] ${iss.issueType}: ${iss.message}`).join(' | '),
          actual: contentResult.issues.length,
          required: 0,
        });
      }
    }

    // Check PEA-format evidence (when pea sub-object is present)
    if (area.pea?.evidence && area.pea.evidence.length >= 2) {
      const contentResult = validateEvidenceContentDistinctness(area.pea.evidence);
      if (!contentResult.valid) {
        const issueSummary = [
          contentResult.repeatedContentCount > 0
            ? `${contentResult.repeatedContentCount} moment(s) have near-identical quote content`
            : '',
          contentResult.genericContextCount > 0
            ? `${contentResult.genericContextCount} moment(s) have generic context (no session anchor)`
            : '',
          contentResult.weakObservationCount > 0
            ? `${contentResult.weakObservationCount} moment(s) have vague observations`
            : '',
        ].filter(Boolean).join('; ');

        issues.push({
          field: `growthAreas[${i}].pea.evidence`,
          message:
            `PEA evidence for "${area.title}" has content quality issues: ${issueSummary}. ` +
            `The PEA evidence array must contain genuinely distinct moment references, not ` +
            `repeated quotes with different utteranceIds. Per-moment diagnostics: ` +
            contentResult.issues.map(iss => `[${iss.momentIndex}] ${iss.issueType}: ${iss.message}`).join(' | '),
          actual: contentResult.issues.length,
          required: 0,
        });
      }
    }

    // ====================================================================
    // Verifiable Action Quality Gate (AC 3)
    //
    // Every growth area MUST include a verifiable next-session action that
    // is specific enough to check against future session logs.
    //
    // Rubric criteria: verifiable_action
    // - Action must be present (not undefined)
    // - action text must be >= 50 chars (specific, not vague)
    // - checkDescription must be >= 30 chars (describes observable signal)
    // - Combined text must reference at least one observable session-log
    //   signal (tool name, command, file reference, prompt pattern, etc.)
    // ====================================================================
    if (!area.verifiableAction) {
      issues.push({
        field: `growthAreas[${i}].verifiableAction`,
        message: `Growth area "${area.title}" is missing a verifiable next-session action. Every growth area must include a verifiableAction object with: action (what to do, min 50 chars), checkDescription (how to verify in session logs, min 30 chars). Example: { action: "In your next session, use /plan to outline task structure before implementation.", checkDescription: "Session starts with /plan command or TodoWrite tool_use." }`,
        actual: 0,
        required: 1,
      });
    } else {
      const { action, checkDescription } = area.verifiableAction;

      if (action.length < QUALITY_THRESHOLDS.minVerifiableActionLength) {
        issues.push({
          field: `growthAreas[${i}].verifiableAction.action`,
          message: `Verifiable action for "${area.title}" is too short (${action.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minVerifiableActionLength} characters required. Actions must be specific: name the tool, command, or behavioral pattern to adopt.`,
          actual: action.length,
          required: QUALITY_THRESHOLDS.minVerifiableActionLength,
        });
      }

      if (checkDescription.length < QUALITY_THRESHOLDS.minCheckDescriptionLength) {
        issues.push({
          field: `growthAreas[${i}].verifiableAction.checkDescription`,
          message: `Check description for "${area.title}" is too short (${checkDescription.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minCheckDescriptionLength} characters required. Must describe how to verify the action in session logs.`,
          actual: checkDescription.length,
          required: QUALITY_THRESHOLDS.minCheckDescriptionLength,
        });
      }

      // Verify the action references observable session-log signals
      if (!hasObservableSignal(action, checkDescription)) {
        issues.push({
          field: `growthAreas[${i}].verifiableAction`,
          message: `Verifiable action for "${area.title}" does not reference any observable session-log signal. The action and checkDescription must mention at least one of: tool names (Read, Edit, Grep, Bash, etc.), CLI commands (npm, git, vitest), file names/extensions, slash commands (/plan, /compact), or prompt structure patterns (first message, before implementation). Current action: "${action.slice(0, 80)}..."`,
          actual: 0,
          required: 1,
        });
      }
    }

    // ====================================================================
    // Tool/File/API Naming Quality Gate (AC 4)
    //
    // Every growth area MUST name specific tools, files, APIs, or
    // technologies the builder actually interacted with.
    //
    // Rubric criterion: tool_file_naming
    // - Title or description must contain at least one recognizable
    //   tool/file/API reference (not generic advice like "Error Handling")
    // - If verifiableAction.toolOrPattern is present, it counts too
    // - If toolsFilesApis entries are present, they count too (structured list)
    // - If pea.pattern.toolsFilesApis entries are present, they count too
    //
    // Combined text includes all sources so that explicit toolsFilesApis arrays
    // satisfy the gate even when regex doesn't match in title/description.
    // The primary goal is that visible growth area text references real tech —
    // toolsFilesApis provides structured evidence the LLM names tools explicitly.
    // ====================================================================

    // Collect all tool/file/API references from every available source
    const toolsFromFlat = area.toolsFilesApis?.join(' ') ?? '';
    const toolsFromPea = area.pea?.pattern?.toolsFilesApis?.join(' ') ?? '';
    const toolOrPatternText = area.verifiableAction?.toolOrPattern ?? '';
    const combinedText = [
      area.title,
      area.description,
      toolOrPatternText,
      toolsFromFlat,
      toolsFromPea,
    ].filter(Boolean).join(' ');

    if (!containsToolFileApiReference(combinedText)) {
      issues.push({
        field: `growthAreas[${i}].title`,
        message: `Growth area "${area.title}" does not name any specific tool, file, API, or technology. The title and/or description must reference at least one specific technology the builder interacted with (e.g., "Express", "vitest", "Grep", "middleware/auth.ts", "/plan"). You can also provide a toolsFilesApis array with explicit tool names. Generic titles like "Error Handling Issues" or "Better Planning" fail the tool_file_naming rubric criterion. Fix: Add the specific tool or technology name to the title AND to the toolsFilesApis array. BAD: "Limited Tool Usage" → GOOD: "Bash-Only File Search Instead of Glob/Grep Composition" with toolsFilesApis: ["Bash", "Glob", "Grep"]`,
        actual: 0,
        required: 1,
      });
    }

    // ====================================================================
    // Tool/File/API Entry Quality Validation (supplementary to AC 4 gate)
    //
    // When toolsFilesApis is present, validate that all entries are
    // specific (not vague placeholders like "tool", "API", "framework").
    //
    // Uses isValidToolFileApiEntry() which rejects:
    //   - Empty/single-char entries
    //   - Generic placeholders (the tool, some API, framework, etc.)
    //   - Overly vague strings that could apply to any technology
    //
    // This is a WARNING-level check (not blocking) because the main
    // tool_file_naming gate already ensures the text contains references.
    // But vague entries reduce report quality and hint at the LLM
    // producing placeholder text rather than real technology names.
    // ====================================================================
    if (area.toolsFilesApis && area.toolsFilesApis.length > 0) {
      const vagueEntries = area.toolsFilesApis.filter(entry => !isValidToolFileApiEntry(entry));
      if (vagueEntries.length > 0 && vagueEntries.length === area.toolsFilesApis.length) {
        // All entries are vague — this is blocking since it means the LLM
        // produced placeholder text rather than real technology names
        issues.push({
          field: `growthAreas[${i}].toolsFilesApis`,
          message: `All toolsFilesApis entries for "${area.title}" are vague placeholders: [${vagueEntries.slice(0, 3).map(e => `"${e}"`).join(', ')}]. Each entry must be a recognizable tool, file, or API name. BAD: ["tool", "API", "framework"]. GOOD: ["Express.js", "middleware/auth.ts", "vitest"]. Replace placeholders with the actual technology names from the builder's sessions.`,
          actual: 0,
          required: 1,
        });
      }
    }

    // ====================================================================
    // Goal Relevance Quality Gate (AC 5)
    //
    // Every growth area MUST explain WHY the pattern matters for what the
    // builder is specifically trying to achieve. This connects the growth
    // area to the builder's actual goals, not abstract best practices.
    //
    // Evaluation criterion: goal_relevance
    // - goalRelevance field must be present (not undefined/empty)
    // - Must be >= 50 chars (enough to be specific, not "improves quality")
    // - Must NOT be generic platitudes that could apply to any developer
    //
    // Goal relevance appears in three places (checked in priority order):
    // 1. As a structured flat `goalRelevance` field (primary, checked first)
    // 2. In the PEA sub-object `pea.action.goalRelevance` (fallback for PEA pipeline)
    // 3. Embedded in `description` as the "WHY IT MATTERS" section (legacy fallback)
    //
    // Priority: flat field > pea.action.goalRelevance > description keyword
    // This ensures PEA-format growth areas that provide goalRelevance in the
    // structured action object are not penalized for omitting the redundant
    // flat field. The flat field is preferred because it is explicitly displayed
    // in the report UI; the PEA action field feeds the same display path via
    // the peaToWorkerGrowth() conversion (actionGoalRelevance).
    // ====================================================================
    const goalRelevanceText = area.goalRelevance ?? area.pea?.action?.goalRelevance ?? '';
    const descriptionHasGoalSection = /WHY IT MATTERS|why this matters|why it matters for|matters for your|trying to achieve/i.test(area.description);

    if (!goalRelevanceText && !descriptionHasGoalSection) {
      issues.push({
        field: `growthAreas[${i}].goalRelevance`,
        message: `Growth area "${area.title}" is missing goal relevance. Every growth area must explain WHY this pattern matters for what the builder is trying to achieve. Either provide a goalRelevance field (min ${QUALITY_THRESHOLDS.minGoalRelevanceLength} chars) or include a "WHY IT MATTERS" section in the description that connects the pattern to the builder's specific project, technology stack, or stated objectives. BAD: "This will improve code quality" (generic). GOOD: "Your Express API handles payment webhooks — untested error paths in middleware could silently drop Stripe events, causing revenue loss" (specific to builder's goals).`,
        actual: 0,
        required: QUALITY_THRESHOLDS.minGoalRelevanceLength,
      });
    } else if (goalRelevanceText && goalRelevanceText.length < QUALITY_THRESHOLDS.minGoalRelevanceLength) {
      issues.push({
        field: `growthAreas[${i}].goalRelevance`,
        message: `Goal relevance for "${area.title}" is too short (${goalRelevanceText.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minGoalRelevanceLength} characters required. Goal relevance must explain why this pattern matters for the builder's specific goals — not generic advice. Reference the builder's actual project context, technology stack, or objectives.`,
        actual: goalRelevanceText.length,
        required: QUALITY_THRESHOLDS.minGoalRelevanceLength,
      });
    } else if (goalRelevanceText) {
      // ====================================================================
      // Anti-Generic Goal Relevance Gate (AC 5 — specificity requirement)
      //
      // Goal relevance must NOT be a generic platitude that could apply to
      // any developer. The text must reference the builder's specific project,
      // technology stack, or stated objectives, and explain the concrete
      // consequence of the observed pattern for their specific goals.
      //
      // This gate fires after the presence/length gate — only runs when the
      // goalRelevanceText is present AND long enough (>= minGoalRelevanceLength).
      //
      // Detection: match against GENERIC_GOAL_RELEVANCE_PATTERNS (regex set).
      // Conservative list — only unambiguously generic platitudes are included
      // to minimize false positives (valid text should never be rejected here).
      // ====================================================================
      const matchedGenericPattern = GENERIC_GOAL_RELEVANCE_PATTERNS.find(pattern => pattern.test(goalRelevanceText));
      if (matchedGenericPattern) {
        issues.push({
          field: `growthAreas[${i}].goalRelevance`,
          message: `Goal relevance for "${area.title}" is a generic platitude that could apply to any developer. Every goal relevance statement must reference the builder's specific project context, technology stack, or stated objectives. BAD: "Testing is important for software quality" or "This will help you write better code" (generic — could apply to any developer). GOOD: "Your Express API handles payment webhooks — untested catch blocks in middleware silently swallow Stripe events, causing revenue loss" or "You're building a multi-tenant SaaS with Prisma — schema changes without a diff check risk breaking tenant data isolation" (specific to this builder's project and goals). Rewrite to explain WHY this pattern matters specifically for what THIS builder is trying to achieve.`,
          actual: goalRelevanceText.length,
          required: QUALITY_THRESHOLDS.minGoalRelevanceLength,
        });
      }
    }

    // ====================================================================
    // PEA Quality Rubric Gate (Sub-AC 2 — 4-criteria hard gate)
    //
    // When a growth area includes the structured `pea` sub-object with
    // distinct Pattern, Evidence, and Action fields, run the 4-criteria
    // quality rubric via evaluateQualityRubric() from the shared package.
    //
    // All four criteria MUST pass (non-negotiable hard gate):
    //   1. distinct_moments   — 2+ distinct evidence moments from actual sessions
    //   2. verifiable_action  — Action references observable session-log signals
    //   3. pattern_specificity — Pattern is specific to this builder, 100+ char desc
    //   4. tool_file_naming   — Names specific tools, files, APIs, or technologies
    //
    // This gate runs IN ADDITION to the flat-field quality gates above.
    // The flat-field gates remain for backward compat with pre-PEA data.
    // When `pea` is absent, only flat-field gates apply.
    //
    // Implementation note: evaluateQualityRubric() requires a domain and
    // categoryTags field (GrowthAreaPEALLMOutput type) but does NOT use them
    // internally — harmless defaults are passed to satisfy the TypeScript type.
    // ====================================================================
    if (area.pea) {
      // ====================================================================
      // Category Tags Gate (AC 13 — behavioral category tags required)
      //
      // Every PEA growth area MUST carry at least 1 freeform LLM-generated
      // behavioral category tag for cross-developer clustering in team views.
      //
      // Tags must be descriptive behavioral patterns — NOT generic placeholders.
      // The gate fails only when ALL tags are from GENERIC_CATEGORY_TAG_PLACEHOLDERS
      // (a mix of generic and specific tags is accepted).
      //
      // Valid: ["error-handling", "test-coverage", "express-middleware"]
      // Valid: ["context-management", "session-planning"]
      // Invalid (all generic): ["general"], ["tag-1", "tag-2"], ["placeholder"]
      //
      // This gate applies only to PEA growth areas (when `pea` is present).
      // Pre-PEA growth areas (without `pea`) are not affected for backward compat.
      // ====================================================================
      if (!area.categoryTags || area.categoryTags.length === 0) {
        issues.push({
          field: `growthAreas[${i}].categoryTags`,
          message: `Growth area "${area.title}" is missing categoryTags. Every PEA growth area MUST include 1-5 freeform LLM-generated behavioral category tags for cross-developer clustering in team views. Tags are NOT constrained to a fixed taxonomy — generate descriptive tags based on the observed behavioral pattern. Examples: ["error-handling", "test-coverage", "express-middleware"] for an error handling pattern; ["context-management", "session-planning", "compact-usage"] for a context efficiency pattern. Add 2-3 descriptive tags that meaningfully describe this behavioral cluster for team aggregation.`,
          actual: 0,
          required: 1,
        });
      } else {
        // Check if ALL tags are generic placeholders (partial generics are allowed)
        const genericTags = area.categoryTags.filter(tag =>
          GENERIC_CATEGORY_TAG_PLACEHOLDERS.has(tag.toLowerCase().trim()),
        );
        if (genericTags.length === area.categoryTags.length) {
          issues.push({
            field: `growthAreas[${i}].categoryTags`,
            message: `All categoryTags for "${area.title}" are generic placeholders: [${genericTags.slice(0, 3).map(t => `"${t}"`).join(', ')}]. Replace with specific behavioral category tags that describe the observed pattern. Examples: ["error-handling", "test-coverage", "express-middleware"] for error handling patterns; ["context-management", "session-planning"] for context efficiency patterns; ["tool-composition", "bash-overuse", "file-discovery"] for tool usage patterns. Choose 2-3 tags that would meaningfully group this pattern with similar patterns from other team members.`,
            actual: 0,
            required: 1,
          });
        }
      }

      const peaLLMOutput: GrowthAreaPEALLMOutput = {
        pattern: area.pea.pattern,
        evidence: area.pea.evidence,
        action: area.pea.action,
        // domain and categoryTags are required by GrowthAreaPEALLMOutput type
        // but not used by evaluateQualityRubric() — pass harmless defaults
        domain: 'domain',
        categoryTags: area.categoryTags?.length ? area.categoryTags : ['general'],
      };

      const rubric = evaluateQualityRubric(peaLLMOutput);

      if (!passesQualityRubric(rubric)) {
        // Report specific failures for each failed criterion so the LLM
        // can fix the precise issue rather than guessing what's wrong.

        if (!rubric.distinctMoments) {
          issues.push({
            field: `growthAreas[${i}].pea.evidence`,
            message: `PEA evidence for "${area.title}" fails the distinct_moments criterion. The evidence array must contain 2+ moments with DISTINCT utteranceIds from actual sessions. Each moment must reference a different exchange, not the same moment cited multiple times. Fix: add a second evidence moment from a different session turn (different utteranceId).`,
            actual: 0,
            required: 1,
          });
        }

        if (!rubric.verifiableAction) {
          issues.push({
            field: `growthAreas[${i}].pea.action`,
            message: `PEA action for "${area.title}" fails the verifiable_action criterion. The action.instruction (50+ chars) and action.verificationCheck (30+ chars) must together reference at least one observable session-log signal — a tool name (Read, Edit, Grep, Glob, Bash), CLI command (npm, git, vitest), slash command (/plan, /compact), or behavioral pattern (first message, before implementation). Fix: add the specific tool or command the builder should use in their next session.`,
            actual: 0,
            required: 1,
          });
        }

        if (!rubric.patternSpecificity) {
          issues.push({
            field: `growthAreas[${i}].pea.pattern`,
            message: `PEA pattern for "${area.title}" fails the pattern_specificity criterion. pattern.description must be 100+ chars and pattern.toolsFilesApis must contain at least one tool/file/API entry. The description must name the specific behavior observed — not generic advice. Fix: expand the description to 100+ chars and add the specific technology the builder interacted with to toolsFilesApis.`,
            actual: area.pea.pattern.description.length,
            required: 100,
          });
        }

        if (!rubric.toolFileNaming) {
          issues.push({
            field: `growthAreas[${i}].pea.pattern.toolsFilesApis`,
            message: `PEA pattern for "${area.title}" fails the tool_file_naming criterion. pattern.toolsFilesApis must contain at least one VALID entry (e.g., "Express.js", "vitest", "middleware/auth.ts", "/plan") AND the title or description must visibly mention a specific technology. Generic entries like "tool", "API", or "framework" are rejected. Fix: name the actual tool, file, or technology in both toolsFilesApis AND the pattern title or description.`,
            actual: 0,
            required: 1,
          });
        }

        // ====================================================================
        // Rich Quality Diagnostic (Sub-AC 3 — enhanced retry feedback)
        //
        // When the PEA rubric fails, ALSO run the full validateGrowthAreaQuality()
        // checker to collect continuous scores per criterion and detect the four
        // original problem types:
        //   1. genericArea      — dressed-up generic advice
        //   2. isolatedQuotes   — evidence not establishing a pattern
        //   3. arbitraryScores  — severity not justified by evidence weight
        //   4. missingPatterns  — no behavioral pattern described
        //
        // The rich diagnostic is returned alongside the flat `issues` array
        // so the LLM writer skill receives both:
        //   - `issues`: which criteria failed (structured, targeted fixes)
        //   - `qualityDiagnostics`: holistic analysis with problem type + suggestion
        //
        // This enables more efficient retries — the LLM understands not just
        // WHAT failed but also WHY (problem type) and HOW BAD (continuous score).
        // ====================================================================
        const richValidation: QualityValidationResult = validateGrowthAreaQuality(peaLLMOutput);
        const detectedProblems: string[] = [];
        if (richValidation.problems.genericArea.detected) {
          detectedProblems.push(`genericArea (${richValidation.problems.genericArea.severity})`);
        }
        if (richValidation.problems.isolatedQuotes.detected) {
          detectedProblems.push(`isolatedQuotes (${richValidation.problems.isolatedQuotes.severity})`);
        }
        if (richValidation.problems.arbitraryScores.detected) {
          detectedProblems.push(`arbitraryScores (${richValidation.problems.arbitraryScores.severity})`);
        }
        if (richValidation.problems.missingPatterns.detected) {
          detectedProblems.push(`missingPatterns (${richValidation.problems.missingPatterns.severity})`);
        }

        qualityDiagnostics.push({
          growthAreaTitle: area.title,
          summary: richValidation.summary,
          criteriaScores: {
            distinctMoments: richValidation.criteria.distinctMoments.score,
            verifiableAction: richValidation.criteria.verifiableAction.score,
            patternSpecificity: richValidation.criteria.patternSpecificity.score,
            toolFileNaming: richValidation.criteria.toolFileNaming.score,
          },
          detectedProblems,
        });
      }
    }
  }

  return { issues, qualityDiagnostics };
}

function getDomainDataHint(domain: string): string {
  const hints: Record<string, string> = {
    aiPartnership: 'Expected: planningHabits[], verificationBehavior, sessionAnalyses[], overallSuccessRate',
    sessionCraft: 'Expected: inefficiencyPatterns[], contextUsagePatterns[], knowledgeGaps[], repeatedMistakePatterns[]',
    toolMastery: 'Required: toolMastery[] (min 1). Optional: signatureQuotes[]',
    skillResilience: 'Expected: domain-specific data (flexible schema)',
    sessionMastery: 'Expected: absenceIndicators[], sessionCleanliness[], cleanSessionPercentage, scaffoldingDependencyScore',
    thinkingQuality: 'Required: planningHabits[] (min 1), verificationBehavior, criticalThinkingMoments[], verificationAntiPatterns[]',
    communicationPatterns: 'Required: communicationPatterns[] (min 1). Optional: signatureQuotes[]',
    learningBehavior: 'Expected: knowledgeGaps[], repeatedMistakePatterns[], learningProgress[], recommendedResources[]',
    contextEfficiency: 'Expected: inefficiencyPatterns[], contextUsagePatterns[], promptLengthTrends, avgContextFillPercent',
    sessionOutcome: 'Required: sessionAnalyses[] (min 1). Optional: overallSuccessRate',
  };
  return hints[domain] ?? '';
}

export async function execute(args: Record<string, unknown>): Promise<string> {
  // Read from file if --file provided
  let inputArgs = args;
  if (typeof args.file === 'string') {
    try {
      inputArgs = JSON.parse(readFileSync(args.file, 'utf-8'));
    } catch (error) {
      return JSON.stringify({
        status: 'error',
        message: `Failed to read input file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  const normalizedArgs = normalizeDomainResultArgs(inputArgs);
  const runId = getCurrentRunId();
  const domainName = typeof normalizedArgs.domain === 'string' ? normalizedArgs.domain : null;

  if (!runId) {
    return JSON.stringify({
      status: 'error',
      message: 'No active analysis run. Run extract-data first to start an analysis.',
    });
  }

  // Step 1: Validate top-level structure
  const parsed = DomainResultInputSchema.safeParse(normalizedArgs);
  if (!parsed.success) {
    if (domainName) {
      recordStageStatus(runId, domainName, { status: 'failed', lastError: 'Invalid domain result format.' });
    }
    return JSON.stringify({
      status: 'validation_error',
      message: 'Invalid domain result format.',
      errors: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  // Step 2: Validate domain-specific data
  const domainSchema = DOMAIN_DATA_SCHEMAS[parsed.data.domain];
  if (domainSchema && parsed.data.data) {
    const dataResult = domainSchema.safeParse(parsed.data.data);
    if (!dataResult.success) {
      recordStageStatus(runId, parsed.data.domain, { status: 'failed', lastError: `Domain-specific data for "${parsed.data.domain}" is incomplete or invalid.` });
      return JSON.stringify({
        status: 'validation_error',
        message: `Domain-specific data for "${parsed.data.domain}" is incomplete or invalid.`,
        errors: dataResult.error.issues.map(i => ({ path: `data.${i.path.join('.')}`, message: i.message })),
        hint: getDomainDataHint(parsed.data.domain),
      });
    }
  } else if (parsed.data.domain !== 'content' && !parsed.data.data) {
    recordStageStatus(runId, parsed.data.domain, { status: 'failed', lastError: `Domain "${parsed.data.domain}" requires a data field.` });
    return JSON.stringify({
      status: 'validation_error',
      message: `Domain "${parsed.data.domain}" requires a data field with domain-specific structures.`,
      hint: getDomainDataHint(parsed.data.domain),
    });
  }

  // Step 3: Quality gate
  //
  // validateContentQuality() returns both:
  //   - issues: flat quality gate failures (backward compatible format)
  //   - qualityDiagnostics: rich criterion scores + problem type analysis for PEA
  //     failures, collected by validateGrowthAreaQuality() (Sub-AC 3)
  //
  // When quality fails, both are included in the quality_error response so the
  // LLM writer skill has both targeted fixes (issues[]) and holistic problem
  // analysis (qualityDiagnostics[]) for efficient retry.
  const { issues: qualityIssues, qualityDiagnostics } = validateContentQuality(
    parsed.data.strengths,
    parsed.data.growthAreas,
  );
  if (qualityIssues.length > 0) {
    recordStageStatus(runId, parsed.data.domain, { status: 'failed', lastError: `Quality gate failed for "${parsed.data.domain}".` });
    return JSON.stringify({
      status: 'quality_error',
      message: `${qualityIssues.length} quality issue(s) detected. Expand the flagged fields and try again.`,
      issues: qualityIssues,
      // Rich quality diagnostics for PEA growth areas that fail the rubric.
      // Includes continuous criterion scores (0-1) and problem type detection
      // (genericArea, isolatedQuotes, arbitraryScores, missingPatterns) to
      // guide more targeted retries. Only present when PEA growth areas fail.
      ...(qualityDiagnostics.length > 0 ? { qualityDiagnostics } : {}),
    });
  }

  // ====================================================================
  // Step 4: Auto-flag low-confidence growth areas (AC 6)
  //
  // After quality gate passes, stamp lowConfidence on growth areas with
  // sparse evidence. This ensures the flag is ALWAYS set when evidence
  // is limited, regardless of what the LLM originally output.
  //
  // Low-confidence criteria (from validateDistinctEvidence):
  //   - Only 2 evidence moments (minimum viable)
  //   - Single-session evidence (all moments from same session)
  //   - LLM explicitly flagged lowConfidence
  //
  // Growth areas are NOT rejected — they're flagged as "emerging patterns
  // needing more sessions to confirm". Never produce empty reports.
  // ====================================================================
  const growthAreasWithConfidence = parsed.data.growthAreas.map(area => {
    // Prefer evidenceMoments (flat format); fall back to pea.evidence (structured format).
    // Both carry sessionId, which validateDistinctEvidence() needs to assess
    // single-session vs. multi-session evidence.
    const moments = (area.evidenceMoments && area.evidenceMoments.length > 0)
      ? area.evidenceMoments
      : (area.pea?.evidence && area.pea.evidence.length > 0)
        ? area.pea.evidence
        : null;

    if (moments) {
      const evidenceResult = validateDistinctEvidence(moments);
      if (evidenceResult.lowConfidence) {
        return { ...area, lowConfidence: true };
      }
    }
    return area;
  });

  // Save to database
  const domainResult: DomainResult = {
    domain: parsed.data.domain,
    overallScore: parsed.data.overallScore,
    confidenceScore: parsed.data.confidenceScore ?? 0.5,
    strengths: parsed.data.strengths,
    growthAreas: growthAreasWithConfidence,
    data: parsed.data.data,
    analyzedAt: new Date().toISOString(),
  };

  saveDomainResult(runId, domainResult);
  recordStageStatus(runId, domainResult.domain, { status: 'validated' });

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
