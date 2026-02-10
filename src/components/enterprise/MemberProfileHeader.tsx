/**
 * MemberProfileHeader Component
 * Enterprise dashboard member profile header with identity, type badge,
 * score ring, growth deltas, and trend indicator.
 */

'use client';

import { ProgressRing } from '../dashboard/ProgressRing';
import { TYPE_METADATA } from '../../types/enterprise';
import { CONTROL_LEVEL_METADATA } from '../../lib/models/coding-style';
import type { TeamMemberAnalysis } from '../../types/enterprise';
import styles from './MemberProfileHeader.module.css';

export interface MemberProfileHeaderProps {
  member: TeamMemberAnalysis;
}

const TREND_CONFIG = {
  improving: { label: 'Improving', className: 'trendImproving' },
  stable: { label: 'Stable', className: 'trendStable' },
  declining: { label: 'Declining', className: 'trendDeclining' },
} as const;

function formatDelta(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function getDeltaClassName(value: number): string {
  if (value > 0) return styles.deltaPositive;
  if (value < 0) return styles.deltaNegative;
  return styles.deltaNeutral;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function MemberProfileHeader({ member }: MemberProfileHeaderProps) {
  const typeMeta = TYPE_METADATA[member.primaryType];
  const controlMeta = CONTROL_LEVEL_METADATA[member.controlLevel];
  const trendConfig = TREND_CONFIG[member.growth.trend];

  return (
    <div className={styles.container}>
      <div className={styles.left}>
        <div className={styles.identity}>
          <div className={styles.avatar} aria-hidden="true">
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div className={styles.nameBlock}>
            <h2 className={styles.name}>{member.name}</h2>
            {member.email && (
              <span className={styles.email}>{member.email}</span>
            )}
            <span className={styles.roleText}>
              {member.role} &middot; {member.department}
            </span>
          </div>
        </div>

        <div className={styles.badges}>
          <span
            className={styles.typeBadge}
            style={{ borderColor: typeMeta.color, color: typeMeta.color }}
          >
            <span aria-hidden="true">{typeMeta.emoji}</span>
            {typeMeta.label}
          </span>
          <span className={styles.badgeSeparator}>|</span>
          <span className={styles.controlLabel}>{controlMeta.name}</span>
        </div>

        <span className={styles.meta}>
          Last analyzed: {formatDate(member.lastAnalyzedAt)}
        </span>
      </div>

      <div className={styles.right}>
        <ProgressRing
          value={member.overallScore}
          size={64}
          strokeWidth={5}
        />

        <div className={styles.deltaRow}>
          <span className={styles.deltaLabel}>WoW</span>
          <span className={getDeltaClassName(member.growth.weekOverWeekDelta)}>
            {formatDelta(member.growth.weekOverWeekDelta)}
          </span>
          <span className={styles.deltaLabel}>MoM</span>
          <span className={getDeltaClassName(member.growth.monthOverMonthDelta)}>
            {formatDelta(member.growth.monthOverMonthDelta)}
          </span>
        </div>

        <span className={`${styles.trendBadge} ${styles[trendConfig.className]}`}>
          {trendConfig.label}
        </span>
      </div>
    </div>
  );
}
