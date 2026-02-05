/**
 * Weekly Insight Generator Stage - LLM-based "This Week" insights generation
 *
 * Generates weekly insights from activitySessions data by computing
 * deterministic stats (sessions, minutes, tokens, active days) and
 * using LLM to generate a narrative summary and highlights.
 *
 * Pipeline position: Phase 2 (parallel with Workers + ProjectSummarizer)
 * LLM calls: 1 (narrative + highlights only; 0 if no sessions this week)
 *
 * Algorithm:
 * 1. Split sessions into "this week" (last 7 days) and "previous week" (7-14 days ago)
 * 2. Compute deterministic stats for both weeks
 * 3. Compute comparison deltas (percentage change; omit if no previous week data)
 * 4. Compute per-project breakdown from this week's sessions
 * 5. LLM call for narrative + highlights (skipped if 0 sessions this week)
 *
 * @module analyzer/stages/weekly-insight-generator
 */

import { GeminiClient, type GeminiClientConfig, type TokenUsage } from '../clients/gemini-client';
import { WeeklyInsightsLLMSchema, type WeeklyInsights } from '../../models/weekly-insights';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the Weekly Insight Generator stage
 */
export interface WeeklyInsightGeneratorConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
  maxOutputTokens?: number;
  verbose?: boolean;
}

/**
 * Result of weekly insight generator stage including token usage
 */
export interface WeeklyInsightGeneratorResult {
  data: WeeklyInsights;
  usage: TokenUsage;
}

/**
 * Input session data (from activitySessions)
 */
export interface ActivitySessionInput {
  sessionId: string;
  projectName: string;
  startTime: string;       // ISO 8601
  durationMinutes: number;
  messageCount: number;
  summary: string;
  totalInputTokens?: number;
  totalOutputTokens?: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<WeeklyInsightGeneratorConfig, 'apiKey' | 'verbose'>> = {
  model: 'gemini-3-flash-preview',
  temperature: 1.0,
  maxRetries: 2,
  maxOutputTokens: 65536,
};

/** Zero token usage (no LLM call was made) */
const ZERO_USAGE: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

/** Milliseconds in one day */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Compute week stats from a set of sessions
 */
interface WeekStats {
  totalSessions: number;
  totalMinutes: number;
  totalTokens: number;
  activeDays: number;
  avgSessionMinutes: number;
}

function computeWeekStats(sessions: ActivitySessionInput[]): WeekStats {
  const totalSessions = sessions.length;
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalTokens = sessions.reduce(
    (sum, s) => sum + (s.totalInputTokens ?? 0) + (s.totalOutputTokens ?? 0),
    0
  );

  // Active days = unique calendar dates
  const uniqueDates = new Set(
    sessions.map((s) => {
      const d = new Date(s.startTime);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );
  const activeDays = uniqueDates.size;

  const avgSessionMinutes = totalSessions > 0
    ? Math.round((totalMinutes / totalSessions) * 10) / 10
    : 0;

  return { totalSessions, totalMinutes, totalTokens, activeDays, avgSessionMinutes };
}

/**
 * Compute percentage delta, handling division by zero
 */
function percentageDelta(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

/**
 * Format a date as short month + day (e.g., "Feb 1")
 */
function formatShortDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

// ============================================================================
// Prompts
// ============================================================================

const SYSTEM_PROMPT = `You are a data analyst summarizing a developer's weekly AI collaboration activity.

Guidelines:
- Generate a 2-3 sentence narrative summarizing the week's activity
- Generate 3-5 highlights as concise bullet points
- Mention specific projects and key accomplishments
- Identify notable patterns (focus shifts, productivity spikes, new projects)
- Write in English
- Be specific and data-driven, not generic`;

function buildUserPrompt(
  sessions: ActivitySessionInput[],
  weekRangeLabel: string,
  stats: WeekStats
): string {
  const sessionList = sessions
    .map((s, i) => {
      const date = formatShortDate(new Date(s.startTime));
      return `${i + 1}. [${date}] ${s.projectName} - ${s.durationMinutes} min, ${s.messageCount} messages: ${s.summary}`;
    })
    .join('\n');

  return `Week: ${weekRangeLabel}
Total sessions: ${stats.totalSessions} | Total time: ${stats.totalMinutes} min | Active days: ${stats.activeDays}/7 | Avg session: ${stats.avgSessionMinutes} min

Sessions this week:
${sessionList}

Provide a narrative summary and key highlights for this week's AI collaboration activity.`;
}

// ============================================================================
// Weekly Insight Generator Stage
// ============================================================================

/**
 * Weekly Insight Generator Stage - LLM-based "This Week" insights
 *
 * Splits sessions into current week (last 7 days) and previous week (7-14 days ago),
 * computes deterministic stats and comparison deltas, then uses LLM to generate
 * a narrative summary and highlights.
 *
 * @example
 * ```typescript
 * const generator = new WeeklyInsightGeneratorStage({
 *   apiKey: process.env.GOOGLE_GEMINI_API_KEY,
 * });
 *
 * const result = await generator.generate([
 *   {
 *     sessionId: 'a',
 *     projectName: 'my-app',
 *     startTime: '2026-02-05T10:00:00Z',
 *     durationMinutes: 45,
 *     messageCount: 12,
 *     summary: 'Implemented auth flow',
 *   },
 * ]);
 * ```
 */
export class WeeklyInsightGeneratorStage {
  private client: GeminiClient;
  private maxOutputTokens: number;
  private verbose: boolean;

  constructor(config: WeeklyInsightGeneratorConfig = {}) {
    const clientConfig: GeminiClientConfig = {
      apiKey: config.apiKey,
      model: config.model || DEFAULT_CONFIG.model,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };

    this.client = new GeminiClient(clientConfig);
    this.maxOutputTokens = config.maxOutputTokens ?? DEFAULT_CONFIG.maxOutputTokens;
    this.verbose = config.verbose ?? false;
  }

  /**
   * Generate weekly insights from activity sessions
   *
   * @param sessions - Array of activity session data
   * @returns Weekly insights with token usage
   */
  async generate(sessions: ActivitySessionInput[]): Promise<WeeklyInsightGeneratorResult> {
    const now = new Date();

    // Week boundaries
    const thisWeekStart = new Date(now.getTime() - 7 * MS_PER_DAY);
    const prevWeekStart = new Date(now.getTime() - 14 * MS_PER_DAY);

    // Filter sessions into week buckets
    const thisWeekSessions = sessions.filter((s) => {
      const t = new Date(s.startTime).getTime();
      return t >= thisWeekStart.getTime() && t <= now.getTime();
    });

    const prevWeekSessions = sessions.filter((s) => {
      const t = new Date(s.startTime).getTime();
      return t >= prevWeekStart.getTime() && t < thisWeekStart.getTime();
    });

    this.log(
      `Sessions split: ${thisWeekSessions.length} this week, ${prevWeekSessions.length} previous week`
    );

    // Week range for display
    const weekRange = {
      start: thisWeekStart.toISOString(),
      end: now.toISOString(),
    };
    const weekRangeLabel = `${formatShortDate(thisWeekStart)} \u2013 ${formatShortDate(now)}`;

    // Compute stats for both weeks
    const thisWeekStats = computeWeekStats(thisWeekSessions);
    const prevWeekStats = computeWeekStats(prevWeekSessions);

    // Compute comparison (omit if no previous week data)
    const comparison = prevWeekSessions.length > 0
      ? {
          sessionsDelta: percentageDelta(thisWeekStats.totalSessions, prevWeekStats.totalSessions),
          minutesDelta: percentageDelta(thisWeekStats.totalMinutes, prevWeekStats.totalMinutes),
          tokensDelta: percentageDelta(thisWeekStats.totalTokens, prevWeekStats.totalTokens),
          activeDaysDelta: thisWeekStats.activeDays - prevWeekStats.activeDays,
        }
      : undefined;

    // Per-project breakdown from this week
    const projects = this.computeProjectBreakdown(thisWeekSessions, thisWeekStats.totalMinutes);

    // Edge case: no sessions this week -> skip LLM call
    if (thisWeekSessions.length === 0) {
      this.log('No sessions this week, skipping LLM call');

      return {
        data: {
          weekRange,
          stats: thisWeekStats,
          comparison,
          projects,
          narrative: 'No AI collaboration activity this week.',
          highlights: [],
        },
        usage: ZERO_USAGE,
      };
    }

    // LLM call for narrative + highlights
    this.log(`Generating narrative for ${thisWeekSessions.length} sessions via LLM`);

    const userPrompt = buildUserPrompt(thisWeekSessions, weekRangeLabel, thisWeekStats);

    const result = await this.client.generateStructured({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      responseSchema: WeeklyInsightsLLMSchema,
      maxOutputTokens: this.maxOutputTokens,
    });

    this.log(`LLM generated narrative (${result.data.narrative.length} chars) and ${result.data.highlights.length} highlights`);

    return {
      data: {
        weekRange,
        stats: thisWeekStats,
        comparison,
        projects,
        narrative: result.data.narrative,
        highlights: result.data.highlights,
      },
      usage: result.usage,
    };
  }

  /**
   * Compute per-project breakdown from this week's sessions,
   * sorted by session count descending
   */
  private computeProjectBreakdown(
    sessions: ActivitySessionInput[],
    totalMinutes: number
  ): WeeklyInsights['projects'] {
    const map = new Map<string, { sessionCount: number; totalMinutes: number }>();

    for (const session of sessions) {
      const existing = map.get(session.projectName);
      if (existing) {
        existing.sessionCount += 1;
        existing.totalMinutes += session.durationMinutes;
      } else {
        map.set(session.projectName, {
          sessionCount: 1,
          totalMinutes: session.durationMinutes,
        });
      }
    }

    return Array.from(map.entries())
      .map(([projectName, data]) => ({
        projectName,
        sessionCount: data.sessionCount,
        totalMinutes: data.totalMinutes,
        percentage: totalMinutes > 0
          ? Math.round((data.totalMinutes / totalMinutes) * 100)
          : 0,
      }))
      .sort((a, b) => b.sessionCount - a.sessionCount);
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(`[WeeklyInsightGenerator] ${message}`);
    }
  }
}
