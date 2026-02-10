/**
 * MemberTable Component
 * Sortable, searchable table of team members with token usage trends and mini ProgressRing
 */

'use client';

import { useState, useMemo } from 'react';
import { Search, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { ProgressRing } from '../dashboard/ProgressRing';
import { formatTokens, getTokenDelta, getDeltaIndicator } from './format-utils';
import type { TeamMemberAnalysis } from '../../types/enterprise';
import styles from './MemberTable.module.css';

const TREND_CONFIG = {
  improving: { label: 'Improving', arrow: '\u2191', className: 'trendImproving' },
  stable: { label: 'Stable', arrow: '\u2192', className: 'trendStable' },
  declining: { label: 'Declining', arrow: '\u2193', className: 'trendDeclining' },
} as const;

export interface MemberTableProps {
  members: TeamMemberAnalysis[];
  /** Show department column (for org-wide view) */
  showDepartment?: boolean;
  /** Callback when a row is clicked (enables clickable rows) */
  onRowClick?: (member: TeamMemberAnalysis) => void;
  /** Callback when edit action is clicked */
  onEdit?: (member: TeamMemberAnalysis) => void;
  /** Callback when remove action is clicked */
  onRemove?: (member: TeamMemberAnalysis) => void;
}

type SortKey = 'name' | 'overallScore' | 'tokenUsage' | 'lastAnalyzedAt';
type SortDir = 'asc' | 'desc';

export function MemberTable({ members, showDepartment = false, onRowClick, onEdit, onRemove }: MemberTableProps) {
  const hasActions = !!onEdit || !!onRemove;
  const isClickable = !!onRowClick;
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('overallScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const filtered = useMemo(() => {
    let result = [...members];

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'overallScore': cmp = a.overallScore - b.overallScore; break;
        case 'tokenUsage': {
          const aTokens = getTokenDelta(a.tokenUsage.weeklyTokenTrend).current;
          const bTokens = getTokenDelta(b.tokenUsage.weeklyTokenTrend).current;
          cmp = aTokens - bTokens;
          break;
        }
        case 'lastAnalyzedAt': cmp = a.lastAnalyzedAt.localeCompare(b.lastAnalyzedAt); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [members, search, sortKey, sortDir]);

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th} onClick={() => handleSort('name')}>
                Name{sortIndicator('name')}
              </th>
              {showDepartment && <th className={styles.th}>Team</th>}
              <th className={styles.th}>Role</th>
              <th className={styles.th} onClick={() => handleSort('tokenUsage')}>
                Token Usage{sortIndicator('tokenUsage')}
              </th>
              <th className={styles.th} onClick={() => handleSort('overallScore')}>
                Score{sortIndicator('overallScore')}
              </th>
              <th className={styles.th}>Growth</th>
              <th className={styles.th}>Sessions</th>
              <th className={styles.th}>Issues</th>
              {hasActions && <th className={styles.th}>Actions</th>}
              {isClickable && <th className={styles.th} aria-label="Navigate" />}
            </tr>
          </thead>
          <tbody>
            {filtered.map(member => {
              const tc = TREND_CONFIG[member.growth.trend];
              const issueCount = member.antiPatterns.length;
              const highImpact = member.antiPatterns.some(ap => ap.impact === 'high');
              const tokenDelta = getTokenDelta(member.tokenUsage.weeklyTokenTrend);
              const deltaStyles = { positive: styles.tokenDeltaUp, negative: styles.tokenDeltaDown, neutral: styles.tokenDeltaNeutral };
              const wowDisplay = getDeltaIndicator(tokenDelta.wow, deltaStyles);
              const momDisplay = getDeltaIndicator(tokenDelta.mom, deltaStyles);
              return (
                <tr
                  key={member.id}
                  className={`${styles.row} ${isClickable ? styles.clickableRow : ''}`}
                  onClick={isClickable ? () => onRowClick(member) : undefined}
                >
                  <td className={styles.td}>
                    <div className={styles.nameCell}>
                      <div className={styles.avatar}>
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <div className={styles.memberName}>{member.name}</div>
                        {member.email && (
                          <div className={styles.memberEmail}>{member.email}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  {showDepartment && <td className={styles.td}>{member.department}</td>}
                  <td className={styles.td}>{member.role}</td>
                  <td className={styles.td}>
                    <div className={styles.tokenCell}>
                      <span className={styles.tokenValue}>{formatTokens(tokenDelta.current)}</span>
                      <span className={styles.tokenDeltas}>
                        {wowDisplay && (
                          <span className={wowDisplay.className}>{wowDisplay.arrow}{Math.abs(tokenDelta.wow!)}% w</span>
                        )}
                        {wowDisplay && momDisplay && (
                          <span className={styles.tokenDeltaSep}>&middot;</span>
                        )}
                        {momDisplay && (
                          <span className={momDisplay.className}>{momDisplay.arrow}{Math.abs(tokenDelta.mom!)}% m</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.scoreCell}>
                      <ProgressRing value={member.overallScore} size={36} strokeWidth={3} showValue={false} />
                      <span className={styles.scoreText}>{member.overallScore}</span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <span className={`${styles.trendBadge} ${styles[tc.className]}`}>
                      {tc.arrow} {tc.label}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.sessionCount}>{member.tokenUsage.totalSessions}</span>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.issueCell}>
                      {issueCount > 0 && (
                        <span className={`${styles.issueDot} ${highImpact ? styles.issueDotHigh : styles.issueDotMedium}`} />
                      )}
                      <span className={styles.issueCount}>{issueCount}</span>
                    </div>
                  </td>
                  {hasActions && (
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        {onEdit && (
                          <button className={styles.actionBtn} onClick={e => { e.stopPropagation(); onEdit(member); }} title="Edit">
                            <Pencil size={14} />
                          </button>
                        )}
                        {onRemove && (
                          <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={e => { e.stopPropagation(); onRemove(member); }} title="Remove">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  {isClickable && (
                    <td className={styles.td}>
                      <ChevronRight size={16} className={styles.rowArrow} />
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={(showDepartment ? 8 : 7) + (hasActions ? 1 : 0) + (isClickable ? 1 : 0)} className={styles.emptyRow}>
                  No members found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
