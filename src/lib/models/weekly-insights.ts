/**
 * Weekly Insights Schema
 *
 * Data model for the "This Week" insights dashboard in the Activity tab.
 * Combines deterministic stats (computed from activitySessions) with
 * LLM-generated narrative and highlights.
 *
 * Pipeline position: Phase 2 (parallel with Workers + ProjectSummarizer)
 * LLM calls: 1 (narrative + highlights only)
 *
 * Gemini nesting analysis:
 *   root{} → stats{} = 2 levels
 *   root{} → comparison{} = 2 levels
 *   root{} → projects[] → item{} = 2 levels (array doesn't count)
 *   root{} → weekRange{} = 2 levels
 *   Max depth: 2 (well within 4-level limit)
 *
 * @module models/weekly-insights
 */

import { z } from 'zod';

// ============================================================================
// LLM Response Schema (for Gemini structured output)
// ============================================================================

/**
 * Schema for the LLM-generated portion of weekly insights.
 * Only narrative and highlights are LLM-generated; everything else is deterministic.
 *
 * Gemini nesting: root{} = 1 level (well within limit)
 */
export const WeeklyInsightsLLMSchema = z.object({
  narrative: z.string()
    .describe('2-3 sentence summary of the week\'s AI collaboration activity. Mention specific projects, key accomplishments, and activity shifts.'),
  highlights: z.array(z.string())
    .describe('3-5 key highlights from the week. Each should be a concise bullet point about a notable accomplishment or pattern.'),
  topSessionSummaries: z.array(z.string())
    .describe('Concise 1-line summary for each top session (in order). Describe what was accomplished, not the raw message. Ignore system tags or noise.'),
});

export type WeeklyInsightsLLMOutput = z.infer<typeof WeeklyInsightsLLMSchema>;

// ============================================================================
// Full WeeklyInsights Schema (stored in VerboseEvaluation)
// ============================================================================

export const WeeklyInsightsSchema = z.object({
  /** Date range for this week */
  weekRange: z.object({
    start: z.string().describe('ISO 8601 date string for week start'),
    end: z.string().describe('ISO 8601 date string for week end'),
  }),

  /** Deterministic stats computed from activitySessions */
  stats: z.object({
    totalSessions: z.number().int().min(0),
    totalMinutes: z.number().min(0),
    totalTokens: z.number().int().min(0),
    activeDays: z.number().int().min(0).max(7),
    avgSessionMinutes: z.number().min(0),
  }),

  /** Comparison with previous week (percentage changes) */
  comparison: z.object({
    sessionsDelta: z.number().describe('Percentage change vs previous week'),
    minutesDelta: z.number().describe('Percentage change vs previous week'),
    tokensDelta: z.number().describe('Percentage change vs previous week'),
    activeDaysDelta: z.number().describe('Absolute change in active days'),
  }).optional().describe('Omitted when no previous week data exists'),

  /** Per-project breakdown sorted by session count descending */
  projects: z.array(z.object({
    projectName: z.string(),
    sessionCount: z.number().int().min(0),
    totalMinutes: z.number().min(0),
    percentage: z.number().min(0).max(100),
  })),

  /** Top sessions from the #1 project (by duration, up to 3) */
  topProjectSessions: z.array(z.object({
    summary: z.string(),
    durationMinutes: z.number().min(0),
    date: z.string().describe('Short date label (e.g., "Feb 5")'),
  })).optional().describe('Top 3 sessions from the most active project'),

  /** LLM-generated 2-3 sentence narrative */
  narrative: z.string(),

  /** LLM-generated 3-5 key highlights */
  highlights: z.array(z.string()),
});

export type WeeklyInsights = z.infer<typeof WeeklyInsightsSchema>;
