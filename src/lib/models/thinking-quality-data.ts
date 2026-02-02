/**
 * Thinking Quality Data Schema - Phase 2 Unified Worker Output
 *
 * ThinkingQualityAnalyzer combines:
 * - WorkflowHabit: Planning habits, critical thinking moments, multitasking patterns
 * - TrustVerification (verification-related): Verification behavior, verification anti-patterns
 * - CommunicationPatterns: Communication patterns, signature quotes
 *
 * This worker answers: "How intentionally, critically, and clearly does this developer work?"
 *
 * Capability-centric approach:
 * - Planning: How concrete and structured are their plans?
 * - Critical Thinking: Do they verify AI outputs and ask questions?
 * - Communication: How clearly do they express their needs?
 *
 * @module models/thinking-quality-data
 */

import { z } from 'zod';
import {
  WorkerStrengthSchema,
  type WorkerStrength,
  WorkerGrowthSchema,
  type WorkerGrowth,
  StructuredStrengthLLMSchema,
  StructuredGrowthLLMSchema,
  parseStructuredStrengths,
  parseStructuredGrowthAreas,
} from './worker-insights';

// ============================================================================
// Planning Habit Types (defined directly for v3 independence)
// ============================================================================

/**
 * Planning behavior types.
 */
export const PlanningHabitTypeSchema = z.enum([
  'uses_plan_command',    // Uses /plan slash command
  'task_decomposition',   // Breaks down complex tasks
  'structure_first',      // Plans before coding
  'todowrite_usage',      // Uses TodoWrite tool
  'no_planning',          // Dives in without planning
]);
export type PlanningHabitType = z.infer<typeof PlanningHabitTypeSchema>;

/**
 * Frequency classification for habits.
 */
export const HabitFrequencySchema = z.enum(['always', 'often', 'sometimes', 'rarely', 'never']);
export type HabitFrequency = z.infer<typeof HabitFrequencySchema>;

/**
 * A detected planning habit.
 */
export const PlanningHabitSchema = z.object({
  /** Type of planning behavior */
  type: PlanningHabitTypeSchema,
  /** How consistently this behavior was observed */
  frequency: HabitFrequencySchema,
  /** Example quotes demonstrating this habit */
  examples: z.array(z.string()),
  /** Effectiveness assessment */
  effectiveness: z.enum(['high', 'medium', 'low']).optional(),
});
export type PlanningHabit = z.infer<typeof PlanningHabitSchema>;

// ============================================================================
// Critical Thinking Types (defined directly for v3 independence)
// ============================================================================

/**
 * Critical thinking behavior types.
 */
export const CriticalThinkingTypeSchema = z.enum([
  'verification_request',     // "Are you sure?", "Is that correct?"
  'output_validation',        // Running tests, checking results
  'assumption_questioning',   // Challenging AI assumptions
  'alternative_exploration',  // Asking for different approaches
  'edge_case_consideration',  // Considering edge cases
  'security_check',           // Checking for security issues
]);
export type CriticalThinkingType = z.infer<typeof CriticalThinkingTypeSchema>;

/**
 * A critical thinking moment observed in sessions.
 */
export const CriticalThinkingMomentSchema = z.object({
  /** Type of critical thinking */
  type: CriticalThinkingTypeSchema,
  /** The quote showing critical thinking */
  quote: z.string(),
  /** What result this critical thinking led to */
  result: z.string(),
  /** Utterance ID for reference */
  utteranceId: z.string().optional(),
});
export type CriticalThinkingMoment = z.infer<typeof CriticalThinkingMomentSchema>;

// ============================================================================
// Verification Behavior (Vibe Coder Spectrum)
// ============================================================================

/**
 * Verification behavior levels - where on the Vibe Coder spectrum.
 */
export const VerificationLevelSchema = z.enum([
  'blind_trust',              // Vibe Coder
  'occasional_review',        // Supervised Coder
  'systematic_verification',  // AI-Assisted Engineer
  'skeptical',                // Reluctant User
]);
export type VerificationLevel = z.infer<typeof VerificationLevelSchema>;

/**
 * Verification behavior assessment.
 */
export const VerificationBehaviorSchema = z.object({
  /** Where on the Vibe Coder spectrum */
  level: VerificationLevelSchema,
  /** Examples supporting this assessment */
  examples: z.array(z.string()),
  /** Recommendation for improvement */
  recommendation: z.string(),
  /** Confidence in this assessment (0-1) */
  confidence: z.number().min(0).max(1).optional(),
});
export type VerificationBehavior = z.infer<typeof VerificationBehaviorSchema>;

// ============================================================================
// Anti-Pattern Types (for verification anti-patterns)
// ============================================================================

/**
 * Severity levels for anti-patterns.
 */
export const PatternSeveritySchema = z.enum(['critical', 'significant', 'moderate', 'mild']);
export type PatternSeverity = z.infer<typeof PatternSeveritySchema>;

/**
 * A detected anti-pattern instance.
 */
export const DetectedAntiPatternSchema = z.object({
  /** Type of anti-pattern */
  type: z.string(),
  /** How many times this pattern was observed */
  frequency: z.number().int().min(1),
  /** Examples showing this pattern */
  examples: z.array(z.object({
    utteranceId: z.string(),
    quote: z.string(),
    context: z.string().optional(),
  })),
  /** Severity assessment */
  severity: PatternSeveritySchema,
  /** Specific improvement suggestion */
  improvement: z.string().optional(),
  /** Percentage of sessions where this occurred (0-100) */
  sessionPercentage: z.number().min(0).max(100).optional(),
});
export type DetectedAntiPattern = z.infer<typeof DetectedAntiPatternSchema>;

// ============================================================================
// Multitasking Pattern
// ============================================================================

/**
 * Context pollution instance - when unrelated topics mix.
 */
export const ContextPollutionSchema = z.object({
  /** Description of the pollution */
  description: z.string(),
  /** Impact assessment */
  impact: z.enum(['high', 'medium', 'low']),
});
export type ContextPollution = z.infer<typeof ContextPollutionSchema>;

/**
 * Multitasking patterns detected in sessions.
 */
export const MultitaskingPatternSchema = z.object({
  /** Whether the developer tends to mix topics in sessions */
  mixesTopicsInSessions: z.boolean(),
  /** Context pollution instances detected */
  contextPollutionInstances: z.array(ContextPollutionSchema),
  /** Overall session focus score (0-100, higher = more focused) */
  focusScore: z.number().min(0).max(100).optional(),
  /** Recommendation for better context management */
  recommendation: z.string().optional(),
});
export type MultitaskingPattern = z.infer<typeof MultitaskingPatternSchema>;

// ============================================================================
// Communication Pattern Types (defined directly for v3 independence)
// ============================================================================

/**
 * Pattern frequency classification.
 */
export const PatternFrequencySchema = z.enum(['frequent', 'occasional', 'rare']);
export type PatternFrequency = z.infer<typeof PatternFrequencySchema>;

/**
 * Pattern effectiveness assessment.
 */
export const PatternEffectivenessSchema = z.enum(['highly_effective', 'effective', 'could_improve']);
export type PatternEffectiveness = z.infer<typeof PatternEffectivenessSchema>;

/**
 * A single example of a communication pattern with utterance linking.
 */
export const PatternExampleSchema = z.object({
  /** Utterance ID from Phase 1 (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),
  /** Analysis of what this utterance demonstrates about the pattern */
  analysis: z.string(),
});
export type PatternExample = z.infer<typeof PatternExampleSchema>;

/**
 * A detected communication pattern with WHAT-WHY-HOW analysis.
 */
export const CommunicationPatternSchema = z.object({
  /** Distinctive name for this pattern (e.g., "The Blueprint Architect") */
  patternName: z.string(),
  /** WHAT-WHY-HOW analysis */
  description: z.string(),
  /** How frequently this pattern appears */
  frequency: PatternFrequencySchema,
  /** Examples referencing actual utterances by ID with analysis */
  examples: z.array(PatternExampleSchema).min(1).max(5),
  /** How effective this pattern is for AI collaboration */
  effectiveness: PatternEffectivenessSchema,
  /** Educational tip with expert insights */
  tip: z.string().optional(),
});
export type CommunicationPattern = z.infer<typeof CommunicationPatternSchema>;

/**
 * A signature quote representing the developer's most impressive moments.
 */
export const SignatureQuoteSchema = z.object({
  /** Utterance ID from Phase 1 (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),
  /** What makes this quote particularly impressive */
  significance: z.string(),
  /** The strength/skill this quote represents */
  representedStrength: z.string(),
});
export type SignatureQuote = z.infer<typeof SignatureQuoteSchema>;

// ============================================================================
// Referenced Insight Schema (for Knowledge Base references)
// ============================================================================

/**
 * Referenced insight from Knowledge Base.
 * Used to provide links to source materials for [pi-XXX] references.
 */
export const ReferencedInsightSchema = z.object({
  /** Insight ID (e.g., "pi-001") */
  id: z.string(),
  /** Human-readable title (e.g., "Skill Atrophy Self-Diagnosis") */
  title: z.string(),
  /** Source URL for the insight */
  url: z.string(),
});
export type ReferencedInsight = z.infer<typeof ReferencedInsightSchema>;

// ============================================================================
// Thinking Quality Output Schema
// ============================================================================

/**
 * Complete output from ThinkingQualityAnalyzer.
 *
 * Combines analysis from multiple dimensions:
 * 1. Planning Quality - How structured and intentional is their work?
 * 2. Critical Thinking - Do they verify AI outputs and ask probing questions?
 * 3. Communication Clarity - How effectively do they express their needs?
 */
export const ThinkingQualityOutputSchema = z.object({
  // ─────────────────────────────────────────────────────────────────────────
  // Planning Dimension (from WorkflowHabit)
  // ─────────────────────────────────────────────────────────────────────────

  /** Planning habits observed */
  planningHabits: z.array(PlanningHabitSchema),

  /** Plan quality score (0-100, higher = more structured planning) */
  planQualityScore: z.number().min(0).max(100),

  /** Multitasking patterns (context pollution) */
  multitaskingPattern: MultitaskingPatternSchema.optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Critical Thinking Dimension (from WorkflowHabit + TrustVerification)
  // ─────────────────────────────────────────────────────────────────────────

  /** Verification behavior assessment (Vibe Coder spectrum) */
  verificationBehavior: VerificationBehaviorSchema,

  /** Critical thinking moments observed */
  criticalThinkingMoments: z.array(CriticalThinkingMomentSchema),

  /** Verification-related anti-patterns (error_loop, blind_retry, etc.) */
  verificationAntiPatterns: z.array(DetectedAntiPatternSchema),

  // ─────────────────────────────────────────────────────────────────────────
  // Communication Dimension (from CommunicationPatterns)
  // ─────────────────────────────────────────────────────────────────────────

  /** Communication patterns detected (5-12 for comprehensive analysis) */
  communicationPatterns: z.array(CommunicationPatternSchema),

  /** Signature quotes - developer's most impressive moments */
  signatureQuotes: z.array(SignatureQuoteSchema).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Overall Scores
  // ─────────────────────────────────────────────────────────────────────────

  /** Overall thinking quality score (0-100) */
  overallThinkingQualityScore: z.number().min(0).max(100),

  /** Confidence in this analysis (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Brief summary of thinking quality */
  summary: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas
  // ─────────────────────────────────────────────────────────────────────────

  /** Strengths identified in thinking quality domain (1-6 items) */
  strengths: z.array(WorkerStrengthSchema).optional(),

  /** Growth areas identified in thinking quality domain (1-6 items) */
  growthAreas: z.array(WorkerGrowthSchema).optional(),

  /** Referenced insights from Knowledge Base (post-processed from [pi-XXX] references) */
  referencedInsights: z.array(ReferencedInsightSchema).optional(),
});
export type ThinkingQualityOutput = z.infer<typeof ThinkingQualityOutputSchema>;

// ============================================================================
// LLM Output Schemas (Structured Arrays - Gemini Nesting Safe)
// ============================================================================

/**
 * LLM output schema for planning habits (nesting depth: 2)
 * root{} → planningHabits[] → PlanningHabitLLM{}
 */
export const PlanningHabitLLMSchema = z.object({
  /** Type of planning behavior */
  type: PlanningHabitTypeSchema,
  /** Frequency: always | often | sometimes | rarely | never */
  frequency: HabitFrequencySchema,
  /** Effectiveness: high | medium | low */
  effectiveness: z.enum(['high', 'medium', 'low']).optional(),
  /** Example quotes demonstrating this habit */
  examples: z.array(z.string()),
});
export type PlanningHabitLLM = z.infer<typeof PlanningHabitLLMSchema>;

/**
 * LLM output schema for critical thinking moments (nesting depth: 2)
 * root{} → criticalThinkingMoments[] → CriticalThinkingLLM{}
 */
export const CriticalThinkingLLMSchema = z.object({
  /** Type of critical thinking */
  type: CriticalThinkingTypeSchema,
  /** The quote showing critical thinking */
  quote: z.string(),
  /** What result this critical thinking led to */
  result: z.string(),
  /** Utterance ID for reference */
  utteranceId: z.string().optional(),
});
export type CriticalThinkingLLM = z.infer<typeof CriticalThinkingLLMSchema>;

/**
 * LLM output schema for context pollution (nesting depth: 2)
 */
export const ContextPollutionLLMSchema = z.object({
  /** Description of the pollution */
  description: z.string(),
  /** Impact: high | medium | low */
  impact: z.enum(['high', 'medium', 'low']),
});
export type ContextPollutionLLM = z.infer<typeof ContextPollutionLLMSchema>;

/**
 * LLM output schema for multitasking pattern (nesting depth: 2)
 * root{} → multitaskingPattern{} → contextPollutionInstances[] → obj{}
 */
export const MultitaskingLLMSchema = z.object({
  /** Whether the developer tends to mix topics in sessions */
  mixesTopicsInSessions: z.boolean(),
  /** Overall session focus score (0-100, higher = more focused) */
  focusScore: z.number().min(0).max(100).optional(),
  /** Recommendation for better context management */
  recommendation: z.string().optional(),
  /** Context pollution instances detected */
  contextPollutionInstances: z.array(ContextPollutionLLMSchema).optional(),
});
export type MultitaskingLLM = z.infer<typeof MultitaskingLLMSchema>;

/**
 * LLM output schema for anti-pattern example (nesting depth: 4)
 */
export const AntiPatternExampleLLMSchema = z.object({
  /** Utterance ID from Phase 1 (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),
  /** Direct quote from developer message */
  quote: z.string(),
  /** Brief context description (optional) */
  context: z.string().optional(),
});
export type AntiPatternExampleLLM = z.infer<typeof AntiPatternExampleLLMSchema>;

/**
 * LLM output schema for verification anti-pattern (nesting depth: 3)
 */
export const VerificationAntiPatternLLMSchema = z.object({
  /** Type of anti-pattern detected */
  type: z.string(),
  /** How many times this pattern was observed */
  frequency: z.number().int().min(1),
  /** Severity assessment: critical | significant | moderate | mild */
  severity: z.string(),
  /** Percentage of sessions where this occurred (0-100) */
  sessionPercentage: z.number().min(0).max(100).optional(),
  /** Specific improvement suggestion */
  improvement: z.string().optional(),
  /** Examples showing this pattern (max 5) */
  examples: z.array(AntiPatternExampleLLMSchema).min(1).max(5),
});
export type VerificationAntiPatternLLM = z.infer<typeof VerificationAntiPatternLLMSchema>;

/**
 * LLM output schema for verification behavior (nesting depth: 2)
 */
export const VerificationBehaviorLLMSchema = z.object({
  /** Level on the Vibe Coder spectrum */
  level: z.enum(['blind_trust', 'occasional_review', 'systematic_verification', 'skeptical']),
  /** Example utteranceIds showing this behavior */
  exampleIds: z.array(z.string()).max(5).optional(),
  /** Recommendation for improvement */
  recommendation: z.string(),
});
export type VerificationBehaviorLLM = z.infer<typeof VerificationBehaviorLLMSchema>;

/**
 * LLM output schema for pattern example (nesting depth: 3)
 */
export const PatternExampleLLMSchema = z.object({
  /** Utterance ID from Phase 1 (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),
  /** Analysis of what this utterance demonstrates about the pattern */
  analysis: z.string(),
});
export type PatternExampleLLM = z.infer<typeof PatternExampleLLMSchema>;

/**
 * LLM output schema for communication pattern (nesting depth: 2-3)
 */
export const CommunicationPatternLLMSchema = z.object({
  /** Distinctive name for this pattern (e.g., "The Blueprint Architect") */
  patternName: z.string(),
  /** WHAT-WHY-HOW analysis (1500-2500 chars target) */
  description: z.string(),
  /** How frequently this pattern appears */
  frequency: PatternFrequencySchema,
  /** How effective this pattern is for AI collaboration */
  effectiveness: PatternEffectivenessSchema,
  /** Educational tip with expert insights (1000-1500 chars target) */
  tip: z.string().optional(),
  /** Examples referencing actual utterances by ID with analysis (1-5 items) */
  examples: z.array(PatternExampleLLMSchema).min(1).max(5),
});
export type CommunicationPatternLLM = z.infer<typeof CommunicationPatternLLMSchema>;

/**
 * LLM output schema for signature quote (nesting depth: 2)
 */
export const SignatureQuoteLLMSchema = z.object({
  /** Utterance ID from Phase 1 (format: {sessionId}_{turnIndex}) */
  utteranceId: z.string(),
  /** What makes this quote particularly impressive */
  significance: z.string(),
  /** The strength/skill this quote represents */
  representedStrength: z.string(),
});
export type SignatureQuoteLLM = z.infer<typeof SignatureQuoteLLMSchema>;

// ============================================================================
// Main LLM Output Schema (Structured Arrays)
// ============================================================================

/**
 * Structured schema for Gemini API.
 * Uses arrays instead of semicolon-separated strings.
 * Nesting depth analysis:
 * - planningHabits[]: root → array → object = 2 levels (safe)
 * - verificationAntiPatterns[].examples[]: root → array → object → array → object = 3 levels (safe, arrays don't count)
 * - communicationPatterns[].examples[]: root → array → object → array → object = 3 levels (safe)
 */
export const ThinkingQualityLLMOutputSchema = z.object({
  // ─────────────────────────────────────────────────────────────────────────
  // Planning Dimension
  // ─────────────────────────────────────────────────────────────────────────

  /** Planning habits detected (structured array, 0-10 items) */
  planningHabits: z.array(PlanningHabitLLMSchema),

  /** Plan quality score (0-100) */
  planQualityScore: z.number().min(0).max(100),

  /** Multitasking pattern (optional) */
  multitaskingPattern: MultitaskingLLMSchema.optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Critical Thinking Dimension
  // ─────────────────────────────────────────────────────────────────────────

  /** Verification behavior: level, recommendation, examples */
  verificationBehavior: VerificationBehaviorLLMSchema,

  /** Critical thinking moments (structured array) */
  criticalThinkingMoments: z.array(CriticalThinkingLLMSchema),

  /** Verification-related anti-patterns (structured array) */
  verificationAntiPatterns: z.array(VerificationAntiPatternLLMSchema).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Communication Dimension
  // ─────────────────────────────────────────────────────────────────────────

  /** Communication patterns detected (5-12 patterns) */
  communicationPatterns: z.array(CommunicationPatternLLMSchema).min(3).max(12),

  /** Signature quotes (2-3 Tier S) */
  signatureQuotes: z.array(SignatureQuoteLLMSchema).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Overall Scores
  // ─────────────────────────────────────────────────────────────────────────

  /** Overall thinking quality score (0-100) */
  overallThinkingQualityScore: z.number().min(0).max(100),

  /** Confidence score (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Summary */
  summary: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas (STRUCTURED OUTPUT)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Strengths identified in thinking quality domain (1-6 items).
   * Evidence format: structured JSON array
   */
  strengths: z.array(StructuredStrengthLLMSchema).min(1).max(6).optional(),

  /**
   * Growth areas identified in thinking quality domain (1-6 items).
   * Evidence format: structured JSON array
   */
  growthAreas: z.array(StructuredGrowthLLMSchema).min(1).max(6),
});
export type ThinkingQualityLLMOutput = z.infer<typeof ThinkingQualityLLMOutputSchema>;

// ============================================================================
// Parsing Functions
// ============================================================================

/** Validate utteranceId format: sessionId_turnIndex (e.g., "abc123_5") */
function isValidUtteranceId(id: string | undefined): boolean {
  return !!id && /_\d+$/.test(id);
}

function parsePlanningHabitsLLM(habits: PlanningHabitLLM[] | undefined): PlanningHabit[] {
  if (!habits?.length) return [];
  return habits.map((h) => ({
    type: h.type,
    frequency: h.frequency,
    examples: h.examples || [],
    effectiveness: h.effectiveness,
  }));
}

function parseCriticalThinkingLLM(moments: CriticalThinkingLLM[] | undefined): CriticalThinkingMoment[] {
  if (!moments?.length) return [];
  return moments
    .filter((m) => m.type && m.quote)
    .map((m) => ({
      type: m.type,
      quote: m.quote,
      result: m.result,
      utteranceId: m.utteranceId,
    }));
}

function parseMultitaskingLLM(pattern: MultitaskingLLM | undefined): MultitaskingPattern | undefined {
  if (!pattern) return undefined;
  return {
    mixesTopicsInSessions: pattern.mixesTopicsInSessions,
    focusScore: pattern.focusScore,
    recommendation: pattern.recommendation,
    contextPollutionInstances: (pattern.contextPollutionInstances || []).map((cp) => ({
      description: cp.description,
      impact: cp.impact,
    })),
  };
}

function parseVerificationBehaviorLLM(behavior: VerificationBehaviorLLM): VerificationBehavior {
  return {
    level: behavior.level,
    examples: behavior.exampleIds || [],
    recommendation: behavior.recommendation,
  };
}

function parseVerificationAntiPatternsLLM(antiPatterns: VerificationAntiPatternLLM[] | undefined): DetectedAntiPattern[] {
  if (!antiPatterns?.length) return [];
  return antiPatterns.map((ap) => ({
    type: ap.type as DetectedAntiPattern['type'],
    frequency: ap.frequency,
    severity: ap.severity as DetectedAntiPattern['severity'],
    sessionPercentage: ap.sessionPercentage,
    improvement: ap.improvement,
    examples: ap.examples.map((ex) => ({
      utteranceId: ex.utteranceId,
      quote: ex.quote,
      context: ex.context,
    })),
  }));
}

function parseCommunicationPatternsLLM(patterns: CommunicationPatternLLM[] | undefined): CommunicationPattern[] {
  if (!patterns?.length) return [];

  const result: CommunicationPattern[] = [];

  for (const p of patterns) {
    if (!p.patternName || !p.description) continue;

    const validExamples = (p.examples || [])
      .filter((ex) => {
        if (!isValidUtteranceId(ex.utteranceId)) {
          console.warn(`[parseCommunicationPatternsLLM] Invalid utteranceId: "${ex.utteranceId}"`);
          return false;
        }
        return ex.analysis?.length > 0;
      })
      .map((ex) => ({ utteranceId: ex.utteranceId, analysis: ex.analysis }));

    if (validExamples.length === 0) continue;

    const pattern: CommunicationPattern = {
      patternName: p.patternName,
      description: p.description,
      frequency: p.frequency,
      examples: validExamples,
      effectiveness: p.effectiveness,
    };
    if (p.tip) pattern.tip = p.tip;
    result.push(pattern);
  }

  return result;
}

function parseSignatureQuotesLLM(quotes: SignatureQuoteLLM[] | undefined): SignatureQuote[] {
  if (!quotes?.length) return [];

  return quotes
    .filter((sq) => {
      if (!isValidUtteranceId(sq.utteranceId)) {
        console.warn(`[parseSignatureQuotesLLM] Invalid utteranceId: "${sq.utteranceId}"`);
        return false;
      }
      return sq.significance?.length > 0;
    })
    .map((sq) => ({
      utteranceId: sq.utteranceId,
      significance: sq.significance,
      representedStrength: sq.representedStrength,
    }));
}

/**
 * Convert LLM output to structured ThinkingQualityOutput.
 */
export function parseThinkingQualityLLMOutput(
  llmOutput: ThinkingQualityLLMOutput
): ThinkingQualityOutput {
  return {
    // Planning Dimension
    planningHabits: parsePlanningHabitsLLM(llmOutput.planningHabits),
    planQualityScore: llmOutput.planQualityScore,
    multitaskingPattern: parseMultitaskingLLM(llmOutput.multitaskingPattern),

    // Critical Thinking Dimension
    verificationBehavior: parseVerificationBehaviorLLM(llmOutput.verificationBehavior),
    criticalThinkingMoments: parseCriticalThinkingLLM(llmOutput.criticalThinkingMoments),
    verificationAntiPatterns: parseVerificationAntiPatternsLLM(llmOutput.verificationAntiPatterns),

    // Communication Dimension
    communicationPatterns: parseCommunicationPatternsLLM(llmOutput.communicationPatterns),
    signatureQuotes: parseSignatureQuotesLLM(llmOutput.signatureQuotes),

    // Overall Scores
    overallThinkingQualityScore: llmOutput.overallThinkingQualityScore,
    confidenceScore: llmOutput.confidenceScore,
    summary: llmOutput.summary,

    // Strengths & Growth Areas
    strengths: parseStructuredStrengths(llmOutput.strengths),
    growthAreas: parseStructuredGrowthAreas(llmOutput.growthAreas),
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create empty ThinkingQuality output
 */
export function createEmptyThinkingQualityOutput(): ThinkingQualityOutput {
  return {
    planningHabits: [],
    planQualityScore: 50,
    verificationBehavior: {
      level: 'occasional_review',
      examples: [],
      recommendation: 'Insufficient data to assess verification behavior.',
    },
    criticalThinkingMoments: [],
    verificationAntiPatterns: [],
    communicationPatterns: [],
    overallThinkingQualityScore: 50,
    confidenceScore: 0,
    summary: 'Insufficient data for thinking quality analysis.',
  };
}
