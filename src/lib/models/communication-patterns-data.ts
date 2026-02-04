/**
 * Communication Patterns Data Schema - Phase 2 Worker Output
 *
 * CommunicationPatternsWorker analyzes:
 * - Communication patterns: How clearly does the developer express their needs?
 * - Signature quotes: Developer's most impressive moments
 *
 * This worker answers: "How clearly does this developer communicate with AI?"
 *
 * Separated from ThinkingQuality for Single Responsibility Principle:
 * - ThinkingQuality: Planning + Critical Thinking
 * - CommunicationPatterns: Communication patterns + Signature quotes
 *
 * @module models/communication-patterns-data
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
// Communication Pattern Types
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
 * Extended with full insight details for sidebar display.
 */
export const ReferencedInsightSchema = z.object({
  /** Insight ID (e.g., "pi-001") */
  id: z.string(),
  /** Human-readable title (e.g., "Skill Atrophy Self-Diagnosis") */
  title: z.string(),
  /** Source URL for the insight */
  url: z.string(),
  /** Main insight text */
  keyTakeaway: z.string(),
  /** Actionable tips array */
  actionableAdvice: z.array(z.string()),
  /** Insight category: diagnosis | trend | tool | type-specific */
  category: z.string(),
  /** Author name from source */
  sourceAuthor: z.string(),
});
export type ReferencedInsight = z.infer<typeof ReferencedInsightSchema>;

// ============================================================================
// Communication Patterns Output Schema
// ============================================================================

/**
 * Complete output from CommunicationPatternsWorker.
 *
 * Analyzes communication clarity dimension:
 * - How effectively do they express their needs and provide context?
 */
export const CommunicationPatternsOutputSchema = z.object({
  // ─────────────────────────────────────────────────────────────────────────
  // Communication Patterns
  // ─────────────────────────────────────────────────────────────────────────

  /** Communication patterns detected (5-12 for comprehensive analysis) */
  communicationPatterns: z.array(CommunicationPatternSchema),

  /** Signature quotes - developer's most impressive moments */
  signatureQuotes: z.array(SignatureQuoteSchema).optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Overall Scores
  // ─────────────────────────────────────────────────────────────────────────

  /** Overall communication score (0-100) */
  overallCommunicationScore: z.number().min(0).max(100),

  /** Confidence in this analysis (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Brief summary of communication quality */
  summary: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas
  // ─────────────────────────────────────────────────────────────────────────

  /** Strengths identified in communication domain (1-6 items) */
  strengths: z.array(WorkerStrengthSchema).optional(),

  /** Growth areas identified in communication domain (1-6 items) */
  growthAreas: z.array(WorkerGrowthSchema).optional(),

  /** Referenced insights from Knowledge Base (post-processed from [pi-XXX] references) */
  referencedInsights: z.array(ReferencedInsightSchema).optional(),
});
export type CommunicationPatternsOutput = z.infer<typeof CommunicationPatternsOutputSchema>;

// ============================================================================
// LLM Output Schemas (Structured Arrays - Gemini Nesting Safe)
// ============================================================================

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
 * - communicationPatterns[].examples[]: root → array → object → array → object = 3 levels (safe, arrays don't count)
 */
export const CommunicationPatternsLLMOutputSchema = z.object({
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

  /** Overall communication score (0-100) */
  overallCommunicationScore: z.number().min(0).max(100),

  /** Confidence score (0-1) */
  confidenceScore: z.number().min(0).max(1),

  /** Summary */
  summary: z.string().optional(),

  // ─────────────────────────────────────────────────────────────────────────
  // Domain-specific Strengths & Growth Areas (STRUCTURED OUTPUT)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Strengths identified in communication domain (1-6 items).
   * Evidence format: structured JSON array
   */
  strengths: z.array(StructuredStrengthLLMSchema).min(1).max(6).optional(),

  /**
   * Growth areas identified in communication domain (1-6 items).
   * Evidence format: structured JSON array
   */
  growthAreas: z.array(StructuredGrowthLLMSchema).min(1).max(6),
});
export type CommunicationPatternsLLMOutput = z.infer<typeof CommunicationPatternsLLMOutputSchema>;

// ============================================================================
// Parsing Functions
// ============================================================================

/** Validate utteranceId format: sessionId_turnIndex (e.g., "abc123_5") */
function isValidUtteranceId(id: string | undefined): boolean {
  return !!id && /_\d+$/.test(id);
}

function parseCommunicationPatternsLLM(patterns: CommunicationPatternLLM[] | undefined): CommunicationPattern[] {
  if (!patterns?.length) return [];

  return patterns
    .filter(p => p.patternName && p.description)
    .map(p => {
      const validExamples = (p.examples || [])
        .filter(ex => {
          if (!isValidUtteranceId(ex.utteranceId)) {
            console.warn(`[parseCommunicationPatternsLLM] Invalid utteranceId: "${ex.utteranceId}"`);
            return false;
          }
          return ex.analysis?.length > 0;
        })
        .map(ex => ({ utteranceId: ex.utteranceId, analysis: ex.analysis }));

      return { validExamples, pattern: p };
    })
    .filter(({ validExamples }) => validExamples.length > 0)
    .map(({ validExamples, pattern: p }) => {
      const result: CommunicationPattern = {
        patternName: p.patternName,
        description: p.description,
        frequency: p.frequency,
        examples: validExamples,
        effectiveness: p.effectiveness,
      };
      if (p.tip) result.tip = p.tip;
      return result;
    });
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
 * Convert LLM output to structured CommunicationPatternsOutput.
 */
export function parseCommunicationPatternsLLMOutput(
  llmOutput: CommunicationPatternsLLMOutput
): CommunicationPatternsOutput {
  return {
    // Communication Dimension
    communicationPatterns: parseCommunicationPatternsLLM(llmOutput.communicationPatterns),
    signatureQuotes: parseSignatureQuotesLLM(llmOutput.signatureQuotes),

    // Overall Scores
    overallCommunicationScore: llmOutput.overallCommunicationScore,
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
 * Create empty CommunicationPatterns output
 */
export function createEmptyCommunicationPatternsOutput(): CommunicationPatternsOutput {
  return {
    communicationPatterns: [],
    overallCommunicationScore: 50,
    confidenceScore: 0,
    summary: 'Insufficient data for communication patterns analysis.',
  };
}
