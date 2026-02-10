/**
 * Shared formatting utilities for enterprise dashboard components
 */

import type { WeeklyTokenTrend } from '../../types/enterprise';

/** Format token count as K/M (e.g. 450000 -> "450K") */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export interface TokenDelta {
  current: number;
  wow: number | null;
  mom: number | null;
}

/** Compute current week tokens + WoW% + MoM% from weeklyTokenTrend array */
export function getTokenDelta(trend: WeeklyTokenTrend[]): TokenDelta {
  if (trend.length === 0) return { current: 0, wow: null, mom: null };

  const sorted = [...trend].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  const current = sorted[0].totalTokens;

  const wow = sorted.length >= 2 && sorted[1].totalTokens > 0
    ? Math.round(((current - sorted[1].totalTokens) / sorted[1].totalTokens) * 100)
    : null;

  const mom = sorted.length >= 5 && sorted[4].totalTokens > 0
    ? Math.round(((current - sorted[4].totalTokens) / sorted[4].totalTokens) * 100)
    : null;

  return { current, wow, mom };
}

/** Get CSS class and arrow for a delta percentage */
export function getDeltaIndicator(
  pct: number | null,
  styles: { positive: string; negative: string; neutral: string }
): { arrow: string; className: string } | null {
  if (pct === null) return null;
  if (pct > 0) return { arrow: '\u2191', className: styles.positive };
  if (pct < 0) return { arrow: '\u2193', className: styles.negative };
  return { arrow: '\u2192', className: styles.neutral };
}

/** Pluralize "member" / "members" */
export function pluralizeMembers(count: number): string {
  return `${count} ${count === 1 ? 'member' : 'members'}`;
}
