/**
 * Session Summary Data Schema
 *
 * Zod schemas for session summaries used by Phase 1.5 SessionSummarizer.
 * Generates LLM-quality 1-line summaries for the top-50 analyzed sessions.
 *
 * Separate from ActivitySessionInfo (CLI activity scanner) which provides
 * deterministic metadata for ALL recent sessions.
 *
 * @module models/session-summary-data
 */

import { z } from 'zod';

/**
 * Single session summary item from LLM
 */
export const SessionSummaryItemSchema = z.object({
  sessionId: z.string().describe('Session UUID'),
  summary: z.string().describe('1-line summary of what the developer worked on (max 80 chars)'),
});
export type SessionSummaryItem = z.infer<typeof SessionSummaryItemSchema>;

/**
 * Batch LLM response schema for session summaries
 * Gemini nesting: root{} -> summaries[] -> item{} = 2 levels
 */
export const SessionSummaryBatchLLMSchema = z.object({
  summaries: z.array(SessionSummaryItemSchema)
    .describe('1-line summary for each session'),
});
export type SessionSummaryBatchLLM = z.infer<typeof SessionSummaryBatchLLMSchema>;
