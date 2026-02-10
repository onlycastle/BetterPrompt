/**
 * Analysis Messages - Personalized wait experience
 *
 * Generates data-driven messages from the user's own session data
 * for an engaging "Spotify Wrapped" style analysis wait experience.
 *
 * All insights are computed in a single O(N) pass over sessions.
 */

import type { SessionWithParsed } from '../scanner.js';

// ============================================================================
// Types
// ============================================================================

export interface SessionInsights {
  sessionCount: number;
  projectCount: number;
  totalMessages: number;
  totalDurationMinutes: number;
  userMessages: number;
  aiMessages: number;
  totalToolCalls: number;
  totalOutputTokens: number;
  longestSession: { project: string; durationMin: number };
  mostActiveProject: { name: string; count: number };
  topTools: string[];
  dateRange: { from: Date; to: Date };
  busiestDay: { day: string; count: number };
  avgSessionMinutes: number;
  sourceBreakdown: Map<string, number>;
  rhythm: { sprints: number; deepDives: number; marathons: number };
  peakHours: { peakStart: number; peakEnd: number; label: string } | null;
}

export interface AnalysisMessage {
  icon: string;
  text: string;
}

export interface MilestoneConfig {
  percent: number;
  expression: 'happy' | 'wink' | 'excited';
  bubble: string;
}

// ============================================================================
// Milestone Configs
// ============================================================================

export const MILESTONES: MilestoneConfig[] = [
  { percent: 50, expression: 'happy', bubble: 'Halfway there! Patterns are emerging from your sessions' },
  { percent: 75, expression: 'wink', bubble: 'Almost done \u2014 your developer profile is taking shape' },
  { percent: 90, expression: 'excited', bubble: 'Finalizing your results \u2014 this is going to be interesting!' },
];

// ============================================================================
// Compute Insights (single O(N) pass)
// ============================================================================

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function computeSessionInsights(sessions: SessionWithParsed[]): SessionInsights {
  const projectCounts = new Map<string, number>();
  const toolCounts = new Map<string, number>();
  const dayCounts = new Array<number>(7).fill(0);
  const hourCounts = new Array<number>(24).fill(0);
  const sourceBreakdown = new Map<string, number>();

  let totalMessages = 0;
  let totalDurationSec = 0;
  let userMessages = 0;
  let aiMessages = 0;
  let totalToolCalls = 0;
  let totalOutputTokens = 0;
  let longestDuration = 0;
  let longestProject = '';
  let minDate = Infinity;
  let maxDate = -Infinity;
  let sprints = 0;
  let deepDives = 0;
  let marathons = 0;

  for (const session of sessions) {
    const { metadata, parsed } = session;

    // Project counts
    const project = metadata.projectName;
    projectCounts.set(project, (projectCounts.get(project) ?? 0) + 1);

    // Duration
    const dur = metadata.durationSeconds;
    totalDurationSec += dur;
    if (dur > longestDuration) {
      longestDuration = dur;
      longestProject = project;
    }

    // Messages
    totalMessages += metadata.messageCount;
    userMessages += parsed.stats.userMessageCount;
    aiMessages += parsed.stats.assistantMessageCount;

    // Tools
    totalToolCalls += parsed.stats.toolCallCount;
    for (const tool of parsed.stats.uniqueToolsUsed) {
      toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
    }

    // Tokens
    totalOutputTokens += parsed.stats.totalOutputTokens;

    // Date stats
    const ts = metadata.timestamp.getTime();
    if (ts < minDate) minDate = ts;
    if (ts > maxDate) maxDate = ts;
    dayCounts[metadata.timestamp.getDay()]++;
    hourCounts[metadata.timestamp.getHours()]++;

    // Rhythm classification
    if (dur < 600) sprints++;
    else if (dur <= 1800) deepDives++;
    else marathons++;

    // Source breakdown
    const source = metadata.source ?? 'claude-code';
    sourceBreakdown.set(source, (sourceBreakdown.get(source) ?? 0) + 1);
  }

  // Most active project
  let mostActiveName = '';
  let mostActiveCount = 0;
  for (const [name, count] of projectCounts) {
    if (count > mostActiveCount) {
      mostActiveCount = count;
      mostActiveName = name;
    }
  }

  // Top tools (by session frequency)
  const topTools = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Busiest day of week
  let busiestIdx = 0;
  for (let i = 1; i < 7; i++) {
    if (dayCounts[i] > dayCounts[busiestIdx]) busiestIdx = i;
  }

  const totalDurationMinutes = Math.round(totalDurationSec / 60);

  // Peak hours: best 3-hour sliding window
  let peakHours: SessionInsights['peakHours'] = null;
  if (sessions.length > 3) {
    let bestSum = 0;
    let bestStart = 0;
    for (let h = 0; h < 24; h++) {
      const sum = hourCounts[h] + hourCounts[(h + 1) % 24] + hourCounts[(h + 2) % 24];
      if (sum > bestSum) {
        bestSum = sum;
        bestStart = h;
      }
    }
    if (bestSum > 0) {
      const peakEnd = (bestStart + 2) % 24;
      let label: string;
      if (bestStart >= 5 && bestStart < 12) label = 'Morning';
      else if (bestStart >= 12 && bestStart < 17) label = 'Afternoon';
      else if (bestStart >= 17 && bestStart < 21) label = 'Evening';
      else label = 'Night';
      peakHours = { peakStart: bestStart, peakEnd, label };
    }
  }

  return {
    sessionCount: sessions.length,
    projectCount: projectCounts.size,
    totalMessages,
    totalDurationMinutes,
    userMessages,
    aiMessages,
    totalToolCalls,
    totalOutputTokens,
    longestSession: {
      project: longestProject,
      durationMin: Math.round(longestDuration / 60),
    },
    mostActiveProject: { name: mostActiveName, count: mostActiveCount },
    topTools,
    dateRange: {
      from: new Date(minDate === Infinity ? Date.now() : minDate),
      to: new Date(maxDate === -Infinity ? Date.now() : maxDate),
    },
    busiestDay: { day: DAY_NAMES[busiestIdx], count: dayCounts[busiestIdx] },
    avgSessionMinutes: sessions.length > 0 ? Math.round(totalDurationMinutes / sessions.length) : 0,
    sourceBreakdown,
    rhythm: { sprints, deepDives, marathons },
    peakHours,
  };
}

// ============================================================================
// Format Helpers
// ============================================================================

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================================
// Personalized Messages
// ============================================================================

/**
 * Generate personalized bubble and tip messages from session insights.
 *
 * Bubble messages appear next to Chippy (~10s rotation).
 * Tip messages appear below the progress bar (~18s rotation).
 */
export function generatePersonalizedMessages(insights: SessionInsights): {
  bubbles: string[];
  tips: AnalysisMessage[];
} {
  const bubbles: string[] = [];
  const tips: AnalysisMessage[] = [];

  // --- Bubble messages (personal data, shown next to Chippy) ---

  bubbles.push(
    `${formatNumber(insights.totalMessages)} messages exchanged \u2014 that's more conversation than most people have with their coworkers in a week`,
  );

  if (insights.longestSession.durationMin > 0) {
    bubbles.push(
      `Your longest chat was ${formatDuration(insights.longestSession.durationMin)} on ${insights.longestSession.project} \u2014 that's some serious deep work`,
    );
  }

  if (insights.projectCount > 1) {
    bubbles.push(
      `${insights.projectCount} projects across your workflow \u2014 you really keep AI busy on all fronts`,
    );
  }

  if (insights.totalToolCalls > 0) {
    bubbles.push(
      `That's ${formatNumber(insights.totalToolCalls)} tool calls \u2014 Read, Edit, Bash all working behind the scenes`,
    );
  }

  if (insights.topTools.length > 0) {
    bubbles.push(
      `${insights.topTools[0]} is your most-used tool \u2014 it shows up in almost every session`,
    );
  }

  bubbles.push(
    `Your ${insights.busiestDay.day} productivity spike is real \u2014 let's see what that pattern reveals`,
  );

  if (insights.avgSessionMinutes > 0) {
    bubbles.push(
      `${insights.avgSessionMinutes} min average session \u2014 you know how to stay focused`,
    );
  }

  if (insights.totalOutputTokens > 0) {
    bubbles.push(
      `AI generated ${formatNumber(insights.totalOutputTokens)} tokens for you \u2014 that's roughly a ${Math.round(insights.totalOutputTokens / 1300)}-page book of code and text`,
    );
  }

  // --- Tip messages (personalized first, then generic) ---

  // Personalized tips
  tips.push({
    icon: '\uD83D\uDCCA',
    text: `Scanning ${insights.sessionCount} sessions across ${insights.projectCount} project${insights.projectCount !== 1 ? 's' : ''}`,
  });

  if (insights.totalDurationMinutes > 0) {
    tips.push({
      icon: '\uD83D\uDD50',
      text: `Total AI collaboration time: ${formatDuration(insights.totalDurationMinutes)}`,
    });
  }

  if (insights.longestSession.durationMin > 0) {
    tips.push({
      icon: '\uD83C\uDFC6',
      text: `Longest session: ${formatDuration(insights.longestSession.durationMin)} on ${insights.longestSession.project}`,
    });
  }

  const daySpan = Math.max(
    1,
    Math.ceil(
      (insights.dateRange.to.getTime() - insights.dateRange.from.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1,
  );
  tips.push({
    icon: '\uD83D\uDCC5',
    text: `Sessions from ${formatDateShort(insights.dateRange.from)} to ${formatDateShort(insights.dateRange.to)} (${daySpan} days)`,
  });

  if (insights.busiestDay.count > 1) {
    tips.push({
      icon: '\uD83D\uDCC6',
      text: `Most active day: ${insights.busiestDay.day} (${insights.busiestDay.count} sessions)`,
    });
  }

  if (insights.totalToolCalls > 0) {
    tips.push({
      icon: '\uD83D\uDD27',
      text: `${formatNumber(insights.totalToolCalls)} tool calls \u2014 Read, Edit, Bash, and more`,
    });
  }

  tips.push({
    icon: '\uD83D\uDCAC',
    text: `You sent ${formatNumber(insights.userMessages)} messages, AI responded ${formatNumber(insights.aiMessages)} times`,
  });

  if (insights.topTools.length >= 3) {
    tips.push({
      icon: '\uD83D\uDEE0\uFE0F',
      text: `Top tools: ${insights.topTools.slice(0, 4).join(', ')}`,
    });
  }

  // Generic tips (filler, placed after personalized)
  tips.push({
    icon: '\uD83D\uDD2C',
    text: '11 parallel AI models are analyzing your sessions right now',
  });

  tips.push({
    icon: '\uD83D\uDCA1',
    text: '5 coding styles \u00D7 3 control levels = 15 unique developer types',
  });

  tips.push({
    icon: '\uD83D\uDCA1',
    text: 'Your type is determined by how you collaborate, not what you build',
  });

  tips.push({
    icon: '\u2728',
    text: 'Your detailed report will be ready shortly',
  });

  return { bubbles, tips };
}

// ============================================================================
// Status Line Messages (phase-aware)
// ============================================================================

const ANALYZING_MESSAGES = [
  'Running AI analysis pipeline...',
  'Studying your communication style with AI...',
  'Evaluating your thinking patterns...',
  'Analyzing your coding workflow...',
  'Mapping your collaboration habits...',
  'Profiling your AI interaction style...',
  'Examining your tool usage patterns...',
  'Assessing your session dynamics...',
];

/**
 * Get a rotating status message for the analyzing phase.
 * Changes every ~30 seconds (150 ticks at 200ms).
 */
export function getAnalyzingStatusMessage(tick: number): string {
  const idx = Math.floor(tick / 150) % ANALYZING_MESSAGES.length;
  return ANALYZING_MESSAGES[idx];
}
