/**
 * Verbose Evaluation Schema
 *
 * Extended Zod schemas for hyper-personalized analysis report.
 * Contains both FREE tier content (shown to all) and PREMIUM tier content (locked).
 *
 * Note: Array size constraints (minItems/maxItems) are removed due to Gemini API
 * limitation that allows only ONE array with size constraints per schema.
 * Quantity targets are specified in prompts, and sanitization enforces minimums.
 */

import { z } from 'zod';
import { CodingStyleTypeSchema, AIControlLevelSchema } from './coding-style';
import { ProductivityAnalysisDataSchema } from './productivity-data';
import { AgentOutputsSchema } from './agent-outputs';
// Import and re-export dimension schema from the isolated file
import { DimensionNameEnumSchema, DIMENSION_NAMES, type DimensionNameEnum, type DimensionName } from './dimension-schema';
export { DimensionNameEnumSchema, DIMENSION_NAMES, type DimensionNameEnum, type DimensionName };

// ============================================================================
// ANALYZED SESSION INFO - Metadata about sessions included in analysis
// ============================================================================

/**
 * Information about a single session that was analyzed
 * Used to display which session files were included in the analysis
 */
export const AnalyzedSessionInfoSchema = z.object({
  fileName: z.string().describe('JSONL file name (e.g., "abc123.jsonl")'),
  sessionId: z.string().describe('Session UUID'),
  projectName: z.string().describe('Last segment of project path'),
  startTime: z.string().datetime().describe('Session start timestamp (ISO)'),
  messageCount: z.number().describe('Number of messages in session'),
  durationMinutes: z.number().describe('Session duration in minutes'),
});
export type AnalyzedSessionInfo = z.infer<typeof AnalyzedSessionInfoSchema>;

// ============================================================================
// FREE TIER SCHEMAS
// ============================================================================

/**
 * Personalized evidence with actual quotes
 * NOTE: min constraints removed - Gemini doesn't reliably follow minimum length requirements
 */
export const PersonalizedEvidenceSchema = z.object({
  quote: z.string().describe('Actual quote from the conversation (target: 20-500 chars)'),
  sessionDate: z.string().describe('When this was said (ISO date)'),
  context: z.string().describe('Brief context of what was being discussed'),
  significance: z.string().describe('What this reveals about their personality'),
  sentiment: z.enum(['positive', 'neutral', 'growth_opportunity']),
});
export type PersonalizedEvidence = z.infer<typeof PersonalizedEvidenceSchema>;

/**
 * Strength with personalized evidence
 * NOTE: min constraints removed - Gemini doesn't reliably follow minimum length requirements
 */
export const PersonalizedStrengthSchema = z.object({
  title: z.string().describe('Short title for this strength'),
  description: z.string().describe('Detailed description of this strength (target: 100-500 chars)'),
  evidence: z
    .array(PersonalizedEvidenceSchema)
    .describe('Quotes demonstrating this strength (target: 2-5)'),
  percentile: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('How this compares to other developers'),
});
export type PersonalizedStrength = z.infer<typeof PersonalizedStrengthSchema>;

/**
 * Severity level for growth areas
 * - critical: 70%+ occurrence or fundamental skill gap
 * - high: 40-70% occurrence or significant impact on productivity
 * - medium: 20-40% occurrence or moderate impact
 * - low: <20% occurrence or minor impact
 */
export const SeverityLevelSchema = z.enum(['critical', 'high', 'medium', 'low']);
export type SeverityLevel = z.infer<typeof SeverityLevelSchema>;

/**
 * Trend direction for growth areas over time
 */
export const TrendDirectionSchema = z.enum(['improving', 'stable', 'declining']);
export type TrendDirection = z.infer<typeof TrendDirectionSchema>;

/**
 * Growth area with specific examples
 * NOTE: min constraints removed - Gemini doesn't reliably follow minimum length requirements
 *
 * Enhanced with frequency, severity, priorityScore, and trend fields for
 * quantified assessment and prioritization.
 */
export const GrowthAreaSchema = z.object({
  title: z.string(),
  description: z.string().describe('Detailed description (target: 100-500 chars)'),
  evidence: z
    .array(PersonalizedEvidenceSchema)
    .describe('Examples showing this growth opportunity (target: 1-3)'),
  recommendation: z.string().describe('Specific, actionable recommendation'),
  resources: z
    .array(z.string())
    .optional()
    .describe('Links or resources to help (max 3)'),
  // Quantification fields for definitive assessment
  frequency: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Percentage of sessions where this pattern was observed (0-100)'),
  severity: SeverityLevelSchema.optional()
    .describe('How critical this growth area is to address'),
  priorityScore: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Computed priority based on frequency × impact (0-100)'),
  trend: TrendDirectionSchema.optional()
    .describe('Direction of this pattern over time'),
});
export type GrowthArea = z.infer<typeof GrowthAreaSchema>;

/**
 * Prompt pattern analysis (full schema for storage/display)
 */
export const PromptPatternSchema = z.object({
  patternName: z.string().describe('Distinctive name for this pattern'),
  description: z.string().describe('Detailed description of what this pattern is and why it matters'),
  frequency: z.enum(['frequent', 'occasional', 'rare']),
  examples: z
    .array(
      z.object({
        quote: z.string(),
        analysis: z.string(),
      })
    ),
  effectiveness: z.enum(['highly_effective', 'effective', 'could_improve']),
  tip: z.string().optional().describe('Educational tip with expert insights (600-1000 chars) from knowledge base'),
});
export type PromptPattern = z.infer<typeof PromptPatternSchema>;

/**
 * LLM Prompt pattern - FLATTENED for Gemini API compatibility
 * Uses semicolon-separated string for examples instead of nested array
 *
 * v3 format: examplesData contains utteranceIds, not quotes.
 * The actual quote text is looked up from Phase1Output in evaluation-assembler.
 */
export const LLMPromptPatternSchema = z.object({
  patternName: z.string().describe('Distinctive name for this pattern'),
  description: z.string().describe('Detailed description of what this pattern is and why it matters'),
  frequency: z.enum(['frequent', 'occasional', 'rare']),
  /** Examples as "utteranceId|analysis;utteranceId|analysis;..." format */
  examplesData: z.string().optional()
    .describe('Examples as "utteranceId|analysis;..." format - utteranceId references Developer Utterances'),
  effectiveness: z.enum(['highly_effective', 'effective', 'could_improve']),
  tip: z.string().optional().describe('Educational tip with expert insights (600-1000 chars) from knowledge base'),
});
export type LLMPromptPattern = z.infer<typeof LLMPromptPatternSchema>;

/**
 * Helper to parse examplesData string into array of {utteranceId, analysis}
 *
 * New format (v3): "utteranceId1|analysis1;utteranceId2|analysis2;..."
 * The actual quote text is looked up from Phase1Output using utteranceId.
 *
 * Legacy format support: If the first field looks like a quote (>50 chars or contains spaces),
 * it's treated as a direct quote for backward compatibility.
 */
export function parseExamplesData(data: string | undefined): Array<{ utteranceId: string; analysis: string }> {
  if (!data) return [];
  return data.split(';').filter(Boolean).map((s) => {
    const parts = s.split('|');
    const firstPart = parts[0] || '';
    // utteranceId format: "sessionId_turnIndex" (e.g., "abc123_5")
    // It should be relatively short and contain underscore
    const looksLikeUtteranceId = firstPart.length < 80 && firstPart.includes('_') && !firstPart.includes(' ');
    return {
      utteranceId: looksLikeUtteranceId ? firstPart : '',
      analysis: parts.slice(1).join('|') || '',
    };
  });
}

// ============================================================================
// PER-DIMENSION INSIGHT SCHEMAS (Score-Free)
// ============================================================================

/**
 * Human-readable display names for each dimension
 */
export const DIMENSION_DISPLAY_NAMES: Record<DimensionNameEnum, string> = {
  aiCollaboration: 'AI Collaboration Mastery',
  contextEngineering: 'Context Engineering',
  toolMastery: 'Tool Mastery',
  burnoutRisk: 'Burnout Risk Assessment',
  aiControl: 'AI Control Index',
  skillResilience: 'Skill Resilience',
};

/**
 * Structured evidence item with source tracking
 *
 * When evidence verification is available (Phase1Output provided),
 * evidence is stored as structured items with utteranceId for traceability.
 * This enables:
 * - Frontend display of evidence source (session + turn)
 * - Post-hoc auditing of evidence accuracy
 * - "View original" linking to session context
 */
export const EvidenceItemSchema = z.object({
  /** Reference to Phase1Output.developerUtterances.id (format: "{sessionId}_{turnIndex}") */
  utteranceId: z.string(),
  /** The verified quote from the developer */
  quote: z.string(),
  /** Session ID extracted from utteranceId (for session-level tracking) */
  sessionId: z.string().optional(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

/**
 * Evidence can be either plain strings (legacy/LLM output) or structured items (verified)
 *
 * - string[]: Legacy format from LLM output or older DB entries
 * - EvidenceItem[]: Verified evidence with utteranceId tracking (new format)
 *
 * Frontend should handle both: if item is a string, display as-is;
 * if item is an object with utteranceId, display with source metadata.
 */
export const EvidenceSchema = z.union([
  z.string(),
  EvidenceItemSchema,
]);
export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Strength within a specific dimension (full schema with evidence)
 * Used in VerboseEvaluation for storage and display
 *
 * Evidence supports both plain strings and structured EvidenceItems.
 */
export const DimensionStrengthSchema = z.object({
  title: z.string().describe('Descriptive title for this strength'),
  description: z.string().describe('Detailed description of what they do well (qualitative, no scores)'),
  evidence: z
    .array(EvidenceSchema)
    .optional()
    .describe('Quotes demonstrating this strength (target: 3-6 quotes)'),
});
export type DimensionStrength = z.infer<typeof DimensionStrengthSchema>;

/**
 * Growth area within a specific dimension (full schema with evidence)
 * Used in VerboseEvaluation for storage and display
 *
 * Enhanced with quantification fields for definitive assessment.
 */
export const DimensionGrowthAreaSchema = z.object({
  title: z.string().describe('Descriptive title for this growth area'),
  description: z.string().describe('Detailed description of what could improve (qualitative, no scores)'),
  evidence: z
    .array(EvidenceSchema)
    .optional()
    .describe('Quotes showing this opportunity (target: 2-4 quotes)'),
  recommendation: z.string().describe('Detailed, specific action to take with examples'),
  // Quantification fields
  frequency: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Percentage of sessions where this pattern was observed (0-100)'),
  severity: SeverityLevelSchema.optional()
    .describe('How critical this growth area is to address'),
  priorityScore: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Computed priority based on frequency × impact (0-100)'),
  trend: TrendDirectionSchema.optional()
    .describe('Direction of this pattern over time'),
});
export type DimensionGrowthArea = z.infer<typeof DimensionGrowthAreaSchema>;

// ============================================================================
// LLM-SPECIFIC SCHEMAS (FLATTENED for Gemini API max nesting depth ~4)
// ============================================================================

/**
 * Strength schema for LLM response - NO evidence field
 * Evidence is added in post-processing from Stage 1 data
 */
export const LLMDimensionStrengthSchema = z.object({
  title: z.string().describe('Descriptive title for this strength'),
  description: z.string().describe('Detailed description of what they do well (qualitative, no scores)'),
});

/**
 * Growth area schema for LLM response - NO evidence field
 * Evidence is added in post-processing from Stage 1 data
 *
 * Enhanced with optional quantification fields.
 */
export const LLMDimensionGrowthAreaSchema = z.object({
  title: z.string().describe('Descriptive title for this growth area'),
  description: z.string().describe('Detailed description of what could improve (qualitative, no scores)'),
  recommendation: z.string().describe('Detailed, specific action to take with examples'),
  frequency: z.number().min(0).max(100).optional().describe('Session occurrence percentage (0-100)'),
  severity: SeverityLevelSchema.optional().describe('critical|high|medium|low'),
  priorityScore: z.number().min(0).max(100).optional().describe('Computed priority (0-100)'),
});

/**
 * Per-dimension insight for LLM response - FLATTENED to reduce nesting
 *
 * Uses semicolon-separated strings instead of nested arrays to stay within
 * Gemini API's max nesting depth limit (~4 levels).
 *
 * Format:
 * - strengthsData: "clusterId|title|description;..."
 * - growthAreasData: "clusterId|title|description|recommendation|frequency|severity|priorityScore;..."
 *   - frequency: 0-100 (session occurrence percentage)
 *   - severity: critical|high|medium|low
 *   - priorityScore: 0-100 (computed from frequency × impact)
 */
export const LLMPerDimensionInsightSchema = z.object({
  dimension: DimensionNameEnumSchema,
  dimensionDisplayName: z.string().describe('Human-readable dimension name'),

  /** Strengths with clusterId: "clusterId|title|description;..." (clusterId for evidence matching) */
  strengthsData: z.string().optional()
    .describe('0-8 strengths as "clusterId|title|description;..." format - clusterId MUST match Stage 1 cluster'),

  /** Growth areas with quantification: "clusterId|title|description|recommendation|frequency|severity|priorityScore;..." */
  growthAreasData: z.string().optional()
    .describe('0-5 growth areas as "clusterId|title|desc|rec|freq|severity|priority;..." - include frequency (0-100), severity (critical/high/medium/low), priorityScore (0-100)'),
});

/**
 * Helper to parse strengthsData string into array of {clusterId?, title, description}
 * Supports both new format (clusterId|title|description) and legacy format (title|description)
 */
export function parseStrengthsData(data: string | undefined): Array<{ clusterId?: string; title: string; description: string }> {
  if (!data) return [];
  return data.split(';').filter(Boolean).map((s) => {
    const parts = s.split('|');
    if (parts.length >= 3) {
      // New format: clusterId|title|description
      return { clusterId: parts[0], title: parts[1], description: parts.slice(2).join('|') };
    } else if (parts.length === 2) {
      // Legacy format: title|description
      return { title: parts[0], description: parts[1] };
    }
    return { title: s, description: '' };
  });
}

/**
 * Parsed growth area with optional quantification fields
 */
export interface ParsedGrowthArea {
  clusterId?: string;
  title: string;
  description: string;
  recommendation: string;
  frequency?: number;
  severity?: SeverityLevel;
  priorityScore?: number;
}

/**
 * Helper to parse growthAreasData string into array of growth areas
 *
 * Supported formats:
 * - Extended (7 parts): "clusterId|title|desc|rec|freq|severity|priority;..."
 * - V3 (6 parts): "title|desc|rec|freq|severity|priority;..."
 * - Standard (4+ parts): "clusterId|title|desc|rec;..."
 * - Legacy (3 parts): "title|desc|rec;..."
 */
export function parseGrowthAreasData(data: string | undefined): ParsedGrowthArea[] {
  if (!data) return [];

  const validSeverities = ['critical', 'high', 'medium', 'low'];
  const parseSeverity = (s: string | undefined): SeverityLevel | undefined =>
    validSeverities.includes(s || '') ? (s as SeverityLevel) : undefined;
  const parseOptionalNumber = (s: string | undefined): number | undefined => {
    const n = parseFloat(s || '');
    return isNaN(n) ? undefined : n;
  };

  return data.split(';').filter(Boolean).map((s) => {
    const parts = s.split('|');
    const len = parts.length;

    if (len >= 7) {
      // Extended format with clusterId
      return {
        clusterId: parts[0],
        title: parts[1],
        description: parts[2],
        recommendation: parts[3],
        frequency: parseOptionalNumber(parts[4]),
        severity: parseSeverity(parts[5]),
        priorityScore: parseOptionalNumber(parts[6]),
      };
    }
    if (len === 6) {
      // V3 format without clusterId
      return {
        title: parts[0],
        description: parts[1],
        recommendation: parts[2],
        frequency: parseOptionalNumber(parts[3]),
        severity: parseSeverity(parts[4]),
        priorityScore: parseOptionalNumber(parts[5]),
      };
    }
    if (len >= 4) {
      // Standard format with clusterId
      return { clusterId: parts[0], title: parts[1], description: parts[2], recommendation: parts.slice(3).join('|') };
    }
    if (len === 3) {
      // Legacy format
      return { title: parts[0], description: parts[1], recommendation: parts[2] };
    }
    if (len === 2) {
      return { title: parts[0], description: parts[1], recommendation: '' };
    }
    return { title: s, description: '', recommendation: '' };
  });
}

/**
 * Per-dimension insight containing strengths and growth areas
 * This replaces the global strengths/growthAreas with dimension-specific ones
 */
export const PerDimensionInsightSchema = z.object({
  dimension: DimensionNameEnumSchema,
  dimensionDisplayName: z.string().describe('Human-readable dimension name'),
  strengths: z
    .array(DimensionStrengthSchema)
    .describe('0-8 strength clusters, each with multiple quotes for credibility'),
  growthAreas: z
    .array(DimensionGrowthAreaSchema)
    .describe('0-5 growth areas with evidence quotes and detailed recommendations'),
});
export type PerDimensionInsight = z.infer<typeof PerDimensionInsightSchema>;

// ============================================================================
// ACTIONABLE PRACTICES SCHEMAS (Knowledge-Driven Feedback)
// ============================================================================

/**
 * A practiced actionable advice with evidence
 * Shows what expert recommendations the developer followed
 */
export const PracticedAdviceSchema = z.object({
  patternId: z.string().describe('Pattern identifier from KNOWLEDGE_DRIVEN_PATTERNS'),
  advice: z.string().describe('The actionable advice that was practiced'),
  source: z.string().describe('Source of this advice (e.g., "Anthropic", "Karpathy")'),
  feedback: z.string().describe('Personalized feedback about this practice'),
  evidence: z.array(z.string()).describe('Quotes showing this practice'),
  dimension: z.string().describe('Related dimension'),
});
export type PracticedAdvice = z.infer<typeof PracticedAdviceSchema>;

/**
 * An opportunity to practice expert advice
 * Shows what recommendations could be adopted
 */
export const OpportunityAdviceSchema = z.object({
  patternId: z.string().describe('Pattern identifier from KNOWLEDGE_DRIVEN_PATTERNS'),
  advice: z.string().describe('The actionable advice to try'),
  source: z.string().describe('Source of this advice (e.g., "Anthropic", "Karpathy")'),
  tip: z.string().describe('Why and how to adopt this practice'),
  dimension: z.string().describe('Related dimension'),
  priority: z.number().min(1).max(10).describe('Priority of this advice'),
});
export type OpportunityAdvice = z.infer<typeof OpportunityAdviceSchema>;

/**
 * Actionable practices section - Knowledge-driven feedback
 * Links expert recommendations to actual developer behavior
 */
export const ActionablePracticesSchema = z.object({
  practiced: z.array(PracticedAdviceSchema).describe('Expert advice the developer followed'),
  opportunities: z.array(OpportunityAdviceSchema).describe('Expert advice to consider adopting'),
  summary: z.string().describe('Overall assessment of actionable practices'),
});
export type ActionablePractices = z.infer<typeof ActionablePracticesSchema>;

/**
 * LLM version of Practiced Advice (simplified for Gemini API)
 */
export const LLMPracticedAdviceSchema = z.object({
  patternId: z.string(),
  advice: z.string(),
  source: z.string(),
  feedback: z.string(),
  dimension: z.string(),
});

/**
 * LLM version of Opportunity Advice (simplified for Gemini API)
 */
export const LLMOpportunityAdviceSchema = z.object({
  patternId: z.string(),
  advice: z.string(),
  source: z.string(),
  tip: z.string(),
  dimension: z.string(),
  priority: z.number().min(1).max(10),
});

/**
 * LLM version of Actionable Practices (simplified for Gemini API)
 * Evidence is added in post-processing from Stage 1 data
 */
export const LLMActionablePracticesSchema = z.object({
  practiced: z.array(LLMPracticedAdviceSchema).describe('Expert advice the developer followed'),
  opportunities: z.array(LLMOpportunityAdviceSchema).describe('Expert advice to consider'),
  summary: z.string().describe('Overall assessment'),
});

// ============================================================================
// ANTI-PATTERNS ANALYSIS SCHEMAS (Premium/Enterprise)
// ============================================================================

/**
 * Individual anti-pattern with personalized feedback
 * Framed as "growth opportunity" rather than criticism
 */
export const AntiPatternInsightSchema = z.object({
  /** Type of anti-pattern */
  antiPatternType: z.string(),

  /** Human-readable display name (e.g., "The Retry Loop") */
  displayName: z.string(),

  /** Personalized description of what was observed */
  description: z.string(),

  /** How many times this pattern was observed */
  occurrences: z.number(),

  /** Severity assessment */
  severity: z.enum(['mild', 'moderate', 'significant']),

  /** Evidence quotes showing this pattern */
  evidence: z.array(z.string()).optional(),

  /** Supportive growth opportunity message */
  growthOpportunity: z.string(),

  /** Specific actionable tip */
  actionableTip: z.string(),
});
export type AntiPatternInsight = z.infer<typeof AntiPatternInsightSchema>;

/**
 * Complete anti-patterns analysis section
 * Premium/Enterprise only
 */
export const AntiPatternsAnalysisSchema = z.object({
  /** Detected anti-patterns with growth opportunities */
  detected: z.array(AntiPatternInsightSchema),

  /** Overall supportive summary */
  summary: z.string(),

  /** Health score (100 = no anti-patterns detected) */
  overallHealthScore: z.number().min(0).max(100),
});
export type AntiPatternsAnalysis = z.infer<typeof AntiPatternsAnalysisSchema>;

// ============================================================================
// CRITICAL THINKING ANALYSIS SCHEMAS (Premium/Enterprise)
// ============================================================================

/**
 * Individual critical thinking highlight
 * Celebrates verification and questioning behaviors
 */
export const CriticalThinkingHighlightSchema = z.object({
  /** Type of critical thinking behavior */
  indicatorType: z.string(),

  /** Human-readable title (e.g., "The Guardrail") */
  displayName: z.string(),

  /** Personalized description of the behavior */
  description: z.string(),

  /** How frequently observed */
  frequency: z.number(),

  /** Quality assessment */
  quality: z.enum(['basic', 'intermediate', 'advanced']),

  /** Evidence quotes showing this behavior */
  evidence: z.array(z.string()).optional(),

  /** Tip for further development */
  tip: z.string().optional(),
});
export type CriticalThinkingHighlight = z.infer<typeof CriticalThinkingHighlightSchema>;

/**
 * Complete critical thinking analysis section
 * Premium/Enterprise only
 */
export const CriticalThinkingAnalysisSchema = z.object({
  /** Critical thinking strengths observed */
  strengths: z.array(CriticalThinkingHighlightSchema),

  /** Opportunities to develop critical thinking */
  opportunities: z.array(CriticalThinkingHighlightSchema),

  /** Overall summary */
  summary: z.string(),

  /** Overall critical thinking score */
  overallScore: z.number().min(0).max(100),
});
export type CriticalThinkingAnalysis = z.infer<typeof CriticalThinkingAnalysisSchema>;

// ============================================================================
// PLANNING ANALYSIS SCHEMAS (Premium/Enterprise)
// ============================================================================

/**
 * Individual planning behavior insight
 * Assesses strategic thinking before implementation
 */
export const PlanningInsightSchema = z.object({
  /** Type of planning behavior */
  behaviorType: z.string(),

  /** Human-readable title (e.g., "The Master Planner") */
  displayName: z.string(),

  /** Personalized description */
  description: z.string(),

  /** Frequency of this behavior */
  frequency: z.number(),

  /** Sophistication level */
  sophistication: z.enum(['basic', 'intermediate', 'advanced']),

  /** Evidence quotes */
  evidence: z.array(z.string()).optional(),

  /** Tip for improvement */
  tip: z.string().optional(),
});
export type PlanningInsight = z.infer<typeof PlanningInsightSchema>;

/**
 * /plan command usage statistics
 * Key indicator of planning maturity
 */
export const SlashPlanStatsSchema = z.object({
  /** Total number of /plan command usages */
  totalUsage: z.number(),

  /** Average number of steps per plan */
  avgStepsPerPlan: z.number().optional(),

  /** Ratio of plans with problem decomposition (0-1) */
  problemDecompositionRate: z.number().min(0).max(1).optional(),
});
export type SlashPlanStats = z.infer<typeof SlashPlanStatsSchema>;

/**
 * Complete planning analysis section
 * Premium/Enterprise only
 */
export const PlanningAnalysisSchema = z.object({
  /** Planning strengths observed */
  strengths: z.array(PlanningInsightSchema),

  /** Opportunities to improve planning */
  opportunities: z.array(PlanningInsightSchema),

  /** Overall summary */
  summary: z.string(),

  /** Planning maturity level */
  planningMaturityLevel: z.enum(['reactive', 'emerging', 'structured', 'expert']),

  /** /plan command statistics (key indicator) */
  slashPlanStats: SlashPlanStatsSchema.optional(),
});
export type PlanningAnalysis = z.infer<typeof PlanningAnalysisSchema>;

// ============================================================================
// LLM-SPECIFIC PREMIUM SCHEMAS (No evidence fields for Gemini API)
// Evidence is added in post-processing from Stage 1 data
// ============================================================================

/**
 * LLM Anti-Pattern Insight - NO evidence field
 */
export const LLMAntiPatternInsightSchema = z.object({
  antiPatternType: z.string(),
  displayName: z.string(),
  description: z.string(),
  occurrences: z.number(),
  severity: z.enum(['mild', 'moderate', 'significant']),
  growthOpportunity: z.string(),
  actionableTip: z.string(),
});

/**
 * LLM Anti-Patterns Analysis - Uses schema without evidence
 */
export const LLMAntiPatternsAnalysisSchema = z.object({
  detected: z.array(LLMAntiPatternInsightSchema),
  summary: z.string(),
  overallHealthScore: z.number().min(0).max(100),
});

/**
 * LLM Critical Thinking Highlight - NO evidence field
 */
export const LLMCriticalThinkingHighlightSchema = z.object({
  indicatorType: z.string(),
  displayName: z.string(),
  description: z.string(),
  frequency: z.number(),
  quality: z.enum(['basic', 'intermediate', 'advanced']),
  tip: z.string().optional(),
});

/**
 * LLM Critical Thinking Analysis - Uses schema without evidence
 */
export const LLMCriticalThinkingAnalysisSchema = z.object({
  strengths: z.array(LLMCriticalThinkingHighlightSchema),
  opportunities: z.array(LLMCriticalThinkingHighlightSchema),
  summary: z.string(),
  overallScore: z.number().min(0).max(100),
});

/**
 * LLM Planning Insight - NO evidence field
 */
export const LLMPlanningInsightSchema = z.object({
  behaviorType: z.string(),
  displayName: z.string(),
  description: z.string(),
  frequency: z.number(),
  sophistication: z.enum(['basic', 'intermediate', 'advanced']),
  tip: z.string().optional(),
});

/**
 * LLM Planning Analysis - Uses schema without evidence
 */
export const LLMPlanningAnalysisSchema = z.object({
  strengths: z.array(LLMPlanningInsightSchema),
  opportunities: z.array(LLMPlanningInsightSchema),
  summary: z.string(),
  planningMaturityLevel: z.enum(['reactive', 'emerging', 'structured', 'expert']),
  slashPlanStats: SlashPlanStatsSchema.optional(),
});

/**
 * LLM Top Focus Area - NO nested actions object for flatter structure
 * Actions are added in post-processing
 */
export const LLMTopFocusAreaSchema = z.object({
  rank: z.number().min(1).max(3),
  dimension: DimensionNameEnumSchema,
  title: z.string(),
  narrative: z.string(),
  expectedImpact: z.string(),
  priorityScore: z.number().min(0).max(100),
  /** Flattened actions: "start|stop|continue" format */
  actionsData: z.string().optional()
    .describe('Actions as "start|stop|continue" format'),
});

/**
 * LLM Top Focus Areas - Uses flattened schema
 */
export const LLMTopFocusAreasSchema = z.object({
  areas: z.array(LLMTopFocusAreaSchema).max(3),
  summary: z.string(),
});

/**
 * Helper to parse actionsData string into FocusAreaActions
 */
export function parseActionsData(data: string | undefined): { start: string; stop: string; continue: string } | undefined {
  if (!data) return undefined;
  const [start, stop, cont] = data.split('|');
  return {
    start: start || '',
    stop: stop || '',
    continue: cont || '',
  };
}

// ============================================================================
// TOP FOCUS AREAS SCHEMA (Personalized Priorities from Stage 1)
// ============================================================================

/**
 * Action steps for a focus area (START/STOP/CONTINUE framework)
 */
export const FocusAreaActionsSchema = z.object({
  /** What to START doing */
  start: z.string(),
  /** What to STOP doing */
  stop: z.string(),
  /** What to CONTINUE doing */
  continue: z.string(),
});
export type FocusAreaActions = z.infer<typeof FocusAreaActionsSchema>;

/**
 * Single top focus area with personalized narrative
 * Transformed from Stage 1's personalizedPriorities
 */
export const TopFocusAreaSchema = z.object({
  /** Priority rank (1, 2, or 3) */
  rank: z.number().min(1).max(3),

  /** Which dimension this priority relates to */
  dimension: DimensionNameEnumSchema,

  /** Specific focus area title */
  title: z.string(),

  /** WHY this matters for this developer (narrative) */
  narrative: z.string(),

  /** Expected impact if they focus on this */
  expectedImpact: z.string(),

  /** Priority score (0-100) from Stage 1 calculation */
  priorityScore: z.number().min(0).max(100),

  /** Specific action steps */
  actions: FocusAreaActionsSchema.optional(),
});
export type TopFocusArea = z.infer<typeof TopFocusAreaSchema>;

/**
 * Top 3 Focus Areas section
 * The MOST ACTIONABLE part of the report
 */
export const TopFocusAreasSchema = z.object({
  /** Top 3 personalized priorities */
  areas: z.array(TopFocusAreaSchema).max(3),

  /** Overall summary explaining the selection */
  summary: z.string(),
});
export type TopFocusAreas = z.infer<typeof TopFocusAreasSchema>;

// ============================================================================
// PREMIUM TIER SCHEMAS (LOCKED)
// ============================================================================

/**
 * Tool usage insight (PREMIUM)
 */
export const ToolUsageInsightSchema = z.object({
  toolName: z.string(),
  usageCount: z.number(),
  usagePercentage: z.number(),
  insightTitle: z.string(),
  insight: z.string(),
  comparison: z.string().describe('How this compares to typical usage'),
  recommendation: z.string().optional(),
});
export type ToolUsageInsight = z.infer<typeof ToolUsageInsightSchema>;

/**
 * Token efficiency analysis (PREMIUM)
 */
export const TokenEfficiencySchema = z.object({
  averageTokensPerSession: z.number(),
  tokenEfficiencyScore: z.number().min(0).max(100),
  efficiencyLevel: z.enum(['highly_efficient', 'efficient', 'average', 'could_optimize']),
  insights: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        impact: z.enum(['high', 'medium', 'low']),
      })
    ),
  savingsEstimate: z.string().describe('Estimated monthly savings if optimized'),
});
export type TokenEfficiency = z.infer<typeof TokenEfficiencySchema>;

/**
 * Personalized growth roadmap (PREMIUM)
 */
export const GrowthRoadmapSchema = z.object({
  currentLevel: z.enum(['beginner', 'developing', 'proficient', 'expert']),
  nextMilestone: z.string(),
  steps: z
    .array(
      z.object({
        order: z.number(),
        title: z.string(),
        description: z.string(),
        timeEstimate: z.string(),
        metrics: z.string().describe('How to measure progress'),
      })
    ),
  estimatedTimeToNextLevel: z.string(),
});
export type GrowthRoadmap = z.infer<typeof GrowthRoadmapSchema>;

/**
 * Comparative insights (PREMIUM)
 */
export const ComparativeInsightSchema = z.object({
  metric: z.string(),
  yourValue: z.number(),
  averageValue: z.number(),
  percentile: z.number().min(0).max(100),
  interpretation: z.string(),
});
export type ComparativeInsight = z.infer<typeof ComparativeInsightSchema>;

/**
 * Session trend (PREMIUM)
 */
export const SessionTrendSchema = z.object({
  metricName: z.string(),
  direction: z.enum(['improving', 'stable', 'declining']),
  description: z.string(),
  dataPoints: z
    .array(
      z.object({
        sessionDate: z.string(),
        value: z.number(),
      })
    ),
});
export type SessionTrend = z.infer<typeof SessionTrendSchema>;

// ============================================================================
// TRANSLATED AGENT INSIGHTS SCHEMA (for non-English output)
// ============================================================================

/**
 * Translated Agent Insight Schema
 *
 * Contains translated strengths and growth areas for a single agent.
 * Uses flattened semicolon-separated strings to comply with Gemini's nesting limit.
 *
 * Format:
 * - strengthsData: "title|description|quote1,quote2;title2|description2|quotes;..."
 * - growthAreasData: "title|description|evidence|recommendation|frequency|severity|priorityScore;..."
 */
export const TranslatedAgentInsightSchema = z.object({
  /** Strengths as "title|description|quote1,quote2;..." format */
  strengthsData: z.string().optional()
    .describe('Translated strengths as "title|description|quote1,quote2;..." format'),
  /** Growth areas as "title|desc|evidence|rec|freq|severity|priority;..." format */
  growthAreasData: z.string().optional()
    .describe('Translated growth areas as "title|desc|evidence|rec|freq|severity|priority;..." format'),
});
export type TranslatedAgentInsight = z.infer<typeof TranslatedAgentInsightSchema>;

/**
 * Translated Agent Insights for all agents
 *
 * Contains translated strengths/growthAreas for each agent.
 * Only populated when output language is non-English.
 * Frontend should use this when available, falling back to original agentOutputs.
 */
export const TranslatedAgentInsightsSchema = z.object({
  // Legacy agents (kept for cached data compatibility)
  knowledgeGap: TranslatedAgentInsightSchema.optional(),
  contextEfficiency: TranslatedAgentInsightSchema.optional(),
  temporalAnalysis: TranslatedAgentInsightSchema.optional(),
  // v3 workers - translations handled differently (in worker output directly)
});
export type TranslatedAgentInsights = z.infer<typeof TranslatedAgentInsightsSchema>;

// ============================================================================
// KNOWLEDGE RESOURCES SCHEMA (Deterministic Matching)
// ============================================================================

/**
 * A knowledge item matched to a growth area dimension via two-level matching.
 *
 * Level 1: Dimension filter (mandatory — item.applicableDimensions overlaps growth area dimensions)
 * Level 2: Relevance ranking (tag overlap + subCategory overlap)
 */
export const MatchedKnowledgeItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  sourceUrl: z.string(),
  sourceAuthor: z.string().optional(),
  contentType: z.string(),
  tags: z.array(z.string()),
  /** Original relevance score from knowledge item (0-1) */
  relevanceScore: z.number().min(0).max(1),
  /** Combined match score from 2-level matching (0-10) */
  matchScore: z.number().min(0).max(10),
});
export type MatchedKnowledgeItem = z.infer<typeof MatchedKnowledgeItemSchema>;

/**
 * A professional insight matched to a growth area dimension via two-level matching.
 *
 * Level 1: Dimension filter (mandatory — insight.applicableDimensions contains dimension)
 * Level 2: Style + control level boosting from TypeClassifier output
 */
export const MatchedProfessionalInsightSchema = z.object({
  id: z.string(),
  title: z.string(),
  keyTakeaway: z.string(),
  actionableAdvice: z.array(z.string()),
  sourceAuthor: z.string(),
  sourceUrl: z.string(),
  category: z.string(),
  priority: z.number(),
  /** Combined match score from 2-level matching (0-10) */
  matchScore: z.number().min(0).max(10),
});
export type MatchedProfessionalInsight = z.infer<typeof MatchedProfessionalInsightSchema>;

/**
 * Knowledge resources matched to a single dimension.
 *
 * Groups all matched knowledge items and professional insights for one dimension.
 * Per-dimension grouping (not per-growth-area) avoids duplicate resources when
 * multiple growth areas share a dimension.
 */
export const DimensionResourceMatchSchema = z.object({
  dimension: DimensionNameEnumSchema,
  dimensionDisplayName: z.string(),
  knowledgeItems: z.array(MatchedKnowledgeItemSchema),
  professionalInsights: z.array(MatchedProfessionalInsightSchema),
});
export type DimensionResourceMatch = z.infer<typeof DimensionResourceMatchSchema>;

// ============================================================================
// TRANSFORMATION AUDIT SCHEMA (Data Integrity Tracking)
// ============================================================================

/**
 * Transformation type for audit trail
 *
 * Tracks what kind of transformation was applied to the original text:
 * - 'none': No transformation, displayText = original text
 * - 'system_tag_removed': System-injected tags were stripped
 * - 'error_summarized': Error messages were summarized to [Error: ...]
 * - 'stack_trace_summarized': Stack traces were replaced with [Stack trace]
 * - 'code_block_summarized': Code blocks were replaced with [Code: ...]
 * - 'truncated': Text was truncated due to length limits
 * - 'mixed': Multiple transformation types applied
 */
export const TransformationTypeSchema = z.enum([
  'none',
  'system_tag_removed',
  'error_summarized',
  'stack_trace_summarized',
  'code_block_summarized',
  'truncated',
  'mixed',
]);
export type TransformationType = z.infer<typeof TransformationTypeSchema>;

/**
 * Individual transformation segment within an utterance.
 *
 * Records exactly what was changed and why, enabling:
 * - Post-hoc audit of text transformations
 * - Debugging LLM behavior
 * - User transparency ("why does my text look different?")
 */
export const TransformationSegmentSchema = z.object({
  /** Original text before transformation */
  original: z.string(),

  /** Transformed text after processing */
  transformed: z.string(),

  /** Why this transformation was applied */
  reason: z.string(),

  /** Start position in original text (for segment-level tracking) */
  startPos: z.number().optional(),

  /** End position in original text */
  endPos: z.number().optional(),
});
export type TransformationSegment = z.infer<typeof TransformationSegmentSchema>;

/**
 * Transformation audit entry for a single utterance.
 *
 * Provides complete traceability from original developer text to displayed text.
 * Enables:
 * - Data integrity verification
 * - Debugging LLM displayText generation issues
 * - User transparency about what was changed
 * - Compliance auditing (did we preserve developer intent?)
 */
export const TransformationAuditEntrySchema = z.object({
  /** Utterance ID (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),

  /** Original text before any transformation */
  originalText: z.string(),

  /** Final display text after all transformations */
  displayText: z.string(),

  /** Primary transformation type applied */
  transformationType: TransformationTypeSchema,

  /** Whether original text matches displayText exactly */
  isVerbatim: z.boolean(),

  /** Compression ratio (displayText.length / originalText.length) */
  compressionRatio: z.number().min(0).max(1),

  /** Detailed segments showing what was transformed */
  transformedSegments: z.array(TransformationSegmentSchema).optional(),

  /** Timestamp when transformation was applied */
  transformedAt: z.string().optional(),

  /** Whether this transformation passed validation */
  validationPassed: z.boolean().optional(),

  /** Validation failure reason (if any) */
  validationFailureReason: z.string().optional(),
});
export type TransformationAuditEntry = z.infer<typeof TransformationAuditEntrySchema>;

// ============================================================================
// UTTERANCE LOOKUP SCHEMA (for evidence linking)
// ============================================================================

/**
 * Utterance lookup entry for evidence linking.
 *
 * Enables frontend to display full original text when user expands
 * an evidence item that references a specific utterance by ID.
 *
 * Only utterances referenced by Worker evidence are included to minimize payload size.
 */
export const UtteranceLookupEntrySchema = z.object({
  /** Utterance ID (format: {sessionId}_{turnIndex}) */
  id: z.string(),
  /** Full original text of the developer's message */
  text: z.string(),
  /** Timestamp of the message (ISO 8601) */
  timestamp: z.string(),
  /** Session ID extracted from the utterance ID */
  sessionId: z.string(),
  /** Turn index within the session */
  turnIndex: z.number(),
  /**
   * Snippet of the preceding AI response for context display.
   *
   * Shows what the AI said before this developer message,
   * helping explain WHY the developer said what they said.
   * Truncated to ~150 chars for display purposes.
   */
  precedingAISnippet: z.string().optional(),
});
export type UtteranceLookupEntry = z.infer<typeof UtteranceLookupEntrySchema>;

// ============================================================================
// COMPLETE VERBOSE EVALUATION SCHEMA
// ============================================================================

/**
 * Complete verbose evaluation schema
 */
export const VerboseEvaluationSchema = z.object({
  // Metadata
  sessionId: z.string(),
  analyzedAt: z.string().datetime(),
  sessionsAnalyzed: z.number(),

  // Session metrics (computed, not from LLM)
  avgPromptLength: z.number().optional(),
  avgTurnsPerSession: z.number().optional(),

  // Analyzed session files (metadata for display)
  analyzedSessions: z.array(AnalyzedSessionInfoSchema).optional()
    .describe('List of session files that were analyzed'),

  // Type result (same as before)
  primaryType: CodingStyleTypeSchema,
  controlLevel: AIControlLevelSchema,
  controlScore: z.number().min(0).max(100).optional()
    .describe('Raw control score (0-100) for level distribution calculation'),
  distribution: z.object({
    architect: z.number().min(0).max(100),
    scientist: z.number().min(0).max(100),
    collaborator: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    craftsman: z.number().min(0).max(100),
  }),

  // FREE TIER - Verbose content
  // NOTE: min constraint removed - Gemini doesn't reliably follow minimum length requirements
  personalitySummary: z
    .string()
    .describe('Hyper-personalized summary of their AI coding personality (target: 300-3000 chars)'),

  // Per-dimension insights (replaces global strengths/growthAreas)
  dimensionInsights: z
    .array(PerDimensionInsightSchema)
    .length(6)
    .describe('Insights for each of the 6 analysis dimensions'),

  // DEPRECATED: Keep for backward compatibility, but prefer dimensionInsights
  strengths: z.array(PersonalizedStrengthSchema).optional(),
  growthAreas: z.array(GrowthAreaSchema).optional(),

  promptPatterns: z.array(PromptPatternSchema),

  // Actionable Practices (knowledge-driven feedback, evidence in Stage 1's actionablePatternMatches)
  actionablePractices: LLMActionablePracticesSchema.optional()
    .describe('Expert recommendations practiced/missed by the developer'),

  // Anti-Patterns Analysis (Premium/Enterprise)
  antiPatternsAnalysis: AntiPatternsAnalysisSchema.optional()
    .describe('Anti-patterns detected with growth opportunities'),

  // Critical Thinking Analysis (Premium/Enterprise)
  criticalThinkingAnalysis: CriticalThinkingAnalysisSchema.optional()
    .describe('Critical thinking behaviors analysis'),

  // Planning Analysis (Premium/Enterprise)
  planningAnalysis: PlanningAnalysisSchema.optional()
    .describe('Planning behaviors analysis'),

  // Top 3 Focus Areas (from Stage 1 personalizedPriorities)
  topFocusAreas: TopFocusAreasSchema.optional()
    .describe('Top 3 personalized priorities - the MOST ACTIONABLE part'),

  // Productivity Analysis (from Module C)
  productivityAnalysis: ProductivityAnalysisDataSchema.optional()
    .describe('Productivity metrics including iteration efficiency, learning velocity, and collaboration effectiveness'),

  // Agent Outputs (Phase 2 Workers - Premium only)
  agentOutputs: AgentOutputsSchema.optional()
    .describe('Insights from Phase 2 workers: ThinkingQuality, LearningBehavior, ContextEfficiency, TypeClassifier'),

  // Worker Insights - Aggregated strengths/growthAreas from each Phase 2 worker
  // This is the NEW preferred way to access domain-specific insights.
  // Each worker's insights are keyed by worker domain (thinkingQuality, learningBehavior, etc.)
  // Frontend should use this for the "Your Insights" tab with 3 worker sections.
  workerInsights: z.record(z.string(), z.object({
    strengths: z.array(z.object({
      title: z.string(),
      description: z.string(),
      evidence: z.array(z.union([
        z.string(),
        z.object({
          utteranceId: z.string(),
          quote: z.string(),
          context: z.string().optional(),
        }),
      ])),
      frequency: z.number().optional(),
    })),
    growthAreas: z.array(z.object({
      title: z.string(),
      description: z.string(),
      evidence: z.array(z.union([
        z.string(),
        z.object({
          utteranceId: z.string(),
          quote: z.string(),
          context: z.string().optional(),
        }),
      ])),
      recommendation: z.string(),
      severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
      frequency: z.number().optional(),
    })),
    domainScore: z.number().optional(),
  })).optional()
    .describe('Domain-specific strengths/growthAreas from Phase 2 workers (replaces StrengthGrowthSynthesizer)'),

  // Utterance Lookup - Map of utterance IDs to full text for evidence linking
  // Only includes utterances referenced by Worker evidence to minimize payload size.
  // Frontend uses this to show original context when user expands an evidence item.
  utteranceLookup: z.array(UtteranceLookupEntrySchema).optional()
    .describe('Utterance lookup for evidence linking - only referenced utterances are included'),

  // Transformation Audit - Tracks how original text was transformed to displayText
  // Enables data integrity verification, debugging, and user transparency.
  // Only includes utterances where transformations occurred.
  transformationAudit: z.array(TransformationAuditEntrySchema).optional()
    .describe('Audit trail of text transformations for data integrity verification'),

  // Matched Knowledge Resources (Phase 2.75 - deterministic matching)
  knowledgeResources: z.array(DimensionResourceMatchSchema).optional()
    .describe('Matched learning resources per dimension from Knowledge Base'),

  // PREMIUM TIER - Locked content
  toolUsageDeepDive: z.array(ToolUsageInsightSchema).optional(),
  tokenEfficiency: TokenEfficiencySchema.optional(),
  growthRoadmap: GrowthRoadmapSchema.optional(),
  comparativeInsights: z.array(ComparativeInsightSchema).optional(),
  sessionTrends: z.array(SessionTrendSchema).optional(),

  // Pipeline token usage (actual values from LLM API responses)
  pipelineTokenUsage: z.object({
    stages: z.array(z.object({
      stage: z.string(),
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    })),
    totals: z.object({
      promptTokens: z.number(),
      completionTokens: z.number(),
      totalTokens: z.number(),
    }),
    cost: z.object({
      inputCost: z.number(),
      outputCost: z.number(),
      totalCost: z.number(),
    }),
    model: z.string(),
    modelName: z.string(),
  }).optional().describe('Actual token usage and cost from LLM API calls'),

  // Analysis metadata (confidence scores, data quality)
  analysisMetadata: z.object({
    /** Overall confidence score (0-1, weighted average of agent scores) */
    overallConfidence: z.number().min(0).max(1),
    /** Confidence scores by individual agent */
    agentConfidences: z.array(z.object({
      agentId: z.string(),
      agentName: z.string(),
      confidenceScore: z.number().min(0).max(1),
    })).optional(),
    /** Total messages analyzed across all sessions */
    totalMessagesAnalyzed: z.number().int().min(0),
    /** Date range of analyzed sessions */
    analysisDateRange: z.object({
      earliest: z.string().datetime(),
      latest: z.string().datetime(),
    }).optional(),
    /** Data quality indicator: high (10+), medium (5-9), low (<5 sessions) */
    dataQuality: z.enum(['high', 'medium', 'low']),
    /** Minimum confidence threshold applied */
    confidenceThreshold: z.number().min(0).max(1).optional(),
    /** Number of insights filtered due to low confidence */
    insightsFiltered: z.number().int().min(0).optional(),
  }).optional().describe('Analysis metadata for transparency and trust'),

  // Translated Agent Insights (for non-English output)
  // Frontend should use this when available, falling back to agentOutputs
  translatedAgentInsights: TranslatedAgentInsightsSchema.optional()
    .describe('Translated agent insights for non-English output'),
});
export type VerboseEvaluation = z.infer<typeof VerboseEvaluationSchema>;

/**
 * LLM Response schema - FLATTENED for Gemini API compatibility
 *
 * Key differences from VerboseEvaluation:
 * - Uses LLMPerDimensionInsightSchema with flattened strengthsData/growthAreasData strings
 * - Uses LLMPromptPatternSchema with flattened examplesData string
 * - Evidence is added in post-processing from Stage 1 data
 *
 * Gemini API max nesting depth: ~4 levels
 * Flattened arrays use semicolon-separated string format to avoid deep nesting.
 */
export const VerboseLLMResponseSchema = z.object({
  // Type classification
  primaryType: CodingStyleTypeSchema,
  controlLevel: AIControlLevelSchema,
  controlScore: z.number().min(0).max(100).optional()
    .describe('Raw control score (0-100) for level distribution calculation'),
  distribution: z.object({
    architect: z.number().min(0).max(100),
    scientist: z.number().min(0).max(100),
    collaborator: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    craftsman: z.number().min(0).max(100),
  }),

  // Content
  // NOTE: min constraint removed - Gemini doesn't reliably follow minimum length requirements
  personalitySummary: z
    .string()
    .describe('Hyper-personalized summary of their AI coding personality (target: 300-3000 chars)'),

  // Dimension insights with REDUCED nesting (no evidence field)
  dimensionInsights: z
    .array(LLMPerDimensionInsightSchema)
    .length(6)
    .describe('Insights for each of the 6 analysis dimensions'),

  // Prompt patterns (FLATTENED: uses examplesData string instead of nested array)
  promptPatterns: z.array(LLMPromptPatternSchema),

  // Actionable practices (transformed from Stage 1 actionablePatternMatches)
  actionablePractices: LLMActionablePracticesSchema.optional()
    .describe('Expert recommendations practiced/missed'),

  // Anti-Patterns Analysis (Premium/Enterprise) - LLM version without evidence
  antiPatternsAnalysis: LLMAntiPatternsAnalysisSchema.optional()
    .describe('Anti-patterns detected with growth opportunities'),

  // Critical Thinking Analysis (Premium/Enterprise) - LLM version without evidence
  criticalThinkingAnalysis: LLMCriticalThinkingAnalysisSchema.optional()
    .describe('Critical thinking behaviors analysis'),

  // Planning Analysis (Premium/Enterprise) - LLM version without evidence
  planningAnalysis: LLMPlanningAnalysisSchema.optional()
    .describe('Planning behaviors analysis'),

  // Top 3 Focus Areas (from Stage 1) - LLM version with flattened actions
  topFocusAreas: LLMTopFocusAreasSchema.optional()
    .describe('Top 3 personalized priorities - the MOST ACTIONABLE part'),

  // Translated Agent Insights (for non-English output)
  // Contains translated strengths/growthAreas from all agents
  // Only populated when output language is non-English
  translatedAgentInsights: TranslatedAgentInsightsSchema.optional()
    .describe('Translated agent insights for non-English output - use when available'),
});
export type VerboseLLMResponse = z.infer<typeof VerboseLLMResponseSchema>;

/**
 * Narrative-only LLM Response schema for Phase 3 Content Writer
 *
 * Phase 3 LLM generates ONLY content that doesn't exist in Phase 2:
 * - personalitySummary: Synthesized personality narrative
 * - promptPatterns: FALLBACK only - prefer Phase 2 CommunicationPatterns
 * - topFocusAreas: Narrative-enriched focus areas (optional)
 *
 * NOTE: promptPatterns generation moved to Phase 2 CommunicationPatternsWorker.
 * Phase 3 promptPatterns is kept for backward compatibility but evaluation-assembler
 * will prefer Phase 2 data when available.
 *
 * All structural/quantitative data (dimensionInsights, type classification,
 * premium sections, actionablePractices) are assembled deterministically
 * from Phase 2 outputs by the evaluation-assembler module.
 */
export const NarrativeLLMResponseSchema = z.object({
  // Narrative content (Phase 2 doesn't produce these)
  // Note: No .max() - LLM may exceed target; truncation handled in evaluation-assembler
  personalitySummary: z
    .string()
    .describe('Hyper-personalized summary of their AI coding personality (target: 2500-3000 chars, will be truncated if exceeded)'),

  // Prompt patterns with WHAT-WHY-HOW analysis
  // NOTE: This is FALLBACK only - Phase 2 CommunicationPatterns is preferred
  // Kept for backward compatibility with older pipelines
  promptPatterns: z.array(LLMPromptPatternSchema).optional()
    .describe('FALLBACK: Prompt patterns (prefer Phase 2 CommunicationPatterns when available)'),

  // Top 3 Focus Areas narrative (optional - may fall back to Phase 2 data)
  topFocusAreas: LLMTopFocusAreasSchema.optional()
    .describe('Top 3 personalized priorities with narrative enrichment'),
});
export type NarrativeLLMResponse = z.infer<typeof NarrativeLLMResponseSchema>;
