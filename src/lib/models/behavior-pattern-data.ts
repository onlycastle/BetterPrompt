/**
 * Behavior Pattern Data Schema - Phase 2 Worker Output
 *
 * BehaviorPatternWorker is responsible for detecting:
 * - Anti-patterns (error loops, blind retry, passive acceptance, etc.)
 * - Planning habits (uses /plan, task decomposition, structure-first)
 * - Critical thinking moments (verification, output validation, questioning)
 * - Vibe Coder patterns (blind trust, trust debt, fragile debugging)
 * - Multitasking patterns (context pollution from previous workers)
 *
 * This worker answers: "What behavioral patterns does this developer exhibit?"
 *
 * Based on research from:
 * - Addy Osmani: Vibe Coding vs AI-Assisted Engineering
 * - Final Round AI CTO Survey: Vibe Coding Failures
 *
 * @module models/behavior-pattern-data
 */

import { z } from 'zod';

// ============================================================================
// Anti-Pattern Types (Including Vibe Coder Patterns)
// ============================================================================

/**
 * Anti-pattern types detected in developer behavior.
 *
 * Includes both classic anti-patterns and Vibe Coder patterns from research.
 */
export const AntiPatternTypeSchema = z.enum([
  // Classic Anti-Patterns
  'error_loop',           // Same error + same approach 3+ times
  'blind_retry',          // Retry without analysis
  'passive_acceptance',   // Accept AI output without verification
  'sunk_cost_loop',       // Continuing failed approach too long

  // Vibe Coder Patterns (from Addy Osmani research)
  'blind_acceptance',     // Accept AI output without any verification (NEW)
  'trust_debt',           // Ship code without understanding (NEW)
  'fragile_debugging',    // Can't debug when AI fails (NEW)

  // Scope & Context Patterns
  'scope_creep',          // Requirements keep expanding
  'context_bloat',        // Not managing context window

  // Other Patterns
  'over_delegation',      // Excessive delegation to AI
  'copy_paste_dependency', // Copying without understanding
]);
export type AntiPatternType = z.infer<typeof AntiPatternTypeSchema>;

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
  type: AntiPatternTypeSchema,

  /** How many times this pattern was observed */
  frequency: z.number().int().min(1),

  /** Examples showing this pattern */
  examples: z.array(z.object({
    utteranceId: z.string(),
    quote: z.string(),
    context: z.string().optional(),
    whatWentWrong: z.string().optional(),
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
// Planning Habit Types
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
// Critical Thinking Types
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
 *
 * From Addy Osmani's research:
 * - blind_trust: Accepts everything AI produces without review
 * - occasional_review: Sometimes reviews, often doesn't
 * - systematic_verification: Regularly verifies AI output
 * - skeptical: Questions and validates everything
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
// Multitasking Pattern (Integrated from MultitaskingAnalyzer)
// ============================================================================

/**
 * Context pollution instance - when unrelated topics mix.
 */
export const ContextPollutionSchema = z.object({
  /** Description of the pollution */
  description: z.string(),

  /** Session where it occurred */
  sessionId: z.string().optional(),

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
// Complete BehaviorPattern Output Schema
// ============================================================================

/**
 * Complete output from BehaviorPatternWorker.
 *
 * Combines:
 * - Anti-pattern detection
 * - Planning habit analysis
 * - Critical thinking moments
 * - Vibe Coder spectrum assessment
 * - Multitasking pattern analysis
 */
export const BehaviorPatternOutputSchema = z.object({
  /** Detected anti-patterns */
  antiPatterns: z.array(DetectedAntiPatternSchema),

  /** Planning habits observed */
  planningHabits: z.array(PlanningHabitSchema),

  /** Critical thinking moments */
  criticalThinkingMoments: z.array(CriticalThinkingMomentSchema),

  /** Verification behavior assessment (Vibe Coder spectrum) */
  verificationBehavior: VerificationBehaviorSchema,

  /** Multitasking patterns */
  multitaskingPattern: MultitaskingPatternSchema.optional(),

  /** Overall health score (0-100, higher = fewer anti-patterns) */
  overallHealthScore: z.number().min(0).max(100),

  /** Overall confidence in this analysis (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Summary of behavioral patterns */
  summary: z.string().optional(),
});
export type BehaviorPatternOutput = z.infer<typeof BehaviorPatternOutputSchema>;

// ============================================================================
// Flattened Schema for Gemini API (Max Nesting Depth ~4)
// ============================================================================

/**
 * Flattened BehaviorPattern output for Gemini API.
 */
export const BehaviorPatternLLMOutputSchema = z.object({
  /** Anti-patterns: "type|frequency|severity|sessionPct|improvement|utteranceId:quote:context:whatWentWrong,...;..." */
  antiPatternsData: z.string()
    .describe('Anti-patterns: "type|frequency|severity|sessionPct|improvement|examples;..." where examples = "id:quote:context:whatWentWrong,..."'),

  /** Planning habits: "type|frequency|effectiveness|example1,example2;..." */
  planningHabitsData: z.string()
    .describe('Planning habits: "type|frequency|effectiveness|example1,example2;..."'),

  /** Critical thinking: "type|quote|result|utteranceId;..." */
  criticalThinkingData: z.string()
    .describe('Critical thinking moments: "type|quote|result|utteranceId;..."'),

  /** Verification behavior: "level|recommendation|example1,example2" */
  verificationBehaviorData: z.string()
    .describe('Verification behavior: "level|recommendation|example1,example2"'),

  /** Multitasking: "mixesTopics|focusScore|recommendation|pollution1,pollution2" */
  multitaskingData: z.string().optional()
    .describe('Multitasking: "mixesTopics|focusScore|recommendation|desc:impact,desc:impact"'),

  /** Overall health score (0-100) */
  overallHealthScore: z.number().min(0).max(100),

  /** Confidence score (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Summary */
  summary: z.string().optional(),
});
export type BehaviorPatternLLMOutput = z.infer<typeof BehaviorPatternLLMOutputSchema>;

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse anti-patterns data string
 */
export function parseAntiPatternsData(data: string | undefined): DetectedAntiPattern[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      const type = parts[0]?.trim() as AntiPatternType;
      const frequency = parseInt(parts[1], 10) || 1;
      const severity = (parts[2]?.trim() || 'moderate') as PatternSeverity;
      const sessionPct = parts[3] ? parseFloat(parts[3]) : undefined;
      const improvement = parts[4]?.trim() || undefined;
      const examplesStr = parts[5]?.trim() || '';

      const examples = examplesStr
        .split(',')
        .filter(Boolean)
        .map((ex) => {
          const exParts = ex.split(':');
          return {
            utteranceId: exParts[0]?.trim() || '',
            quote: exParts[1]?.trim() || '',
            context: exParts[2]?.trim() || undefined,
            whatWentWrong: exParts[3]?.trim() || undefined,
          };
        })
        .filter((e) => e.utteranceId && e.quote);

      const result: DetectedAntiPattern = {
        type,
        frequency,
        severity,
        examples,
      };

      if (sessionPct !== undefined && !isNaN(sessionPct)) result.sessionPercentage = sessionPct;
      if (improvement) result.improvement = improvement;

      return result;
    })
    .filter((ap) => ap.type && ap.examples.length > 0);
}

/**
 * Parse planning habits data string
 */
export function parsePlanningHabitsData(data: string | undefined): PlanningHabit[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      const type = parts[0]?.trim() as PlanningHabitType;
      const frequency = (parts[1]?.trim() || 'sometimes') as HabitFrequency;
      const effectiveness = parts[2]?.trim() as 'high' | 'medium' | 'low' | undefined;
      const examples = (parts[3]?.trim() || '').split(',').map((e) => e.trim()).filter(Boolean);

      const result: PlanningHabit = {
        type,
        frequency,
        examples,
      };

      if (effectiveness && ['high', 'medium', 'low'].includes(effectiveness)) {
        result.effectiveness = effectiveness;
      }

      return result;
    })
    .filter((ph) => ph.type);
}

/**
 * Parse critical thinking data string
 */
export function parseCriticalThinkingData(data: string | undefined): CriticalThinkingMoment[] {
  if (!data || data.trim() === '') return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      return {
        type: parts[0]?.trim() as CriticalThinkingType,
        quote: parts[1]?.trim() || '',
        result: parts[2]?.trim() || '',
        utteranceId: parts[3]?.trim() || undefined,
      };
    })
    .filter((ct) => ct.type && ct.quote);
}

/**
 * Parse verification behavior data string
 */
export function parseVerificationBehaviorData(data: string | undefined): VerificationBehavior {
  if (!data || data.trim() === '') {
    return {
      level: 'occasional_review',
      examples: [],
      recommendation: 'Consider implementing more systematic verification of AI outputs.',
    };
  }

  const parts = data.split('|');
  const level = (parts[0]?.trim() || 'occasional_review') as VerificationLevel;
  const recommendation = parts[1]?.trim() || '';
  const examples = (parts[2]?.trim() || '').split(',').map((e) => e.trim()).filter(Boolean);

  return { level, recommendation, examples };
}

/**
 * Parse multitasking data string
 */
export function parseMultitaskingData(data: string | undefined): MultitaskingPattern | undefined {
  if (!data || data.trim() === '') return undefined;

  const parts = data.split('|');
  const mixesTopics = parts[0]?.trim().toLowerCase() === 'true';
  const focusScore = parts[1] ? parseFloat(parts[1]) : undefined;
  const recommendation = parts[2]?.trim() || undefined;
  const pollutionStr = parts[3]?.trim() || '';

  const contextPollutionInstances = pollutionStr
    .split(',')
    .filter(Boolean)
    .map((p) => {
      const pParts = p.split(':');
      return {
        description: pParts[0]?.trim() || '',
        impact: (pParts[1]?.trim() || 'medium') as 'high' | 'medium' | 'low',
      };
    })
    .filter((cp) => cp.description);

  return {
    mixesTopicsInSessions: mixesTopics,
    contextPollutionInstances,
    focusScore: focusScore !== undefined && !isNaN(focusScore) ? focusScore : undefined,
    recommendation,
  };
}

/**
 * Convert LLM output to structured BehaviorPatternOutput
 */
export function parseBehaviorPatternLLMOutput(llmOutput: BehaviorPatternLLMOutput): BehaviorPatternOutput {
  return {
    antiPatterns: parseAntiPatternsData(llmOutput.antiPatternsData),
    planningHabits: parsePlanningHabitsData(llmOutput.planningHabitsData),
    criticalThinkingMoments: parseCriticalThinkingData(llmOutput.criticalThinkingData),
    verificationBehavior: parseVerificationBehaviorData(llmOutput.verificationBehaviorData),
    multitaskingPattern: parseMultitaskingData(llmOutput.multitaskingData),
    overallHealthScore: llmOutput.overallHealthScore,
    confidenceScore: llmOutput.confidenceScore,
    summary: llmOutput.summary,
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create empty BehaviorPattern output for fallback cases
 */
export function createEmptyBehaviorPatternOutput(): BehaviorPatternOutput {
  return {
    antiPatterns: [],
    planningHabits: [],
    criticalThinkingMoments: [],
    verificationBehavior: {
      level: 'occasional_review',
      examples: [],
      recommendation: 'Insufficient data to assess verification behavior.',
    },
    overallHealthScore: 50,
    confidenceScore: 0,
    summary: 'Insufficient data for behavior pattern analysis.',
  };
}
