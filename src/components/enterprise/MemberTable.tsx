/**
 * MemberTable Component
 * Sortable, searchable table of team members with type filter and mini ProgressRing
 */

'use client';

import { useState, useMemo } from 'react';
import { Search, Pencil, Trash2 } from 'lucide-react';
import { ProgressRing } from '../dashboard/ProgressRing';
import { TYPE_METADATA } from '../../types/enterprise';
import type { TeamMemberAnalysis, CodingStyleType } from '../../types/enterprise';
import styles from './MemberTable.module.css';

export interface MemberTableProps {
  members: TeamMemberAnalysis[];
  /** Show department column (for org-wide view) */
  showDepartment?: boolean;
  /** Callback when edit action is clicked */
  onEdit?: (member: TeamMemberAnalysis) => void;
  /** Callback when remove action is clicked */
  onRemove?: (member: TeamMemberAnalysis) => void;
}

type SortKey = 'name' | 'overallScore' | 'primaryType' | 'lastAnalyzedAt';
type SortDir = 'asc' | 'desc';

const ALL_TYPES: CodingStyleType[] = ['architect', 'analyst', 'conductor', 'speedrunner', 'trendsetter'];

export function MemberTable({ members, showDepartment = false, onEdit, onRemove }: MemberTableProps) {
  const hasActions = !!onEdit || !!onRemove;
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<CodingStyleType | 'all'>('all');
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

    // Type filter
    if (typeFilter !== 'all') {
      result = result.filter(m => m.primaryType === typeFilter);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'overallScore': cmp = a.overallScore - b.overallScore; break;
        case 'primaryType': cmp = a.primaryType.localeCompare(b.primaryType); break;
        case 'lastAnalyzedAt': cmp = a.lastAnalyzedAt.localeCompare(b.lastAnalyzedAt); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [members, search, typeFilter, sortKey, sortDir]);

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
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as CodingStyleType | 'all')}
          className={styles.select}
        >
          <option value="all">All Types</option>
          {ALL_TYPES.map(t => (
            <option key={t} value={t}>{TYPE_METADATA[t].emoji} {TYPE_METADATA[t].label}</option>
          ))}
        </select>
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
              <th className={styles.th} onClick={() => handleSort('primaryType')}>
                Type{sortIndicator('primaryType')}
              </th>
              <th className={styles.th} onClick={() => handleSort('overallScore')}>
                Score{sortIndicator('overallScore')}
              </th>
              <th className={styles.th}>Analyses</th>
              {hasActions && <th className={styles.th}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map(member => {
              const meta = TYPE_METADATA[member.primaryType];
              return (
                <tr key={member.id} className={styles.row}>
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
                    <span className={styles.typeBadge} style={{ borderColor: meta.color }}>
                      {meta.emoji} {meta.label}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.scoreCell}>
                      <ProgressRing value={member.overallScore} size={36} strokeWidth={3} showValue={false} />
                      <span className={styles.scoreText}>{member.overallScore}</span>
                    </div>
                  </td>
                  <td className={styles.td}>{member.analysisCount}</td>
                  {hasActions && (
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        {onEdit && (
                          <button className={styles.actionBtn} onClick={() => onEdit(member)} title="Edit">
                            <Pencil size={14} />
                          </button>
                        )}
                        {onRemove && (
                          <button className={`${styles.actionBtn} ${styles.dangerBtn}`} onClick={() => onRemove(member)} title="Remove">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={(showDepartment ? 6 : 5) + (hasActions ? 1 : 0)} className={styles.emptyRow}>
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
