/**
 * Content Classification Schema for LLM-based Filtering
 *
 * Used by DataExtractorWorker to classify developer utterances as either
 * genuine developer input or system-injected metadata.
 *
 * This enables filtering of:
 * - Skill documentation blocks ("Base directory for this skill: /path/...")
 * - Session continuation summaries ("This session is being continued...")
 * - Other system-injected content that isn't direct developer communication
 *
 * @module models/content-classification
 */

import { z } from 'zod';

// ============================================================================
// Classification Types
// ============================================================================

/**
 * Classification result for a single text segment.
 *
 * - "developer": Genuine developer input (questions, requests, code, feedback)
 * - "system": System-injected metadata (skill docs, session summaries, hook outputs)
 */
export const ContentClassificationSchema = z.object({
  /** The classification result */
  classification: z.enum(['developer', 'system']),

  /** Confidence score from 0.0 to 1.0 */
  confidence: z.number().min(0).max(1),

  /** Brief explanation for the classification decision */
  reason: z.string().optional(),

  /**
   * Display-friendly text with machine-generated content summarized.
   *
   * Only provided for "developer" classified texts. Contains the original
   * developer text with pasted technical content (error logs, stack traces,
   * code blocks, CLI output) summarized into short tags like [Error: ...].
   *
   * If the original text is already clean (no logs/traces/code), this will
   * match the original text.
   */
  displayText: z.string().optional(),
});

export type ContentClassification = z.infer<typeof ContentClassificationSchema>;

// ============================================================================
// Batch Classification Schema
// ============================================================================

/**
 * Batch classification result for multiple text segments.
 * Used for efficient batch processing in a single LLM call.
 */
export const BatchClassificationResultSchema = z.object({
  /** Array of classification results, one per input segment */
  classifications: z.array(ContentClassificationSchema),
});

export type BatchClassificationResult = z.infer<typeof BatchClassificationResultSchema>;

// ============================================================================
// Input Schema for LLM
// ============================================================================

/**
 * Input item for batch classification.
 * Includes the original ID for correlation after classification.
 */
export interface ClassificationInput {
  /** Unique identifier for correlation */
  id: string;

  /** Text content to classify */
  text: string;
}
