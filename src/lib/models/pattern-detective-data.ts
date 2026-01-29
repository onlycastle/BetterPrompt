/**
 * Pattern Detective Data Schema - Legacy Agent Output
 *
 * PatternDetective detects:
 * - Repeated questions across sessions
 * - Conversation style patterns (vague requests, etc.)
 * - Request start patterns
 *
 * Legacy agent kept for backward compatibility with cached data
 * in the database (30-day retention).
 *
 * @module models/pattern-detective-data
 */

import { z } from 'zod';

// ============================================================================
// Pattern Detective Output Schema
// ============================================================================

/**
 * Pattern Detective Output Schema
 *
 * Detects:
 * - Repeated questions across sessions
 * - Conversation style patterns (vague requests, etc.)
 * - Request start patterns
 *
 * @example
 * ```json
 * {
 *   "repeatedQuestionsData": "React hooks:5:useEffect cleanup;TypeScript generics:3:generic constraints",
 *   "conversationStyleData": "vague_request:23:'just do it' pattern;proactive_context:15:provides context upfront",
 *   "requestStartPatternsData": "Can you...:45;fix this:12;help me:8",
 *   "topInsights": [
 *     "TypeScript generics questions appeared 12 times across 5 sessions",
 *     "67% of requests start without specific context",
 *     "'Just do it' pattern detected 23 times"
 *   ],
 *   "overallStyleSummary": "Direct communicator who tends to skip context",
 *   "confidenceScore": 0.85
 * }
 * ```
 */
export const PatternDetectiveOutputSchema = z.object({
  // Repeated questions - "topic:count:example;..."
  repeatedQuestionsData: z.string().max(2000),

  // Conversation style patterns - "pattern:frequency:example;..."
  conversationStyleData: z.string().max(2000),

  // Request start patterns - "phrase:count;..."
  requestStartPatternsData: z.string().max(1000),

  // Top 3 Wow Insights (displayed directly in UI)
  topInsights: z.array(z.string().max(3000)).max(3),

  // KPT (Keep/Problem/Try) structured fields for balanced feedback
  // These provide explicit categorization instead of relying on keyword matching
  kptKeep: z.array(z.string().max(500)).max(2).optional(),     // Strengths to maintain (0-2)
  kptProblem: z.array(z.string().max(500)).max(2).optional(),  // Issues to address (1-2, expected)
  kptTry: z.array(z.string().max(500)).max(2).optional(),      // Actionable suggestions (1-2, expected)

  // Overall summary
  overallStyleSummary: z.string().max(3000),

  // Confidence score (0-1)
  confidenceScore: z.number().min(0).max(1),

  // NEW: Repeated command patterns (multi-step instructions)
  // "pattern|frequency|example;..." where pattern uses → to show sequence
  // Example: "check code→analyze problem→create plan|5|check the code, analyze it, then make a plan"
  repeatedCommandPatternsData: z.string().max(3000).optional(),

  // NEW: Structured strengths with evidence (replaces topInsights for positive patterns)
  // Format: "title|description|quote1,quote2,quote3;title2|description2|quotes;..."
  strengthsData: z.string().max(4000).optional(),

  // NEW: Growth areas with evidence and recommendations (replaces topInsights for improvements)
  // Format: "title|description|evidence1,evidence2|recommendation;title2|..."
  growthAreasData: z.string().max(4000).optional(),
});

export type PatternDetectiveOutput = z.infer<typeof PatternDetectiveOutputSchema>;
