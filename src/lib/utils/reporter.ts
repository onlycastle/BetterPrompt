/**
 * Reporter Utilities
 *
 * Table generation for sessions and history lists.
 * CLI rendering is handled by src/cli/output/
 */

import type { Rating } from '../models/index';

/**
 * Rating to emoji mapping
 */
const RATING_EMOJI: Record<Rating, string> = {
  Strong: '🟢',
  Developing: '🟡',
  'Needs Work': '🔴',
};

/**
 * Generate a sessions list table (markdown format)
 */
export function generateSessionsTable(
  sessions: Array<{
    sessionId: string;
    projectName: string;
    timestamp: Date;
    messageCount: number;
    durationSeconds: number;
  }>
): string {
  if (sessions.length === 0) {
    return 'No sessions found.';
  }

  const header = '| # | Project | Date | Duration | Messages | Session ID |';
  const divider = '|---|---------|------|----------|----------|------------|';

  const rows = sessions.map((s, i) => {
    const date = s.timestamp.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const duration = Math.round(s.durationSeconds / 60);
    return `| ${i + 1} | ${s.projectName} | ${date} | ${duration}m | ${s.messageCount} | \`${s.sessionId.slice(0, 8)}...\` |`;
  });

  return [header, divider, ...rows].join('\n');
}

/**
 * Generate history list of past analyses (markdown format)
 */
export function generateHistoryList(
  analyses: Array<{
    sessionId: string;
    projectName: string;
    analyzedAt: Date;
    ratings: {
      planning: string;
      criticalThinking: string;
      codeUnderstanding: string;
    };
  }>
): string {
  if (analyses.length === 0) {
    return 'No past analyses found.';
  }

  const header = '| # | Project | Analyzed | Planning | Critical | Code |';
  const divider = '|---|---------|----------|----------|----------|------|';

  const rows = analyses.map((a, i) => {
    const date = a.analyzedAt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `| ${i + 1} | ${a.projectName} | ${date} | ${RATING_EMOJI[a.ratings.planning as Rating]} | ${RATING_EMOJI[a.ratings.criticalThinking as Rating]} | ${RATING_EMOJI[a.ratings.codeUnderstanding as Rating]} |`;
  });

  return [header, divider, ...rows].join('\n');
}
