/**
 * Workflow Habit Data Schema - Phase 2 Worker Output
 *
 * WorkflowHabitWorker detects:
 * - Planning habits (/plan usage, task decomposition, structure-first)
 * - Critical thinking moments (verification, questioning, validation)
 * - Multitasking patterns (context pollution)
 *
 * This worker answers: "How intentionally does this developer structure their work?"
 *
 * @module models/workflow-habit-data
 */

import { z } from 'zod';
import {
  PlanningHabitSchema,
  type PlanningHabit,
  CriticalThinkingMomentSchema,
  type CriticalThinkingMoment,
  MultitaskingPatternSchema,
  type MultitaskingPattern,
  parsePlanningHabitsData,
  parseCriticalThinkingData,
  parseMultitaskingData,
} from './behavior-pattern-data';
import {
  WorkerStrengthSchema,
  type WorkerStrength,
  WorkerGrowthSchema,
  type WorkerGrowth,
  parseWorkerStrengthsData,
  parseWorkerGrowthAreasData,
} from './worker-insights';

// ============================================================================
// Workflow Habit Output Schema
// ============================================================================

export const WorkflowHabitOutputSchema = z.object({
  /** Planning habits observed */
  planningHabits: z.array(PlanningHabitSchema),

  /** Critical thinking moments */
  criticalThinkingMoments: z.array(CriticalThinkingMomentSchema),

  /** Multitasking patterns */
  multitaskingPattern: MultitaskingPatternSchema.optional(),

  /** Overall workflow score (0-100, higher = more structured workflow) */
  overallWorkflowScore: z.number().min(0).max(100),

  /** Confidence in this analysis (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Brief summary */
  summary: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas (NEW - replaces StrengthGrowthSynthesizer)
  // ─────────────────────────────────────────────────────────────────────────

  /** Strengths identified in workflow & planning domain (1-4 items) */
  strengths: z.array(WorkerStrengthSchema).optional(),

  /** Growth areas identified in workflow & planning domain (1-4 items) */
  growthAreas: z.array(WorkerGrowthSchema).optional(),
});
export type WorkflowHabitOutput = z.infer<typeof WorkflowHabitOutputSchema>;

// ============================================================================
// Flattened Schema for Gemini API (Max Nesting Depth ~4)
// ============================================================================

export const WorkflowHabitLLMOutputSchema = z.object({
  /** Planning habits: "type|frequency|effectiveness|example1,example2;..." */
  planningHabitsData: z.string()
    .describe('Planning habits: "type|frequency|effectiveness|example1,example2;..."'),

  /** Critical thinking: "type|quote|result|utteranceId;..." */
  criticalThinkingData: z.string()
    .describe('Critical thinking moments: "type|quote|result|utteranceId;..."'),

  /** Multitasking: "mixesTopics|focusScore|recommendation|desc:impact,desc:impact" */
  multitaskingData: z.string().optional()
    .describe('Multitasking: "mixesTopics|focusScore|recommendation|desc:impact,desc:impact"'),

  /** Overall workflow score (0-100) */
  overallWorkflowScore: z.number().min(0).max(100),

  /** Confidence score (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Summary */
  summary: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas (NEW)
  // ─────────────────────────────────────────────────────────────────────────

  /** Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-6 items) */
  strengthsData: z.string().optional()
    .describe('Strengths in workflow domain: "title|description|quote1,quote2,quote3|frequency;..." (1-6 items)'),

  /** Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-6 items) */
  growthAreasData: z.string().optional()
    .describe('Growth areas in workflow domain: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-6 items)'),
});
export type WorkflowHabitLLMOutput = z.infer<typeof WorkflowHabitLLMOutputSchema>;

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Convert LLM output to structured WorkflowHabitOutput
 */
export function parseWorkflowHabitLLMOutput(llmOutput: WorkflowHabitLLMOutput): WorkflowHabitOutput {
  return {
    planningHabits: parsePlanningHabitsData(llmOutput.planningHabitsData),
    criticalThinkingMoments: parseCriticalThinkingData(llmOutput.criticalThinkingData),
    multitaskingPattern: parseMultitaskingData(llmOutput.multitaskingData),
    overallWorkflowScore: llmOutput.overallWorkflowScore,
    confidenceScore: llmOutput.confidenceScore,
    summary: llmOutput.summary,
    strengths: parseWorkerStrengthsData(llmOutput.strengthsData),
    growthAreas: parseWorkerGrowthAreasData(llmOutput.growthAreasData),
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create empty WorkflowHabit output
 */
export function createEmptyWorkflowHabitOutput(): WorkflowHabitOutput {
  return {
    planningHabits: [],
    criticalThinkingMoments: [],
    overallWorkflowScore: 50,
    confidenceScore: 0,
    summary: 'Insufficient data for workflow habit analysis.',
  };
}
