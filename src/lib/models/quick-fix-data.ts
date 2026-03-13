/**
 * Quick Fix Data Models
 *
 * Schemas for the Quick Fix pipeline — a lightweight analysis path that
 * identifies top 3 time-wasting patterns and suggests better prompts.
 *
 * Pipeline: Phase 1 DataExtractor (0 LLM) → BottleneckDetector (1-2 LLM)
 * Target: ~30 second time-to-value
 *
 * Self-hosted OSS always returns full quick-fix results.
 *
 * Gemini Nesting Depth Analysis (4 levels max, arrays don't count):
 * root{} → bottlenecks[] → bottleneck{} → evidence[] → evidenceItem{}
 *   L1                        L2                           L3 (safe)
 *
 * @module models/quick-fix-data
 */

import { z } from 'zod';
import {
  StructuredEvidenceLLMSchema,
  type InsightEvidence,
  parseStructuredEvidence,
} from './worker-insights';

// ============================================================================
// Bottleneck Severity
// ============================================================================

/**
 * Severity of a detected bottleneck.
 *
 * - critical: Major time-waster (>30% of session time affected)
 * - high: Significant time-waster (15-30% of session time)
 * - medium: Moderate time-waster (5-15% of session time)
 */
export const BottleneckSeveritySchema = z.enum(['critical', 'high', 'medium']);
export type BottleneckSeverity = z.infer<typeof BottleneckSeveritySchema>;

// ============================================================================
// Bottleneck Category
// ============================================================================

/**
 * Category of bottleneck, mapping to the 5 insight worker domains.
 * Helps users understand which aspect of their workflow needs improvement.
 */
export const BottleneckCategorySchema = z.enum([
  'thinking',        // Planning/verification gaps (ThinkingQuality domain)
  'communication',   // Unclear prompts/instructions (CommunicationPatterns domain)
  'learning',        // Repeated mistakes, not learning from errors (LearningBehavior domain)
  'efficiency',      // Token waste, context mismanagement (ContextEfficiency domain)
  'outcome',         // Session goal failures, friction (SessionOutcome domain)
]);
export type BottleneckCategory = z.infer<typeof BottleneckCategorySchema>;

// ============================================================================
// Bottleneck (LLM Output Schema)
// ============================================================================

/**
 * A single bottleneck detected in the user's recent sessions.
 *
 * This is the LLM output format for Gemini structured output.
 *
 * Gemini Nesting Depth:
 * root{} → bottlenecks[] → bottleneck{} → evidence[] → evidenceItem{}
 *   L1                        L2                           L3 (safe)
 */
export const BottleneckLLMSchema = z.object({
  /** Short, specific title (e.g., "Blind Retry After Errors") */
  title: z.string().describe('Short title, max 60 chars'),

  /** Which domain this bottleneck falls under */
  category: BottleneckCategorySchema,

  /** How severe this bottleneck is */
  severity: BottleneckSeveritySchema,

  /**
   * 3-5 sentences explaining what the user is doing wrong and why it wastes time.
   */
  issue: z.string().min(150).describe('MINIMUM 150 characters. 3-5 sentences explaining the problem.'),

  /**
   * A concrete, copy-pasteable prompt that would have worked better.
   * Should be a real prompt the user can immediately use in their next session.
   */
  suggestedPrompt: z.string().min(100).describe(
    'MINIMUM 100 characters. A concrete, ready-to-use prompt that demonstrates the better approach.'
  ),

  /**
   * 2-3 sentences explaining WHY the suggested prompt is better.
   */
  explanation: z.string().min(80).describe(
    'MINIMUM 80 characters. 2-3 sentences explaining why this prompt is better.'
  ),

  /**
   * Evidence from the user's actual sessions showing this pattern.
   * Each item links to a Phase 1 utterance via utteranceId.
   */
  evidence: z.array(StructuredEvidenceLLMSchema).min(1).max(4),

  /**
   * Estimated time saved per session if this bottleneck is addressed.
   * Expressed as a rough percentage (e.g., "15-25%").
   */
  estimatedTimeSaved: z.string().describe('Rough percentage, e.g. "15-25%"'),
});
export type BottleneckLLM = z.infer<typeof BottleneckLLMSchema>;

// ============================================================================
// BottleneckDetector LLM Output Schema
// ============================================================================

/**
 * Full LLM output from the BottleneckDetector worker.
 *
 * Gemini Nesting Depth:
 * BottleneckDetectorLLMOutput{} → bottlenecks[] → Bottleneck{} → evidence[] → item{}
 *   L1                                               L2                          L3
 * Max depth = 3 (well within 4-level limit)
 */
export const BottleneckDetectorLLMOutputSchema = z.object({
  /** Top 3 bottlenecks, ordered by severity (most severe first) */
  bottlenecks: z.array(BottleneckLLMSchema).min(1).max(3),

  /** Overall session health score (0-100) */
  overallHealthScore: z.number().min(0).max(100),

  /** 1-2 sentence summary of the user's biggest opportunity for improvement */
  summary: z.string().min(50).describe('MINIMUM 50 characters. 1-2 sentence overall summary.'),
});
export type BottleneckDetectorLLMOutput = z.infer<typeof BottleneckDetectorLLMOutputSchema>;

// ============================================================================
// Parsed Bottleneck (post-processing)
// ============================================================================

/**
 * A parsed bottleneck with validated evidence.
 * This is the internal format after LLM output parsing and evidence validation.
 */
export interface Bottleneck {
  title: string;
  category: BottleneckCategory;
  severity: BottleneckSeverity;
  issue: string;
  suggestedPrompt: string;
  explanation: string;
  evidence: InsightEvidence[];
  estimatedTimeSaved: string;

}

// ============================================================================
// Quick Fix Result (final output)
// ============================================================================

/**
 * Complete Quick Fix analysis result.
 *
 * Contains the top bottlenecks and metadata about the analysis.
 */
export interface QuickFixResult {
  /** Unique result ID for caching and sharing */
  resultId: string;

  /** Project name that was analyzed */
  projectName: string;

  /** Project path (encoded) */
  projectPath: string;

  /** Number of sessions analyzed (typically 3-5 recent sessions) */
  sessionsAnalyzed: number;

  /** When this analysis was performed */
  analyzedAt: string;

  /** Overall session health score (0-100) */
  overallHealthScore: number;

  /** Summary of the biggest opportunity */
  summary: string;

  /** Top 3 bottlenecks, ordered by severity */
  bottlenecks: Bottleneck[];

}

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse LLM bottleneck output into internal Bottleneck format.
 * Validates evidence and filters out invalid items.
 *
 * @param llmOutput - Raw LLM output from BottleneckDetector
 * @returns Parsed bottlenecks with validated evidence
 */
export function parseBottleneckDetectorOutput(
  llmOutput: BottleneckDetectorLLMOutput
): { bottlenecks: Bottleneck[]; overallHealthScore: number; summary: string } {
  const bottlenecks: Bottleneck[] = llmOutput.bottlenecks
    .map((b) => ({
      title: b.title,
      category: b.category,
      severity: b.severity,
      issue: b.issue,
      suggestedPrompt: b.suggestedPrompt,
      explanation: b.explanation,
      evidence: parseStructuredEvidence(b.evidence),
      estimatedTimeSaved: b.estimatedTimeSaved,
    }))
    .filter((b) => b.evidence.length > 0);

  return {
    bottlenecks,
    overallHealthScore: llmOutput.overallHealthScore,
    summary: llmOutput.summary,
  };
}
