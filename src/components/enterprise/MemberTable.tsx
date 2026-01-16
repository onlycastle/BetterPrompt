/**
 * MemberTable Component
 * Sortable table displaying team member analysis data
 */

import { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { TeamMemberAnalysis } from '../../types/enterprise';
import { TYPE_METADATA } from '../../types/enterprise';
import { Badge } from '../ui/Badge';
import styles from './MemberTable.module.css';

export interface MemberTableProps {
  members: TeamMemberAnalysis[];
}

type SortField = 'name' | 'type' | 'score' | 'lastAnalyzed';
type SortDirection = 'asc' | 'desc';

export function MemberTable({ members }: MemberTableProps) {
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if clicking same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to descending for score, ascending for others
      setSortField(field);
      setSortDirection(field === 'score' ? 'desc' : 'asc');
    }
  };

  // Sort members
  const sortedMembers = useMemo(() => {
    const sorted = [...members];

    sorted.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'type':
          comparison = a.primaryType.localeCompare(b.primaryType);
          break;
        case 'score':
          comparison = a.overallScore - b.overallScore;
          break;
        case 'lastAnalyzed':
          comparison =
            new Date(a.lastAnalyzedAt).getTime() - new Date(b.lastAnalyzedAt).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [members, sortField, sortDirection]);

  // Calculate trend from history
  const getTrend = (member: TeamMemberAnalysis): 'up' | 'down' | 'flat' => {
    if (member.history.length < 2) return 'flat';
    const latest = member.history[member.history.length - 1].overallScore;
    const previous = member.history[member.history.length - 2].overallScore;
    if (latest > previous) return 'up';
    if (latest < previous) return 'down';
    return 'flat';
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className={styles.sortIcon} />
    ) : (
      <ArrowDown size={14} className={styles.sortIcon} />
    );
  };

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.headerCell} onClick={() => handleSort('name')}>
              <span className={styles.headerContent}>
                Developer
                <SortIcon field="name" />
              </span>
            </th>
            <th className={styles.headerCell} onClick={() => handleSort('type')}>
              <span className={styles.headerContent}>
                Type
                <SortIcon field="type" />
              </span>
            </th>
            <th className={styles.headerCell} onClick={() => handleSort('score')}>
              <span className={styles.headerContent}>
                Score
                <SortIcon field="score" />
              </span>
            </th>
            <th className={styles.headerCell}>Trend</th>
            <th className={styles.headerCell} onClick={() => handleSort('lastAnalyzed')}>
              <span className={styles.headerContent}>
                Last Analyzed
                <SortIcon field="lastAnalyzed" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedMembers.map(member => {
            const typeMetadata = TYPE_METADATA[member.primaryType];
            const trend = getTrend(member);

            return (
              <tr key={member.id} className={styles.row}>
                <td className={styles.cell}>
                  <div className={styles.memberInfo}>
                    <div className={styles.avatar}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className={styles.memberName}>{member.name}</div>
                      <div className={styles.memberRole}>
                        {member.role} • {member.department}
                      </div>
                    </div>
                  </div>
                </td>
                <td className={styles.cell}>
                  <Badge variant="default" size="sm">
                    <span style={{ color: typeMetadata.color }}>
                      {typeMetadata.emoji} {typeMetadata.label}
                    </span>
                  </Badge>
                </td>
                <td className={styles.cell}>
                  <div className={styles.scoreCell}>
                    <div className={styles.scoreBar}>
                      <div
                        className={styles.scoreBarFill}
                        style={{
                          width: `${member.overallScore}%`,
                          backgroundColor: typeMetadata.color,
                        }}
                      />
                    </div>
                    <span className={styles.scoreValue}>{member.overallScore}%</span>
                  </div>
                </td>
                <td className={styles.cell}>
                  <div className={styles.trendCell}>
                    {trend === 'up' && (
                      <ArrowUp size={16} className={styles.trendUp} />
                    )}
                    {trend === 'down' && (
                      <ArrowDown size={16} className={styles.trendDown} />
                    )}
                    {trend === 'flat' && (
                      <span className={styles.trendFlat}>—</span>
                    )}
                  </div>
                </td>
                <td className={styles.cell}>
                  <span className={styles.dateText}>
                    {formatDate(member.lastAnalyzedAt)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
