/**
 * Analysis Data Schema
 *
 * Zod schemas for Stage 1 (Data Analyst) intermediate output.
 * This represents the structured data extraction that happens before
 * the final personalized narrative is generated.
 */

import { z } from 'zod';
import { CodingStyleTypeSchema, AIControlLevelSchema } from './coding-style.js';
import { DimensionNameEnumSchema } from './verbose-evaluation.js';

// ============================================================================
// Type Distribution Schema
// ============================================================================

/**
 * Type distribution as percentages (sum to 100)
 * Represents the blend of coding styles detected in the session
 */
export const TypeDistributionSchema = z.object({
  architect: z.number().min(0).max(100),
  scientist: z.number().min(0).max(100),
  collaborator: z.number().min(0).max(100),
  speedrunner: z.number().min(0).max(100),
  craftsman: z.number().min(0).max(100),
});
export type TypeDistribution = z.infer<typeof TypeDistributionSchema>;

// ============================================================================
// Extracted Quote Schema
// ============================================================================

/**
 * A single extracted quote from a session with metadata
 * Used as evidence for strengths or growth areas in specific dimensions
 */
export const ExtractedQuoteSchema = z.object({
  /** The actual quote from the developer (10-800 chars) */
  quote: z.string().min(10).max(800),

  /** ISO 8601 date string when this was said */
  sessionDate: z.string(),

  /** Which analysis dimension this quote is evidence for */
  dimension: DimensionNameEnumSchema,

  /** Whether this is a strength or growth opportunity signal */
  signal: z.enum(['strength', 'growth']),

  /** Specific behavior this quote demonstrates (e.g., "Iterative refinement", "Verification habit") */
  behavioralMarker: z.string().max(100),

  /** Confidence level in this quote's significance (0.0 - 1.0) */
  confidence: z.number().min(0).max(1),
});
export type ExtractedQuote = z.infer<typeof ExtractedQuoteSchema>;

// ============================================================================
// Detected Pattern Schema
// ============================================================================

/**
 * A behavioral pattern detected across multiple sessions
 * Represents recurring behaviors that define the developer's style
 */
export const DetectedPatternSchema = z.object({
  /** Unique identifier for this pattern */
  patternId: z.string(),

  /** Category of this pattern */
  patternType: z.enum([
    'communication_style',
    'problem_solving',
    'ai_interaction',
    'verification_habit',
    'tool_usage',
  ]),

  /** How many times this pattern was observed */
  frequency: z.number(),

  /** Example quotes demonstrating this pattern (target: 2-5 examples) */
  examples: z.array(z.string()),

  /** Why this pattern matters (max 200 chars) */
  significance: z.string().max(200),
});
export type DetectedPattern = z.infer<typeof DetectedPatternSchema>;

// ============================================================================
// Dimension Signal Schema (Flattened for Gemini API compatibility)
// ============================================================================

/**
 * Aggregated signals for a single analysis dimension
 * Flattened structure to avoid exceeding Gemini's max nesting depth
 *
 * Note: quoteRefs removed to reduce nesting. Quotes can be matched by dimension
 * field in extractedQuotes array.
 */
export const DimensionSignalSchema = z.object({
  /** Which dimension these signals belong to */
  dimension: DimensionNameEnumSchema,

  /** Positive signals (strengths) as simple string descriptions */
  strengthSignals: z.array(z.string().max(150)),

  /** Growth signals (opportunities) as simple string descriptions */
  growthSignals: z.array(z.string().max(150)),
});
export type DimensionSignal = z.infer<typeof DimensionSignalSchema>;

// ============================================================================
// Complete Structured Analysis Data Schema
// ============================================================================

/**
 * Complete structured analysis data from Stage 1 (Data Analyst)
 * This is the intermediate output before Stage 2 (Narrative Writer) generates the final report
 *
 * Structure:
 * 1. Type classification (coding style + control level + distribution)
 * 2. Extracted quotes with metadata (target: 15-50 quotes)
 * 3. Detected behavioral patterns (target: 3-10 patterns)
 * 4. Dimension-specific signals (exactly 6 dimensions)
 * 5. Analysis metadata (coverage, confidence)
 *
 * Note: Array size constraints (minItems/maxItems) are NOT in the schema due to Gemini API
 * limitation that allows only ONE array with size constraints per schema. Quantity targets
 * are specified in the prompt instead, and sanitizeResponse() enforces minimums.
 */
export const StructuredAnalysisDataSchema = z.object({
  /** Type classification and distribution */
  typeAnalysis: z.object({
    /** Primary coding style type */
    primaryType: CodingStyleTypeSchema,

    /** AI control level (vibe-coder | developing | ai-master) */
    controlLevel: AIControlLevelSchema,

    /** Percentage distribution across all 5 types */
    distribution: TypeDistributionSchema,

    /** Explanation of why this classification was chosen (max 800 chars) */
    reasoning: z.string().max(800),
  }),

  /** Raw quotes extracted from sessions (target: 15-50 quotes with metadata) */
  extractedQuotes: z.array(ExtractedQuoteSchema),

  /** Behavioral patterns detected across sessions (target: 3-10 patterns) */
  detectedPatterns: z.array(DetectedPatternSchema),

  /** Dimension-specific signals (must have exactly 6, one per dimension) */
  dimensionSignals: z.array(DimensionSignalSchema).length(6),

  /** Metadata about the analysis quality */
  analysisMetadata: z.object({
    /** Total number of quotes analyzed */
    totalQuotesAnalyzed: z.number(),

    /** Coverage scores per dimension (flattened from z.record for Gemini compatibility) */
    coverageScores: z.array(
      z.object({
        dimension: DimensionNameEnumSchema,
        score: z.number().min(0).max(1),
      })
    ),

    /** Overall confidence in this analysis (0.0 - 1.0) */
    confidenceScore: z.number().min(0).max(1),
  }),
});
export type StructuredAnalysisData = z.infer<typeof StructuredAnalysisDataSchema>;
