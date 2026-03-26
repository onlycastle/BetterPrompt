/**
 * save_domain_results MCP Tool
 *
 * Accepts structured analysis results for a specific domain.
 * Validates the input against shared schemas (including domain-specific
 * typed data) and stores it in the results database.
 *
 * Includes:
 * - Domain-specific Zod validation for the `data` field (Fix 2)
 * - Description quality gates matching server-side BaseWorker checks (Fix 3)
 *
 * Called by domain analysis skills after the host LLM completes analysis.
 */

import { z } from 'zod';
import {
  EvidenceSchema as SharedEvidenceSchema,
  DomainStrengthSchema,
  DomainGrowthAreaSchema,
  DOMAIN_NAMES,
  // Domain-specific worker output schemas
  PlanningHabitSchema,
  CriticalThinkingMomentSchema,
  VerificationBehaviorSchema,
  DetectedAntiPatternSchema,
  MultitaskingPatternSchema,
  CommunicationPatternSchema,
  SignatureQuoteSchema,
} from '@betterprompt/shared';
import { saveDomainResult, getCurrentRunId } from '../../lib/results-db.js';
import { recordStageStatus } from '../../lib/stage-db.js';
import type { DomainResult } from '../../lib/core/types.js';

export const definition = {
  name: 'save_domain_results',
  description:
    'Save structured analysis results for a specific domain. ' +
    'Called after analyzing a domain (aiPartnership, sessionCraft, toolMastery, ' +
    'skillResilience, sessionMastery). ' +
    'Input must include domain name, overall score, strengths, and growth areas.',
};

// Re-export shared schemas for backward compatibility
export const EvidenceSchema = SharedEvidenceSchema;
export const StrengthSchema = DomainStrengthSchema;
export const GrowthAreaSchema = DomainGrowthAreaSchema;

function extractDomainName(args: Record<string, unknown>): string | null {
  return typeof args.domain === 'string' ? args.domain : null;
}

function parseStringifiedInput(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if ((trimmed.startsWith('{') && trimmed.endsWith('}'))
    || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
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

// ============================================================================
// Domain-Specific Data Schemas (Fix 2)
//
// These enforce the same structures that Gemini's responseJsonSchema enforces
// at generation time on the server. Without these, the `data` field accepts
// literally anything — including empty objects.
// ============================================================================

/**
 * ThinkingQuality data: validates structure without strict enum enforcement.
 * The host LLM may produce slight field variations; assembly normalizes later.
 * Key requirement: planningHabits[] and verificationBehavior must exist as objects.
 */
const ThinkingQualityDataSchema = z.object({
  planningHabits: z.union([
    // Canonical array format: [{ type, frequency, examples, effectiveness }]
    z.array(z.object({
      type: z.string(),
      frequency: z.string().optional(),
      examples: z.array(z.string()).optional(),
      effectiveness: z.string().optional(),
    }).passthrough()).min(1),
    // Plugin summary format: { dominantType, typeDistribution, ... }
    z.object({
      dominantType: z.string().optional(),
      typeDistribution: z.record(z.string(), z.number()).optional(),
    }).passthrough(),
  ]),
  verificationBehavior: z.object({
    level: z.string(),
  }).passthrough(),
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

/**
 * CommunicationPatterns data: accepts both canonical and plugin field names.
 * The assembly layer normalizes patternName/patternId/title and frequency formats.
 */
const CommunicationPatternsDataSchema = z.object({
  communicationPatterns: z.array(z.object({
    // Accept any of: patternName (canonical), patternId, title (plugin)
    patternName: z.string().optional(),
    patternId: z.string().optional(),
    title: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    // Frequency: accept both enum string and number
    frequency: z.union([z.string(), z.number()]).optional(),
    effectiveness: z.string().optional(),
    tip: z.string().optional(),
    // Examples: accept both canonical and plugin evidence format
    examples: z.array(z.unknown()).optional(),
    evidence: z.array(z.unknown()).optional(),
  }).passthrough()).min(1),
  signatureQuotes: z.array(z.object({
    utteranceId: z.string(),
  }).passthrough()).optional(),
  structuralDistribution: z.record(z.string(), z.number()).optional(),
  contextDistribution: z.record(z.string(), z.number()).optional(),
  questioningDistribution: z.record(z.string(), z.number()).optional(),
}).passthrough();

/**
 * LearningBehavior data: requires at least one of the primary arrays.
 * Accepts both canonical field names (topic, questionCount) and plugin variants (area, severity).
 */
const LearningBehaviorDataSchema = z.object({
  knowledgeGaps: z.array(z.object({
    // Accept both canonical (topic) and plugin (area) field names
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
    // Accept both canonical (occurrenceCount) and plugin (frequency)
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

/**
 * ContextEfficiency data: requires inefficiencyPatterns with type or pattern field.
 * Accepts both canonical (pattern) and plugin (type) field names.
 */
const ContextEfficiencyDataSchema = z.object({
  inefficiencyPatterns: z.array(z.object({
    // Accept both canonical (pattern) and plugin (type) field names
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

/** Domain → data schema lookup. Domains without specific schemas fall through to permissive. */
const DOMAIN_DATA_SCHEMAS: Record<string, z.ZodTypeAny> = {
  // v2 domains: merged schemas are permissive (.passthrough()) to accept combined data
  aiPartnership: ThinkingQualityDataSchema.merge(SessionOutcomeDataSchema.partial()).passthrough(),
  sessionCraft: ContextEfficiencyDataSchema.merge(LearningBehaviorDataSchema.partial()).passthrough(),
  toolMastery: CommunicationPatternsDataSchema,
  skillResilience: z.record(z.string(), z.unknown()), // permissive
  sessionMastery: z.record(z.string(), z.unknown()), // permissive
  // Legacy domains
  thinkingQuality: ThinkingQualityDataSchema,
  communicationPatterns: CommunicationPatternsDataSchema,
  learningBehavior: LearningBehaviorDataSchema,
  contextEfficiency: ContextEfficiencyDataSchema,
  sessionOutcome: SessionOutcomeDataSchema,
};

// ============================================================================
// Quality Gate Constants (Fix 3)
//
// These match the server-side BaseWorker.validateDescriptionQuality() thresholds.
// ============================================================================

const QUALITY_THRESHOLDS = {
  /** Minimum characters for strength/growth area descriptions */
  minDescriptionLength: 300,
  /** Minimum characters for growth area recommendations */
  minRecommendationLength: 150,
  /** Minimum evidence items per strength/growth area */
  minEvidenceCount: 2,
} as const;

// ============================================================================
// Input Schema
// ============================================================================

export const DomainResultInputSchema = z.object({
  domain: z.enum([
    // v2 domains
    'aiPartnership',
    'sessionCraft',
    'toolMastery',
    'skillResilience',
    'sessionMastery',
    // Legacy domains
    'thinkingQuality',
    'communicationPatterns',
    'learningBehavior',
    'contextEfficiency',
    'sessionOutcome',
    'content',
  ]),
  overallScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(1).optional(),
  strengths: z.array(DomainStrengthSchema),
  growthAreas: z.array(DomainGrowthAreaSchema),
  /** Domain-specific typed data. Validated per domain using typed schemas. */
  data: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// Quality Validation (Fix 3)
// ============================================================================

interface QualityIssue {
  field: string;
  message: string;
  actual: number;
  required: number;
}

function validateContentQuality(
  strengths: Array<{ title: string; description: string; evidence: unknown[] }>,
  growthAreas: Array<{ title: string; description: string; recommendation: string; evidence: unknown[] }>,
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const [i, strength] of strengths.entries()) {
    if (strength.description.length < QUALITY_THRESHOLDS.minDescriptionLength) {
      issues.push({
        field: `strengths[${i}].description`,
        message: `Description for "${strength.title}" is too short (${strength.description.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minDescriptionLength} characters required. Use WHAT-WHY-HOW structure: WHAT the pattern is (2-3 sentences), WHY it matters (1-2 sentences), HOW to leverage it (1-2 sentences).`,
        actual: strength.description.length,
        required: QUALITY_THRESHOLDS.minDescriptionLength,
      });
    }
    if (strength.evidence.length < QUALITY_THRESHOLDS.minEvidenceCount) {
      issues.push({
        field: `strengths[${i}].evidence`,
        message: `Strength "${strength.title}" needs at least ${QUALITY_THRESHOLDS.minEvidenceCount} evidence items (has ${strength.evidence.length}). Search across ALL sessions for additional examples of this pattern.`,
        actual: strength.evidence.length,
        required: QUALITY_THRESHOLDS.minEvidenceCount,
      });
    }
  }

  for (const [i, area] of growthAreas.entries()) {
    if (area.description.length < QUALITY_THRESHOLDS.minDescriptionLength) {
      issues.push({
        field: `growthAreas[${i}].description`,
        message: `Description for "${area.title}" is too short (${area.description.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minDescriptionLength} characters required. Use WHAT-WHY-HOW structure.`,
        actual: area.description.length,
        required: QUALITY_THRESHOLDS.minDescriptionLength,
      });
    }
    if (area.recommendation.length < QUALITY_THRESHOLDS.minRecommendationLength) {
      issues.push({
        field: `growthAreas[${i}].recommendation`,
        message: `Recommendation for "${area.title}" is too short (${area.recommendation.length} chars). MINIMUM ${QUALITY_THRESHOLDS.minRecommendationLength} characters required. Provide step-by-step actionable advice.`,
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
  }

  return issues;
}

// ============================================================================
// Execute
// ============================================================================

export async function execute(args: Record<string, unknown>): Promise<string> {
  const normalizedArgs = normalizeDomainResultArgs(args);

  // Get current run ID
  const runId = getCurrentRunId();
  const domainName = extractDomainName(normalizedArgs);

  if (!runId) {
    return JSON.stringify({
      status: 'error',
      message: 'No active analysis run. Call extract_data first to start an analysis.',
    });
  }

  // Step 1: Validate top-level structure
  const parsed = DomainResultInputSchema.safeParse(normalizedArgs);
  if (!parsed.success) {
    if (domainName) {
      recordStageStatus(runId, domainName, {
        status: 'failed',
        lastError: 'Invalid domain result format.',
      });
    }
    return JSON.stringify({
      status: 'validation_error',
      message: 'Invalid domain result format.',
      errors: parsed.error.issues.map(i => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  // Step 2: Validate domain-specific data structure (Fix 2)
  const domainSchema = DOMAIN_DATA_SCHEMAS[parsed.data.domain];
  if (domainSchema && parsed.data.data) {
    const dataResult = domainSchema.safeParse(parsed.data.data);
    if (!dataResult.success) {
      recordStageStatus(runId, parsed.data.domain, {
        status: 'failed',
        lastError: `Domain-specific data for "${parsed.data.domain}" is incomplete or invalid.`,
      });
      const missingFields = dataResult.error.issues.map(i => ({
        path: `data.${i.path.join('.')}`,
        message: i.message,
      }));
      return JSON.stringify({
        status: 'validation_error',
        message: `Domain-specific data for "${parsed.data.domain}" is incomplete or invalid. `
          + `The data field must contain the required structures for this domain. `
          + `Review the skill instructions for the expected data format.`,
        errors: missingFields,
        hint: getDomainDataHint(parsed.data.domain),
      });
    }
  } else if (parsed.data.domain !== 'content' && !parsed.data.data) {
    recordStageStatus(runId, parsed.data.domain, {
      status: 'failed',
      lastError: `Domain "${parsed.data.domain}" requires a data field with domain-specific structures.`,
    });
    return JSON.stringify({
      status: 'validation_error',
      message: `Domain "${parsed.data.domain}" requires a data field with domain-specific structures. `
        + `Do not omit the data field.`,
      hint: getDomainDataHint(parsed.data.domain),
    });
  }

  // Step 3: Quality gate - check description/recommendation lengths (Fix 3)
  const qualityIssues = validateContentQuality(
    parsed.data.strengths,
    parsed.data.growthAreas,
  );

  if (qualityIssues.length > 0) {
    recordStageStatus(runId, parsed.data.domain, {
      status: 'failed',
      lastError: `Quality gate failed for "${parsed.data.domain}" analysis.`,
    });
    return JSON.stringify({
      status: 'quality_error',
      message: `${qualityIssues.length} quality issue(s) detected. `
        + `Descriptions must be ${QUALITY_THRESHOLDS.minDescriptionLength}+ chars, `
        + `recommendations must be ${QUALITY_THRESHOLDS.minRecommendationLength}+ chars, `
        + `and each insight needs ${QUALITY_THRESHOLDS.minEvidenceCount}+ evidence items. `
        + `Please expand the flagged fields and call save_domain_results again.`,
      issues: qualityIssues,
    });
  }

  // All validation passed — save to database
  const domainResult: DomainResult = {
    domain: parsed.data.domain,
    overallScore: parsed.data.overallScore,
    confidenceScore: parsed.data.confidenceScore ?? 0.5,
    strengths: parsed.data.strengths,
    growthAreas: parsed.data.growthAreas,
    data: parsed.data.data,
    analyzedAt: new Date().toISOString(),
  };

  saveDomainResult(runId, domainResult);
  recordStageStatus(runId, domainResult.domain, {
    status: 'validated',
  });

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

// ============================================================================
// Hints for domain data requirements
// ============================================================================

function getDomainDataHint(domain: string): string {
  const hints: Record<string, string> = {
    aiPartnership:
      'Expected: planningHabits[], verificationBehavior, sessionAnalyses[], overallSuccessRate',
    sessionCraft:
      'Expected: inefficiencyPatterns[], contextUsagePatterns[], knowledgeGaps[], repeatedMistakePatterns[]',
    toolMastery:
      'Required: communicationPatterns[] (min 1). Optional: signatureQuotes[]',
    skillResilience:
      'Expected: domain-specific data (flexible schema)',
    sessionMastery:
      'Expected: absenceIndicators[], sessionCleanliness[], cleanSessionPercentage, scaffoldingDependencyScore',
    // Legacy domains
    thinkingQuality:
      'Required: planningHabits[] (min 1), verificationBehavior, criticalThinkingMoments[], verificationAntiPatterns[]',
    communicationPatterns:
      'Required: communicationPatterns[] (min 1). Optional: signatureQuotes[]',
    learningBehavior:
      'Expected: knowledgeGaps[], repeatedMistakePatterns[], learningProgress[], recommendedResources[]',
    contextEfficiency:
      'Expected: inefficiencyPatterns[], contextUsagePatterns[], promptLengthTrends, avgContextFillPercent',
    sessionOutcome:
      'Required: sessionAnalyses[] (min 1, each with sessionId, sessionType, outcome). Optional: overallSuccessRate',
  };
  return hints[domain] ?? '';
}
