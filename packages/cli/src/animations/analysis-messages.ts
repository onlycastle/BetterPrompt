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
  totalOutputTokens: number;
  longestSession: { project: string; durationMin: number };
  mostActiveProject: { name: string; count: number };
  dateRange: { from: Date; to: Date };
  busiestDay: { day: string; count: number };
  avgSessionMinutes: number;
  sourceBreakdown: Map<string, number>;
  rhythm: { sprints: number; deepDives: number; marathons: number };
  peakHours: { peakStart: number; peakEnd: number; label: string } | null;

  // Message-level insights
  firstUserMessage: string;
  longestUserPrompt: { words: number; preview: string; project: string };
  longestAIResponse: { words: number; preview: string; project: string };
  avgUserMessageWords: number;
  shortUserQuotes: string[];
  codingStreakDays: number;
  totalToolCalls: number;
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
  { percent: 50, expression: 'happy', bubble: 'Halfway there! Anti-patterns are surfacing from your sessions' },
  { percent: 75, expression: 'wink', bubble: 'Almost done \u2014 your anti-pattern profile is taking shape' },
  { percent: 90, expression: 'excited', bubble: 'Finalizing your results \u2014 this is going to be interesting!' },
];

// ============================================================================
// Compute Insights (single O(N) pass)
// ============================================================================

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function computeSessionInsights(sessions: SessionWithParsed[]): SessionInsights {
  const projectCounts = new Map<string, number>();
  const dayCounts = new Array<number>(7).fill(0);
  const hourCounts = new Array<number>(24).fill(0);
  const sourceBreakdown = new Map<string, number>();

  let totalMessages = 0;
  let totalDurationSec = 0;
  let userMessages = 0;
  let aiMessages = 0;
  let totalOutputTokens = 0;
  let longestDuration = 0;
  let longestProject = '';
  let minDate = Infinity;
  let maxDate = -Infinity;
  let sprints = 0;
  let deepDives = 0;
  let marathons = 0;

  // Message-level tracking
  let firstUserMessage = '';
  let longestUserPromptWords = 0;
  let longestUserPromptPreview = '';
  let longestUserPromptProject = '';
  let longestAIResponseWords = 0;
  let longestAIResponsePreview = '';
  let longestAIResponseProject = '';
  let totalUserWords = 0;
  let totalUserMessageCount = 0;
  let totalToolCalls = 0;
  const shortQuoteCandidates: string[] = [];
  const activeDates = new Set<string>();

  // Sort by timestamp so firstUserMessage captures earliest session
  const sortedSessions = [...sessions].sort(
    (a, b) => a.metadata.timestamp.getTime() - b.metadata.timestamp.getTime()
  );

  for (const session of sortedSessions) {
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

    // Tool calls
    totalToolCalls += parsed.stats.toolCallCount;

    // Date tracking for streak calculation
    const dateKey = metadata.timestamp.toISOString().slice(0, 10);
    activeDates.add(dateKey);

    // Message-level insights
    for (const msg of parsed.messages) {
      const wordCount = msg.content.split(/\s+/).filter(Boolean).length;

      if (msg.role === 'user') {
        totalUserWords += wordCount;
        totalUserMessageCount++;

        // First user message (from earliest session)
        if (!firstUserMessage && msg.content.trim().length > 0) {
          const trimmed = msg.content.trim();
          firstUserMessage = trimmed.length > 80 ? trimmed.slice(0, 77) + '...' : trimmed;
        }

        // Longest user prompt
        if (wordCount > longestUserPromptWords) {
          longestUserPromptWords = wordCount;
          const preview = msg.content.trim().slice(0, 60);
          longestUserPromptPreview = preview.length < msg.content.trim().length ? preview + '...' : preview;
          longestUserPromptProject = project;
        }

        // Short quotes (10-25 words)
        if (wordCount >= 10 && wordCount <= 25) {
          shortQuoteCandidates.push(msg.content.trim());
        }
      } else if (msg.role === 'assistant') {
        // Longest AI response
        if (wordCount > longestAIResponseWords) {
          longestAIResponseWords = wordCount;
          const preview = msg.content.trim().slice(0, 60);
          longestAIResponsePreview = preview.length < msg.content.trim().length ? preview + '...' : preview;
          longestAIResponseProject = project;
        }
      }
    }
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

  // Coding streak: max consecutive days
  const sortedDates = [...activeDates].sort();
  let maxStreak = 0;
  let currentStreak = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      currentStreak = 1;
    } else {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
    }
    maxStreak = Math.max(maxStreak, currentStreak);
  }

  // Reservoir sampling for short quotes (max 5)
  const shortUserQuotes: string[] = [];
  for (let i = 0; i < shortQuoteCandidates.length; i++) {
    if (shortUserQuotes.length < 5) {
      shortUserQuotes.push(shortQuoteCandidates[i]);
    } else {
      const j = Math.floor(Math.random() * (i + 1));
      if (j < 5) shortUserQuotes[j] = shortQuoteCandidates[i];
    }
  }

  return {
    sessionCount: sessions.length,
    projectCount: projectCounts.size,
    totalMessages,
    totalDurationMinutes,
    userMessages,
    aiMessages,
    totalOutputTokens,
    longestSession: {
      project: longestProject,
      durationMin: Math.round(longestDuration / 60),
    },
    mostActiveProject: { name: mostActiveName, count: mostActiveCount },
    dateRange: {
      from: new Date(minDate === Infinity ? Date.now() : minDate),
      to: new Date(maxDate === -Infinity ? Date.now() : maxDate),
    },
    busiestDay: { day: DAY_NAMES[busiestIdx], count: dayCounts[busiestIdx] },
    avgSessionMinutes: sessions.length > 0 ? Math.round(totalDurationMinutes / sessions.length) : 0,
    sourceBreakdown,
    rhythm: { sprints, deepDives, marathons },
    peakHours,
    firstUserMessage,
    longestUserPrompt: { words: longestUserPromptWords, preview: longestUserPromptPreview, project: longestUserPromptProject },
    longestAIResponse: { words: longestAIResponseWords, preview: longestAIResponsePreview, project: longestAIResponseProject },
    avgUserMessageWords: totalUserMessageCount > 0 ? Math.round(totalUserWords / totalUserMessageCount) : 0,
    shortUserQuotes,
    codingStreakDays: maxStreak,
    totalToolCalls,
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

  tips.push({
    icon: '\uD83D\uDCAC',
    text: `You sent ${formatNumber(insights.userMessages)} messages, AI responded ${formatNumber(insights.aiMessages)} times`,
  });

  // Generic tips (filler, placed after personalized)
  tips.push({
    icon: '\uD83D\uDD2C',
    text: '11 parallel AI models are analyzing your sessions right now',
  });

  tips.push({
    icon: '\uD83D\uDCA1',
    text: '5 developer archetypes \u00D7 3 control levels = 15 anti-pattern profiles',
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
  'Scanning for communication anti-patterns...',
  'Evaluating your thinking patterns...',
  'Detecting workflow anti-patterns...',
  'Mapping your collaboration habits...',
  'Profiling your AI interaction patterns...',
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
