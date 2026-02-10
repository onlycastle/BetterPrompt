/**
 * GrowthLeaderboard Component
 * Ranked table of members sorted by growth (MoM delta), with trend badges
 */

'use client';

import { useState, useMemo } from 'react';
import { ProgressRing } from '../dashboard/ProgressRing';
import type { TeamMemberAnalysis } from '../../types/enterprise';
import styles from './GrowthLeaderboard.module.css';

export interface GrowthLeaderboardProps {
  members: TeamMemberAnalysis[];
}

type SortKey = 'monthOverMonthDelta' | 'weekOverWeekDelta' | 'currentScore';

const TREND_CONFIG = {
  improving: { label: 'Improving', className: 'trendImproving' },
  stable: { label: 'Stable', className: 'trendStable' },
  declining: { label: 'Declining', className: 'trendDeclining' },
} as const;

export function GrowthLeaderboard({ members }: GrowthLeaderboardProps) {
  const [sortKey, setSortKey] = useState<SortKey>('monthOverMonthDelta');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [trendFilter, setTrendFilter] = useState<string>('all');

  const departments = useMemo(
    () => [...new Set(members.map(m => m.department))],
    [members],
  );

  const sorted = useMemo(() => {
    let result = [...members];

    if (teamFilter !== 'all') {
      result = result.filter(m => m.department === teamFilter);
    }
    if (trendFilter !== 'all') {
      result = result.filter(m => m.growth.trend === trendFilter);
    }

    result.sort((a, b) => {
      const av = sortKey === 'currentScore' ? a.growth.currentScore : a.growth[sortKey];
      const bv = sortKey === 'currentScore' ? b.growth.currentScore : b.growth[sortKey];
      return bv - av;
    });

    return result;
  }, [members, sortKey, teamFilter, trendFilter]);

  const handleSort = (key: SortKey) => {
    setSortKey(key);
  };

  const sortIndicator = (key: SortKey) => (sortKey === key ? ' ↓' : '');

  const formatDelta = (value: number) => {
    if (value > 0) return `+${value}`;
    return String(value);
  };

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
        <select
          value={trendFilter}
          onChange={e => setTrendFilter(e.target.value)}
          className={styles.select}
        >
          <option value="all">All Trends</option>
          <option value="improving">Improving</option>
          <option value="stable">Stable</option>
          <option value="declining">Declining</option>
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>#</th>
              <th className={styles.th}>Name</th>
              <th className={styles.th} onClick={() => handleSort('currentScore')}>
                Score{sortIndicator('currentScore')}
              </th>
              <th className={styles.th} onClick={() => handleSort('weekOverWeekDelta')}>
                WoW{sortIndicator('weekOverWeekDelta')}
              </th>
              <th className={styles.th} onClick={() => handleSort('monthOverMonthDelta')}>
                MoM{sortIndicator('monthOverMonthDelta')}
              </th>
              <th className={styles.th}>Trend</th>
              <th className={styles.th}>Top Strength</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((member, idx) => {
              const tc = TREND_CONFIG[member.growth.trend];
              const topStrength = member.strengthSummaries[0];
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
                    <span className={member.growth.weekOverWeekDelta > 0 ? styles.deltaPositive : member.growth.weekOverWeekDelta < 0 ? styles.deltaNegative : styles.deltaNeutral}>
                      {formatDelta(member.growth.weekOverWeekDelta)}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={member.growth.monthOverMonthDelta > 0 ? styles.deltaPositive : member.growth.monthOverMonthDelta < 0 ? styles.deltaNegative : styles.deltaNeutral}>
                      {formatDelta(member.growth.monthOverMonthDelta)}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.trendBadge} ${styles[tc.className]}`}>
                      {tc.label}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.strengthText}>
                      {topStrength?.topStrength ?? '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className={styles.emptyRow}>No members match filters</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
