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
} from '@betterprompt/shared';
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
} as const;

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
    try { return JSON.parse(trimmed); } catch { return value; }
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

function validateContentQuality(
  strengths: Array<{ title: string; description: string; evidence: unknown[] }>,
  growthAreas: Array<{ title: string; description: string; recommendation: string; evidence: unknown[] }>,
): QualityIssue[] {
  const issues: QualityIssue[] = [];

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
  }

  return issues;
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
  const qualityIssues = validateContentQuality(parsed.data.strengths, parsed.data.growthAreas);
  if (qualityIssues.length > 0) {
    recordStageStatus(runId, parsed.data.domain, { status: 'failed', lastError: `Quality gate failed for "${parsed.data.domain}".` });
    return JSON.stringify({
      status: 'quality_error',
      message: `${qualityIssues.length} quality issue(s) detected. Expand the flagged fields and try again.`,
      issues: qualityIssues,
    });
  }

  // Save to database
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
