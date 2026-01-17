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
 */
export const PersonalizedEvidenceSchema = z.object({
  quote: z.string().min(20).max(500).describe('Actual quote from the conversation'),
  sessionDate: z.string().describe('When this was said (ISO date)'),
  context: z.string().max(200).describe('Brief context of what was being discussed'),
  significance: z.string().max(300).describe('What this reveals about their personality'),
  sentiment: z.enum(['positive', 'neutral', 'growth_opportunity']),
});
export type PersonalizedEvidence = z.infer<typeof PersonalizedEvidenceSchema>;

/**
 * Strength with personalized evidence
 */
export const PersonalizedStrengthSchema = z.object({
  title: z.string().max(50).describe('Short title for this strength'),
  description: z.string().min(100).max(500).describe('Detailed description of this strength'),
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
 * Growth area with specific examples
 */
export const GrowthAreaSchema = z.object({
  title: z.string().max(50),
  description: z.string().min(100).max(500),
  evidence: z
    .array(PersonalizedEvidenceSchema)
    .describe('Examples showing this growth opportunity (target: 1-3)'),
  recommendation: z.string().max(300).describe('Specific, actionable recommendation'),
  resources: z
    .array(z.string())
    .optional()
    .describe('Links or resources to help (max 3)'),
});
export type GrowthArea = z.infer<typeof GrowthAreaSchema>;

/**
 * Prompt pattern analysis (full schema for storage/display)
 */
export const PromptPatternSchema = z.object({
  patternName: z.string().max(80).describe('Distinctive name for this pattern'),
  description: z.string().max(500).describe('Detailed description of what this pattern is and why it matters'),
  frequency: z.enum(['frequent', 'occasional', 'rare']),
  examples: z
    .array(
      z.object({
        quote: z.string().max(500),
        analysis: z.string().max(300),
      })
    ),
  effectiveness: z.enum(['highly_effective', 'effective', 'could_improve']),
  tip: z.string().max(400).optional().describe('Detailed tip with examples to improve or continue this pattern'),
});
export type PromptPattern = z.infer<typeof PromptPatternSchema>;

/**
 * LLM Prompt pattern - FLATTENED for Gemini API compatibility
 * Uses semicolon-separated string for examples instead of nested array
 */
export const LLMPromptPatternSchema = z.object({
  patternName: z.string().max(80).describe('Distinctive name for this pattern'),
  description: z.string().max(500).describe('Detailed description of what this pattern is and why it matters'),
  frequency: z.enum(['frequent', 'occasional', 'rare']),
  /** Examples as "quote|analysis;quote|analysis;..." format */
  examplesData: z.string().max(3000).optional()
    .describe('Examples as "quote|analysis;quote|analysis;..." format'),
  effectiveness: z.enum(['highly_effective', 'effective', 'could_improve']),
  tip: z.string().max(400).optional().describe('Detailed tip with examples to improve or continue this pattern'),
});
export type LLMPromptPattern = z.infer<typeof LLMPromptPatternSchema>;

/**
 * Helper to parse examplesData string into array of {quote, analysis}
 */
export function parseExamplesData(data: string | undefined): Array<{ quote: string; analysis: string }> {
  if (!data) return [];
  return data.split(';').filter(Boolean).map((s) => {
    const [quote, analysis] = s.split('|');
    return { quote: quote || '', analysis: analysis || '' };
  });
}

// ============================================================================
// PER-DIMENSION INSIGHT SCHEMAS (Score-Free)
// ============================================================================

/**
 * The 6 analysis dimensions
 */
export const DimensionNameEnumSchema = z.enum([
  'aiCollaboration',
  'contextEngineering',
  'toolMastery',
  'burnoutRisk',
  'aiControl',
  'skillResilience',
]);
export type DimensionNameEnum = z.infer<typeof DimensionNameEnumSchema>;

/**
 * Array of all dimension names, derived from the schema
 * Use this constant instead of hardcoding dimension arrays
 */
export const DIMENSION_NAMES = DimensionNameEnumSchema.options;

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
 * Strength within a specific dimension (full schema with evidence)
 * Used in VerboseEvaluation for storage and display
 */
export const DimensionStrengthSchema = z.object({
  title: z.string().max(80).describe('Descriptive title for this strength'),
  description: z.string().max(500).describe('Detailed description of what they do well (qualitative, no scores)'),
  evidence: z
    .array(z.string().max(1200))
    .optional()
    .describe('Quotes demonstrating this strength (target: 3-6 quotes)'),
});
export type DimensionStrength = z.infer<typeof DimensionStrengthSchema>;

/**
 * Growth area within a specific dimension (full schema with evidence)
 * Used in VerboseEvaluation for storage and display
 */
export const DimensionGrowthAreaSchema = z.object({
  title: z.string().max(80).describe('Descriptive title for this growth area'),
  description: z.string().max(500).describe('Detailed description of what could improve (qualitative, no scores)'),
  evidence: z
    .array(z.string().max(1200))
    .optional()
    .describe('Quotes showing this opportunity (target: 2-4 quotes)'),
  recommendation: z.string().max(400).describe('Detailed, specific action to take with examples'),
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
  title: z.string().max(80).describe('Descriptive title for this strength'),
  description: z.string().max(500).describe('Detailed description of what they do well (qualitative, no scores)'),
});

/**
 * Growth area schema for LLM response - NO evidence field
 * Evidence is added in post-processing from Stage 1 data
 */
export const LLMDimensionGrowthAreaSchema = z.object({
  title: z.string().max(80).describe('Descriptive title for this growth area'),
  description: z.string().max(500).describe('Detailed description of what could improve (qualitative, no scores)'),
  recommendation: z.string().max(400).describe('Detailed, specific action to take with examples'),
});

/**
 * Per-dimension insight for LLM response - FLATTENED to reduce nesting
 *
 * Uses semicolon-separated strings instead of nested arrays to stay within
 * Gemini API's max nesting depth limit (~4 levels).
 *
 * Format:
 * - strengthsData: "title1|description1;title2|description2;..."
 * - growthAreasData: "title1|description1|recommendation1;title2|..."
 */
export const LLMPerDimensionInsightSchema = z.object({
  dimension: DimensionNameEnumSchema,
  dimensionDisplayName: z.string().max(60).describe('Human-readable dimension name'),

  /** Strengths with clusterId: "clusterId|title|description;..." (clusterId for evidence matching) */
  strengthsData: z.string().max(5000).optional()
    .describe('0-8 strengths as "clusterId|title|description;..." format - clusterId MUST match Stage 1 cluster'),

  /** Growth areas with clusterId: "clusterId|title|description|recommendation;..." */
  growthAreasData: z.string().max(5000).optional()
    .describe('0-5 growth areas as "clusterId|title|description|recommendation;..." format - clusterId MUST match Stage 1 cluster'),
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
 * Helper to parse growthAreasData string into array of {clusterId?, title, description, recommendation}
 * Supports both new format (clusterId|title|description|recommendation) and legacy format (title|description|recommendation)
 */
export function parseGrowthAreasData(data: string | undefined): Array<{ clusterId?: string; title: string; description: string; recommendation: string }> {
  if (!data) return [];
  return data.split(';').filter(Boolean).map((s) => {
    const parts = s.split('|');
    if (parts.length >= 4) {
      // New format: clusterId|title|description|recommendation
      return { clusterId: parts[0], title: parts[1], description: parts[2], recommendation: parts.slice(3).join('|') };
    } else if (parts.length === 3) {
      // Legacy format: title|description|recommendation
      return { title: parts[0], description: parts[1], recommendation: parts[2] };
    } else if (parts.length === 2) {
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
  dimensionDisplayName: z.string().max(60).describe('Human-readable dimension name'),
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
  advice: z.string().max(200).describe('The actionable advice that was practiced'),
  source: z.string().describe('Source of this advice (e.g., "Anthropic", "Karpathy")'),
  feedback: z.string().max(500).describe('Personalized feedback about this practice'),
  evidence: z.array(z.string().max(300)).describe('Quotes showing this practice'),
  dimension: z.string().describe('Related dimension'),
});
export type PracticedAdvice = z.infer<typeof PracticedAdviceSchema>;

/**
 * An opportunity to practice expert advice
 * Shows what recommendations could be adopted
 */
export const OpportunityAdviceSchema = z.object({
  patternId: z.string().describe('Pattern identifier from KNOWLEDGE_DRIVEN_PATTERNS'),
  advice: z.string().max(200).describe('The actionable advice to try'),
  source: z.string().describe('Source of this advice (e.g., "Anthropic", "Karpathy")'),
  tip: z.string().max(500).describe('Why and how to adopt this practice'),
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
  summary: z.string().max(300).describe('Overall assessment of actionable practices'),
});
export type ActionablePractices = z.infer<typeof ActionablePracticesSchema>;

/**
 * LLM version of Practiced Advice (simplified for Gemini API)
 */
export const LLMPracticedAdviceSchema = z.object({
  patternId: z.string(),
  advice: z.string().max(200),
  source: z.string(),
  feedback: z.string().max(500),
  dimension: z.string(),
});

/**
 * LLM version of Opportunity Advice (simplified for Gemini API)
 */
export const LLMOpportunityAdviceSchema = z.object({
  patternId: z.string(),
  advice: z.string().max(200),
  source: z.string(),
  tip: z.string().max(500),
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
  summary: z.string().max(300).describe('Overall assessment'),
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
  antiPatternType: z.string().max(50),

  /** Human-readable display name (e.g., "The Retry Loop") */
  displayName: z.string().max(50),

  /** Personalized description of what was observed */
  description: z.string().max(300),

  /** How many times this pattern was observed */
  occurrences: z.number(),

  /** Severity assessment */
  severity: z.enum(['mild', 'moderate', 'significant']),

  /** Evidence quotes showing this pattern */
  evidence: z.array(z.string().max(300)).optional(),

  /** Supportive growth opportunity message */
  growthOpportunity: z.string().max(400),

  /** Specific actionable tip */
  actionableTip: z.string().max(200),
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
  summary: z.string().max(400),

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
  indicatorType: z.string().max(50),

  /** Human-readable title (e.g., "The Guardrail") */
  displayName: z.string().max(50),

  /** Personalized description of the behavior */
  description: z.string().max(300),

  /** How frequently observed */
  frequency: z.number(),

  /** Quality assessment */
  quality: z.enum(['basic', 'intermediate', 'advanced']),

  /** Evidence quotes showing this behavior */
  evidence: z.array(z.string().max(300)).optional(),

  /** Tip for further development */
  tip: z.string().max(200).optional(),
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
  summary: z.string().max(400),

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
  behaviorType: z.string().max(50),

  /** Human-readable title (e.g., "The Master Planner") */
  displayName: z.string().max(50),

  /** Personalized description */
  description: z.string().max(300),

  /** Frequency of this behavior */
  frequency: z.number(),

  /** Sophistication level */
  sophistication: z.enum(['basic', 'intermediate', 'advanced']),

  /** Evidence quotes */
  evidence: z.array(z.string().max(300)).optional(),

  /** Tip for improvement */
  tip: z.string().max(200).optional(),
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
  summary: z.string().max(400),

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
  antiPatternType: z.string().max(50),
  displayName: z.string().max(50),
  description: z.string().max(300),
  occurrences: z.number(),
  severity: z.enum(['mild', 'moderate', 'significant']),
  growthOpportunity: z.string().max(400),
  actionableTip: z.string().max(200),
});

/**
 * LLM Anti-Patterns Analysis - Uses schema without evidence
 */
export const LLMAntiPatternsAnalysisSchema = z.object({
  detected: z.array(LLMAntiPatternInsightSchema),
  summary: z.string().max(400),
  overallHealthScore: z.number().min(0).max(100),
});

/**
 * LLM Critical Thinking Highlight - NO evidence field
 */
export const LLMCriticalThinkingHighlightSchema = z.object({
  indicatorType: z.string().max(50),
  displayName: z.string().max(50),
  description: z.string().max(300),
  frequency: z.number(),
  quality: z.enum(['basic', 'intermediate', 'advanced']),
  tip: z.string().max(200).optional(),
});

/**
 * LLM Critical Thinking Analysis - Uses schema without evidence
 */
export const LLMCriticalThinkingAnalysisSchema = z.object({
  strengths: z.array(LLMCriticalThinkingHighlightSchema),
  opportunities: z.array(LLMCriticalThinkingHighlightSchema),
  summary: z.string().max(400),
  overallScore: z.number().min(0).max(100),
});

/**
 * LLM Planning Insight - NO evidence field
 */
export const LLMPlanningInsightSchema = z.object({
  behaviorType: z.string().max(50),
  displayName: z.string().max(50),
  description: z.string().max(300),
  frequency: z.number(),
  sophistication: z.enum(['basic', 'intermediate', 'advanced']),
  tip: z.string().max(200).optional(),
});

/**
 * LLM Planning Analysis - Uses schema without evidence
 */
export const LLMPlanningAnalysisSchema = z.object({
  strengths: z.array(LLMPlanningInsightSchema),
  opportunities: z.array(LLMPlanningInsightSchema),
  summary: z.string().max(400),
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
  title: z.string().max(100),
  narrative: z.string().max(500),
  expectedImpact: z.string().max(200),
  priorityScore: z.number().min(0).max(100),
  /** Flattened actions: "start|stop|continue" format */
  actionsData: z.string().max(700).optional()
    .describe('Actions as "start|stop|continue" format'),
});

/**
 * LLM Top Focus Areas - Uses flattened schema
 */
export const LLMTopFocusAreasSchema = z.object({
  areas: z.array(LLMTopFocusAreaSchema).max(3),
  summary: z.string().max(500),
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
  start: z.string().max(200),
  /** What to STOP doing */
  stop: z.string().max(200),
  /** What to CONTINUE doing */
  continue: z.string().max(200),
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
  title: z.string().max(100),

  /** WHY this matters for this developer (narrative) */
  narrative: z.string().max(500),

  /** Expected impact if they focus on this */
  expectedImpact: z.string().max(200),

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
  summary: z.string().max(500),
});
export type TopFocusAreas = z.infer<typeof TopFocusAreasSchema>;

// ============================================================================
// PERSONALITY INSIGHTS SCHEMA (User-Facing - No Labels/Scores)
// ============================================================================

/**
 * Personality insights for the user
 * Uses 4 storytelling techniques to create "Oh wow, they really know me!" feeling
 *
 * IMPORTANT: NO MBTI codes, NO psychological terms, NO scores
 * Only natural, conversational observations
 *
 * 4 Techniques:
 * 1. Specific Evidence - "You said '/plan' 8 times..."
 * 2. Confirmation Pattern - "You like to see the whole picture, don't you?"
 * 3. Strength-Shadow Connection - "That speed is great, but sometimes..."
 * 4. Daily Life Bridge - "Probably your motto outside coding too, right?"
 */
export const PersonalityInsightsSchema = z.object({
  /** Core observation with evidence and "~시죠?/don't you?" pattern */
  coreObservation: z.string().min(100).max(300)
    .describe('Lead with specific evidence + confirmation question'),

  /** How their personality connects to their coding strengths */
  strengthConnection: z.string().max(300)
    .describe('Connect personality trait to coding strength'),

  /** Growth opportunity framed through strength-shadow connection */
  growthOpportunity: z.string().max(300)
    .describe('Frame growth as flip side of strength'),

  /** Daily life connection for deeper rapport (optional) */
  dailyLifeConnection: z.string().max(150).optional()
    .describe('Connect coding style to real life for "wow" moment'),
});
export type PersonalityInsights = z.infer<typeof PersonalityInsightsSchema>;

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
  insightTitle: z.string().max(50),
  insight: z.string().max(300),
  comparison: z.string().max(200).describe('How this compares to typical usage'),
  recommendation: z.string().max(200).optional(),
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
        title: z.string().max(50),
        description: z.string().max(300),
        impact: z.enum(['high', 'medium', 'low']),
      })
    ),
  savingsEstimate: z.string().max(200).describe('Estimated monthly savings if optimized'),
});
export type TokenEfficiency = z.infer<typeof TokenEfficiencySchema>;

/**
 * Personalized growth roadmap (PREMIUM)
 */
export const GrowthRoadmapSchema = z.object({
  currentLevel: z.enum(['beginner', 'developing', 'proficient', 'expert']),
  nextMilestone: z.string().max(200),
  steps: z
    .array(
      z.object({
        order: z.number(),
        title: z.string().max(100),
        description: z.string().max(400),
        timeEstimate: z.string().max(100),
        metrics: z.string().max(150).describe('How to measure progress'),
      })
    ),
  estimatedTimeToNextLevel: z.string().max(100),
});
export type GrowthRoadmap = z.infer<typeof GrowthRoadmapSchema>;

/**
 * Comparative insights (PREMIUM)
 */
export const ComparativeInsightSchema = z.object({
  metric: z.string().max(50),
  yourValue: z.number(),
  averageValue: z.number(),
  percentile: z.number().min(0).max(100),
  interpretation: z.string().max(200),
});
export type ComparativeInsight = z.infer<typeof ComparativeInsightSchema>;

/**
 * Session trend (PREMIUM)
 */
export const SessionTrendSchema = z.object({
  metricName: z.string().max(50),
  direction: z.enum(['improving', 'stable', 'declining']),
  description: z.string().max(200),
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
  distribution: z.object({
    architect: z.number().min(0).max(100),
    scientist: z.number().min(0).max(100),
    collaborator: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    craftsman: z.number().min(0).max(100),
  }),

  // FREE TIER - Verbose content
  personalitySummary: z
    .string()
    .min(300)
    .max(1500)
    .describe('Hyper-personalized summary of their AI coding personality (expanded for premium value)'),

  // NEW: Per-dimension insights (replaces global strengths/growthAreas)
  dimensionInsights: z
    .array(PerDimensionInsightSchema)
    .length(6)
    .describe('Insights for each of the 6 analysis dimensions'),

  // DEPRECATED: Keep for backward compatibility, but prefer dimensionInsights
  strengths: z.array(PersonalizedStrengthSchema).optional(),
  growthAreas: z.array(GrowthAreaSchema).optional(),

  promptPatterns: z.array(PromptPatternSchema),

  // NEW: Actionable Practices - Knowledge-driven feedback
  // Uses LLM schema (no evidence field) - evidence is in Stage 1's actionablePatternMatches
  actionablePractices: LLMActionablePracticesSchema.optional()
    .describe('Expert recommendations practiced/missed by the developer'),

  // NEW: Anti-Patterns Analysis (Premium/Enterprise)
  antiPatternsAnalysis: AntiPatternsAnalysisSchema.optional()
    .describe('Anti-patterns detected with growth opportunities'),

  // NEW: Critical Thinking Analysis (Premium/Enterprise)
  criticalThinkingAnalysis: CriticalThinkingAnalysisSchema.optional()
    .describe('Critical thinking behaviors analysis'),

  // NEW: Planning Analysis (Premium/Enterprise)
  planningAnalysis: PlanningAnalysisSchema.optional()
    .describe('Planning behaviors analysis'),

  // NEW: Top 3 Focus Areas (from Stage 1 personalizedPriorities)
  topFocusAreas: TopFocusAreasSchema.optional()
    .describe('Top 3 personalized priorities - the MOST ACTIONABLE part'),

  // NEW: Personality Insights (from Module B personalityProfile)
  personalityInsights: PersonalityInsightsSchema.optional()
    .describe('Personality-driven insights using 4 storytelling techniques'),

  // PREMIUM TIER - Locked content
  toolUsageDeepDive: z.array(ToolUsageInsightSchema).optional(),
  tokenEfficiency: TokenEfficiencySchema.optional(),
  growthRoadmap: GrowthRoadmapSchema.optional(),
  comparativeInsights: z.array(ComparativeInsightSchema).optional(),
  sessionTrends: z.array(SessionTrendSchema).optional(),
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
  distribution: z.object({
    architect: z.number().min(0).max(100),
    scientist: z.number().min(0).max(100),
    collaborator: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    craftsman: z.number().min(0).max(100),
  }),

  // Content
  personalitySummary: z
    .string()
    .min(300)
    .max(1500)
    .describe('Hyper-personalized summary of their AI coding personality (expanded for premium value)'),

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

  // Personality Insights (from Module B personalityProfile)
  personalityInsights: PersonalityInsightsSchema.optional()
    .describe('Personality-driven insights using 4 storytelling techniques'),
});
export type VerboseLLMResponse = z.infer<typeof VerboseLLMResponseSchema>;
