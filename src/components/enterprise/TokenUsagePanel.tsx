/**
 * TokenUsagePanel Component
 * 2-column layout: org-wide token trend chart + member context fill table
 */

'use client';

import { useMemo } from 'react';
import { TrendLineChart } from './TrendLineChart';
import { Card, CardHeader, CardContent } from '../ui/Card';
import type { TeamMemberAnalysis, HistoryEntry } from '../../types/enterprise';
import styles from './TokenUsagePanel.module.css';

export interface TokenUsagePanelProps {
  members: TeamMemberAnalysis[];
}

export function TokenUsagePanel({ members }: TokenUsagePanelProps) {
  // Aggregate weekly token trend across all members → map to HistoryEntry shape for TrendLineChart
  const orgTokenTrend = useMemo<HistoryEntry[]>(() => {
    if (members.length === 0) return [];

    const weekMap = new Map<string, number>();
    for (const m of members) {
      for (const w of m.tokenUsage.weeklyTokenTrend) {
        weekMap.set(w.weekStart, (weekMap.get(w.weekStart) ?? 0) + w.totalTokens);
      }
    }

    const entries = [...weekMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, tokens]) => ({
        date,
        overallScore: Math.round(tokens / 1000), // Display in K tokens
      }));

    return entries;
  }, [members]);

  // Members sorted by avgContextFillPercent descending
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => b.tokenUsage.avgContextFillPercent - a.tokenUsage.avgContextFillPercent),
    [members],
  );

  return (
    <div className={styles.container}>
      <Card className={styles.chartCard}>
        <CardHeader>
          <h3 className={styles.cardTitle}>Weekly Token Consumption (K)</h3>
        </CardHeader>
        <CardContent>
          <TrendLineChart data={orgTokenTrend} height={220} />
        </CardContent>
      </Card>

      <Card className={styles.tableCard}>
        <CardHeader>
          <h3 className={styles.cardTitle}>Context Fill by Member</h3>
        </CardHeader>
        <CardContent>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Name</th>
                  <th className={styles.th}>Avg Fill</th>
                  <th className={styles.th}>90%+</th>
                  <th className={styles.th}>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map(member => {
                  const fill = member.tokenUsage.avgContextFillPercent;
                  const isHigh = fill >= 80;
                  return (
                    <tr key={member.id} className={styles.row}>
                      <td className={styles.td}>
                        <span className={styles.memberName}>{member.name}</span>
                      </td>
                      <td className={styles.td}>
                        <span className={isHigh ? styles.fillHigh : styles.fillNormal}>
                          {fill}%
                        </span>
                      </td>
                      <td className={styles.td}>
                        <span className={member.tokenUsage.contextFillExceeded90Count > 0 ? styles.countWarn : styles.countNormal}>
                          {member.tokenUsage.contextFillExceeded90Count}
                        </span>
                      </td>
                      <td className={styles.td}>{member.tokenUsage.totalSessions}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
