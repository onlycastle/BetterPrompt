/**
 * Communication Patterns Data Schema - Phase 2 Worker Output
 *
 * CommunicationPatternsWorker detects:
 * - Prompt communication patterns (questioning style, context provision, etc.)
 * - Pattern effectiveness assessment
 * - Utterance-level examples with analysis
 *
 * This worker answers: "How does this developer communicate with AI?"
 *
 * Moved from Phase 3 ContentWriter to Phase 2 for:
 * - Direct access to developerUtterances
 * - utteranceId-based evidence (not LLM-generated quotes)
 * - Separation of analysis (Phase 2) from narrative (Phase 3)
 *
 * @module models/communication-patterns-data
 */

import { z } from 'zod';
import {
  WorkerStrengthSchema,
  type WorkerStrength,
  WorkerGrowthSchema,
  type WorkerGrowth,
  parseWorkerStrengthsData,
  parseWorkerGrowthAreasData,
} from './worker-insights';

// ============================================================================
// Pattern Example Schema
// ============================================================================

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

// ============================================================================
// Communication Pattern Schema
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
 * A detected communication pattern with WHAT-WHY-HOW analysis.
 *
 * Each pattern includes:
 * - Description: WHAT this pattern is, WHY it matters, HOW it affects collaboration
 * - Examples: utteranceId references with per-example analysis
 * - Tip: actionable advice for improving or reinforcing the pattern
 */
export const CommunicationPatternSchema = z.object({
  /** Distinctive name for this pattern (e.g., "The Blueprint Architect") */
  patternName: z.string(),

  /**
   * WHAT-WHY-HOW analysis (1500-2500 chars target):
   * - WHAT: Observable behavior pattern with specific examples
   * - WHY: What this reveals about mindset, values, work philosophy
   * - HOW: Impact on AI collaboration and code quality
   */
  description: z.string(),

  /** How frequently this pattern appears */
  frequency: PatternFrequencySchema,

  /** Examples referencing actual utterances by ID with analysis */
  examples: z.array(PatternExampleSchema).min(1).max(5),

  /** How effective this pattern is for AI collaboration */
  effectiveness: PatternEffectivenessSchema,

  /** Educational tip with expert insights (1000-1500 chars target) */
  tip: z.string().optional(),
});
export type CommunicationPattern = z.infer<typeof CommunicationPatternSchema>;

// ============================================================================
// Communication Patterns Output Schema
// ============================================================================

/**
 * Complete output from CommunicationPatternsWorker.
 */
export const CommunicationPatternsOutputSchema = z.object({
  /** Detected communication patterns (5-12 for comprehensive analysis) */
  patterns: z.array(CommunicationPatternSchema).min(3).max(12),

  /** Overall communication effectiveness score (0-100) */
  overallEffectivenessScore: z.number().min(0).max(100),

  /** Confidence in this analysis (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Brief summary of communication style */
  summary: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas (shared pattern)
  // ─────────────────────────────────────────────────────────────────────────

  /** Strengths identified in communication domain (1-4 items) */
  strengths: z.array(WorkerStrengthSchema).optional(),

  /** Growth areas identified in communication domain (1-4 items) */
  growthAreas: z.array(WorkerGrowthSchema).optional(),
});
export type CommunicationPatternsOutput = z.infer<typeof CommunicationPatternsOutputSchema>;

// ============================================================================
// Flattened Schema for Gemini API (Max Nesting Depth ~4)
// ============================================================================

/**
 * LLM output schema using flattened strings to avoid Gemini nesting limits.
 *
 * patternsData format: Each pattern is separated by DOUBLE semicolon (;;)
 * "patternName|description|frequency|effectiveness|tip|ex1,ex2,ex3;;"
 *
 * Where each example (ex) uses format: "utteranceId:analysis"
 * Examples within a pattern are comma-separated.
 *
 * Example:
 * "Blueprint Architect|WHAT: Developer creates detailed plans...|frequent|highly_effective|Consider using...|abc123_5:Shows systematic planning,def456_8:Demonstrates structured approach;;"
 */
export const CommunicationPatternsLLMOutputSchema = z.object({
  /**
   * Patterns data (DOUBLE semicolon separated to avoid conflicts with example commas):
   * "patternName|description|frequency|effectiveness|tip|utteranceId1:analysis1,utteranceId2:analysis2;;"
   *
   * - patternName: Distinctive name
   * - description: WHAT-WHY-HOW analysis (1500-2500 chars)
   * - frequency: frequent | occasional | rare
   * - effectiveness: highly_effective | effective | could_improve
   * - tip: Educational advice (1000-1500 chars)
   * - examples: comma-separated "utteranceId:analysis" pairs
   */
  patternsData: z.string()
    .describe('Patterns: "name|description|frequency|effectiveness|tip|id1:analysis1,id2:analysis2;;" (DOUBLE semicolon separator)'),

  /** Overall communication effectiveness score (0-100) */
  overallEffectivenessScore: z.number().min(0).max(100),

  /** Confidence score (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Summary of communication style */
  summary: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas
  // ─────────────────────────────────────────────────────────────────────────

  /** Strengths: "title|description|quote1,quote2,quote3|frequency;..." (1-4 items) */
  strengthsData: z.string().optional()
    .describe('Strengths in communication domain: "title|description|quote1,quote2,quote3|frequency;..." (1-4 items)'),

  /** Growth areas: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-4 items) */
  growthAreasData: z.string().optional()
    .describe('Growth areas in communication domain: "title|description|quote1,quote2|recommendation|severity|frequency;..." (1-4 items)'),
});
export type CommunicationPatternsLLMOutput = z.infer<typeof CommunicationPatternsLLMOutputSchema>;

// ============================================================================
// Parsing Functions
// ============================================================================

/**
 * Parse patternsData string into structured array.
 *
 * Format: "patternName|description|frequency|effectiveness|tip|id1:analysis1,id2:analysis2;;"
 *
 * Uses DOUBLE semicolon (;;) as pattern separator to avoid conflicts with
 * commas in example lists or semicolons in analysis text.
 */
export function parsePatternsData(data: string | undefined): CommunicationPattern[] {
  if (!data || data.trim() === '') return [];

  // Split by double semicolon
  return data
    .split(';;')
    .filter(entry => entry.trim().length > 0)
    .map((entry) => {
      const parts = entry.split('|');
      const patternName = parts[0]?.trim() || '';
      const description = parts[1]?.trim() || '';
      const frequencyStr = parts[2]?.trim() || 'occasional';
      const effectivenessStr = parts[3]?.trim() || 'effective';
      const tip = parts[4]?.trim() || undefined;
      const examplesStr = parts[5]?.trim() || '';

      // Validate frequency
      const frequency: PatternFrequency =
        ['frequent', 'occasional', 'rare'].includes(frequencyStr)
          ? (frequencyStr as PatternFrequency)
          : 'occasional';

      // Validate effectiveness
      const effectiveness: PatternEffectiveness =
        ['highly_effective', 'effective', 'could_improve'].includes(effectivenessStr)
          ? (effectivenessStr as PatternEffectiveness)
          : 'effective';

      // Parse examples: "utteranceId:analysis,utteranceId:analysis,..."
      const examples: PatternExample[] = examplesStr
        .split(',')
        .filter(Boolean)
        .map((exStr) => {
          const colonIndex = exStr.indexOf(':');
          if (colonIndex <= 0) {
            // Invalid format - skip
            return null;
          }
          const utteranceId = exStr.slice(0, colonIndex).trim();
          const analysis = exStr.slice(colonIndex + 1).trim();

          // Validate utteranceId format: sessionId_turnIndex
          if (!/_\d+$/.test(utteranceId)) {
            console.warn(`[parsePatternsData] Invalid utteranceId: "${utteranceId}"`);
            return null;
          }

          return { utteranceId, analysis };
        })
        .filter((ex): ex is PatternExample => ex !== null && ex.analysis.length > 0);

      return {
        patternName,
        description,
        frequency,
        examples,
        effectiveness,
        tip,
      };
    })
    .filter((p) => p.patternName && p.description && p.examples.length > 0);
}

/**
 * Convert LLM output to structured CommunicationPatternsOutput.
 */
export function parseCommunicationPatternsLLMOutput(
  llmOutput: CommunicationPatternsLLMOutput
): CommunicationPatternsOutput {
  return {
    patterns: parsePatternsData(llmOutput.patternsData),
    overallEffectivenessScore: llmOutput.overallEffectivenessScore,
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
 * Create empty CommunicationPatterns output.
 */
export function createEmptyCommunicationPatternsOutput(): CommunicationPatternsOutput {
  return {
    patterns: [],
    overallEffectivenessScore: 50,
    confidenceScore: 0,
    summary: 'Insufficient data for communication patterns analysis.',
  };
}
