/**
 * GrowthLeaderboard Component
 * Ranked table of members showing activity visibility: score, token usage, and recent work
 */

'use client';

import { useState, useMemo } from 'react';
import { ProgressRing } from '../dashboard/ProgressRing';
import { formatTokens, getTokenDelta, getDeltaIndicator } from './format-utils';
import type { TeamMemberAnalysis, MemberProjectActivity } from '../../types/enterprise';
import styles from './GrowthLeaderboard.module.css';

export interface GrowthLeaderboardProps {
  members: TeamMemberAnalysis[];
}

type SortKey = 'currentScore' | 'weeklyTokens';

/** Extract top N summary lines from the most recent projects */
function getRecentSummaryLines(projects: MemberProjectActivity[], maxLines = 3): string[] {
  const sorted = [...projects].sort((a, b) => b.lastActiveDate.localeCompare(a.lastActiveDate));
  const lines: string[] = [];
  for (const p of sorted) {
    for (const line of p.summaryLines) {
      if (lines.length >= maxLines) return lines;
      lines.push(line);
    }
  }
  return lines;
}

function renderDelta(pct: number | null, suffix: string): React.ReactNode {
  const indicator = getDeltaIndicator(pct, {
    positive: styles.deltaPositive,
    negative: styles.deltaNegative,
    neutral: styles.deltaNeutral,
  });
  if (!indicator) return null;
  return (
    <span className={indicator.className}>
      {indicator.arrow}{Math.abs(pct!)}% {suffix}
    </span>
  );
}

export function GrowthLeaderboard({ members }: GrowthLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>('currentScore');
  const [teamFilter, setTeamFilter] = useState<string>('all');

  const departments = useMemo(
    () => [...new Set(members.map(m => m.department))],
    [members],
  );

  const sorted = useMemo(() => {
    let result = [...members];

    if (teamFilter !== 'all') {
      result = result.filter(m => m.department === teamFilter);
    }

    result.sort((a, b) => {
      if (sortKey === 'currentScore') {
        return b.growth.currentScore - a.growth.currentScore;
      }
      // weeklyTokens: compare current week token count
      const aTokens = getTokenDelta(a.tokenUsage.weeklyTokenTrend).current;
      const bTokens = getTokenDelta(b.tokenUsage.weeklyTokenTrend).current;
      return bTokens - aTokens;
    });

    return result;
  }, [members, sortKey, teamFilter]);

  const sortIndicator = (key: SortKey) => (sortKey === key ? ' \u2193' : '');

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <select
          value={teamFilter}
          onChange={e => setTeamFilter(e.target.value)}
          className={styles.select}
        >
          <option value="all">All Teams</option>
          {departments.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>#</th>
              <th className={styles.th}>Name</th>
              <th className={styles.th} onClick={() => setSortKey('currentScore')}>
                Score{sortIndicator('currentScore')}
              </th>
              <th className={styles.th} onClick={() => setSortKey('weeklyTokens')}>
                Tokens{sortIndicator('weeklyTokens')}
              </th>
              <th className={styles.th}>This Week</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((member, idx) => {
              const tokenDelta = getTokenDelta(member.tokenUsage.weeklyTokenTrend);
              const summaryLines = getRecentSummaryLines(member.projects);
              return (
                <tr key={member.id} className={styles.row}>
                  <td className={styles.td}>
                    <span className={styles.rank}>{idx + 1}</span>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.nameCell}>
                      <div className={styles.avatar}>{member.name.charAt(0)}</div>
                      <div>
                        <div className={styles.memberName}>{member.name}</div>
                        <div className={styles.memberRole}>{member.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.scoreCell}>
                      <ProgressRing value={member.growth.currentScore} size={32} strokeWidth={3} showValue={false} />
                      <span className={styles.scoreText}>{member.growth.currentScore}</span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.tokenCell}>
                      <span className={styles.tokenMain}>{formatTokens(tokenDelta.current)}</span>
                      <span className={styles.tokenDeltas}>
                        {renderDelta(tokenDelta.wow, 'w')}
                        {tokenDelta.wow !== null && tokenDelta.mom !== null && ' '}
                        {renderDelta(tokenDelta.mom, 'm')}
                      </span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    {summaryLines.length > 0 ? (
                      <ul className={styles.summaryList}>
                        {summaryLines.map((line, i) => (
                          <li key={i} className={styles.summaryItem}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className={styles.summaryEmpty}>No activity</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyRow}>No members match filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
