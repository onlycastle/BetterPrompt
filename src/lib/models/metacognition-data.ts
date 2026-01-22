/**
 * Metacognition Data - Zod schemas for metacognitive pattern detection
 *
 * Detects:
 * - Self-awareness signals (pattern recognition, strategy verbalization)
 * - Unawareness signals (repeated patterns without recognition)
 * - Growth mindset indicators (curiosity, experimentation, resilience)
 *
 * Schemas use flattened semicolon-separated strings to comply with
 * Gemini's 4-level nesting limit.
 *
 * @module models/metacognition-data
 */

import { z } from 'zod';

// ============================================================================
// Metacognition Worker Output Schema (LLM-friendly, flattened)
// ============================================================================

/**
 * Metacognition Worker Output Schema
 *
 * Detects user's metacognitive patterns:
 * - Self-reflection moments
 * - Strategy verbalization
 * - Learning recognition
 * - Blind spots (unrecognized repeated patterns)
 *
 * @example
 * ```json
 * {
 *   "awarenessInstancesData": "self_reflection|I keep doing this|error handling|Shows pattern awareness;strategy_verbalization|Let me try differently this time|debugging|Adapts approach",
 *   "blindSpotsData": "no_error_analysis|5|session1,session2,session3|sunk_cost_loop;skip_testing|3|session2,session4|quality_neglect",
 *   "growthMindsetData": "curiosity:75|experimentation:60|resilience:80",
 *   "topInsights": [
 *     "You explicitly recognized your patterns 3 times - strong self-awareness",
 *     "Error handling blind spot: 5 times without analysis",
 *     "High resilience score (80) - bounces back from failures"
 *   ],
 *   "metacognitiveAwarenessScore": 72,
 *   "confidenceScore": 0.85
 * }
 * ```
 */
export const MetacognitionOutputSchema = z.object({
  // Awareness instances - "type|quote|context|implication;..."
  // type: self_reflection | strategy_verbalization | learning_recognition
  awarenessInstancesData: z
    .string()
    .max(3000)
    .describe(
      'Self-awareness moments: "type|quote|context|implication;..." where type is self_reflection, strategy_verbalization, or learning_recognition'
    ),

  // Blind spots - "pattern|frequency|sessionIds|linkedAntiPattern;..."
  blindSpotsData: z
    .string()
    .max(2000)
    .describe(
      'Unrecognized repeated patterns: "pattern|frequency|sessionIds|linkedAntiPattern;..."'
    ),

  // Growth mindset scores - "curiosity:score|experimentation:score|resilience:score"
  growthMindsetData: z
    .string()
    .max(200)
    .describe('Growth mindset: "curiosity:0-100|experimentation:0-100|resilience:0-100"'),

  // Top 3 metacognition insights
  topInsights: z.array(z.string().max(200)).max(3),

  // Overall metacognitive awareness score (0-100)
  metacognitiveAwarenessScore: z.number().min(0).max(100),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),
});

export type MetacognitionOutput = z.infer<typeof MetacognitionOutputSchema>;

// ============================================================================
// Parsed Types (for storage/display - full nested objects)
// ============================================================================

/**
 * Types for awareness instance types
 */
export type AwarenessType = 'self_reflection' | 'strategy_verbalization' | 'learning_recognition';

/**
 * Parsed awareness instance
 */
export interface AwarenessInstance {
  type: AwarenessType;
  quote: string;
  context: string;
  implication: string;
}

/**
 * Parsed blind spot
 */
export interface BlindSpot {
  pattern: string;
  frequency: number;
  sessionIds: string[];
  linkedAntiPattern?: string;
  kbRecommendation?: string;
}

/**
 * Growth mindset indicators
 */
export interface GrowthMindsetIndicators {
  curiosityScore: number;
  experimentationScore: number;
  resilienceScore: number;
  overall: number;
}

/**
 * Full metacognition analysis result (parsed from LLM output)
 */
export interface MetacognitionAnalysis {
  metacognitiveAwarenessScore: number;
  awarenessInstances: AwarenessInstance[];
  blindSpots: BlindSpot[];
  growthMindsetIndicators: GrowthMindsetIndicators;
  topInsights: string[];
  confidenceScore: number;
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse awareness instances data from flattened string
 *
 * @param data - "type|quote|context|implication;..."
 * @returns Parsed awareness instances
 */
export function parseAwarenessInstancesData(data: string | undefined): AwarenessInstance[] {
  if (!data) return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      if (parts.length >= 4) {
        return {
          type: parts[0] as AwarenessType,
          quote: parts[1] || '',
          context: parts[2] || '',
          implication: parts[3] || '',
        };
      }
      // Fallback for malformed entries
      return {
        type: 'self_reflection' as AwarenessType,
        quote: parts[0] || '',
        context: '',
        implication: '',
      };
    });
}

/**
 * Parse blind spots data from flattened string
 *
 * @param data - "pattern|frequency|sessionIds|linkedAntiPattern;..."
 * @returns Parsed blind spots
 */
export function parseBlindSpotsData(data: string | undefined): BlindSpot[] {
  if (!data) return [];

  return data
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split('|');
      return {
        pattern: parts[0] || '',
        frequency: parseInt(parts[1], 10) || 0,
        sessionIds: parts[2]?.split(',').filter(Boolean) || [],
        linkedAntiPattern: parts[3] || undefined,
      };
    });
}

/**
 * Parse growth mindset data from flattened string
 *
 * @param data - "curiosity:score|experimentation:score|resilience:score"
 * @returns Growth mindset indicators
 */
export function parseGrowthMindsetData(data: string | undefined): GrowthMindsetIndicators {
  const defaults: GrowthMindsetIndicators = {
    curiosityScore: 50,
    experimentationScore: 50,
    resilienceScore: 50,
    overall: 50,
  };

  if (!data) return defaults;

  const parts = data.split('|');
  for (const part of parts) {
    const [key, value] = part.split(':');
    const score = parseInt(value, 10) || 50;
    if (key === 'curiosity') defaults.curiosityScore = score;
    else if (key === 'experimentation') defaults.experimentationScore = score;
    else if (key === 'resilience') defaults.resilienceScore = score;
  }

  // Calculate overall as weighted average
  defaults.overall = Math.round(
    defaults.curiosityScore * 0.35 + defaults.experimentationScore * 0.35 + defaults.resilienceScore * 0.3
  );

  return defaults;
}

/**
 * Parse full MetacognitionOutput into MetacognitionAnalysis
 *
 * @param output - LLM output (flattened)
 * @returns Parsed analysis
 */
export function parseMetacognitionOutput(output: MetacognitionOutput): MetacognitionAnalysis {
  return {
    metacognitiveAwarenessScore: output.metacognitiveAwarenessScore,
    awarenessInstances: parseAwarenessInstancesData(output.awarenessInstancesData),
    blindSpots: parseBlindSpotsData(output.blindSpotsData),
    growthMindsetIndicators: parseGrowthMindsetData(output.growthMindsetData),
    topInsights: output.topInsights || [],
    confidenceScore: output.confidenceScore,
  };
}

// ============================================================================
// Default/Empty Values
// ============================================================================

/**
 * Create default/empty metacognition output
 */
export function createDefaultMetacognitionOutput(): MetacognitionOutput {
  return {
    awarenessInstancesData: '',
    blindSpotsData: '',
    growthMindsetData: 'curiosity:50|experimentation:50|resilience:50',
    topInsights: [],
    metacognitiveAwarenessScore: 50,
    confidenceScore: 0,
  };
}
