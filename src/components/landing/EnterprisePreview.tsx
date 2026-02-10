'use client';

/**
 * EnterprisePreview - Self-contained static preview of the Manager Dashboard
 * for the landing page. No imports from enterprise/ to keep bundle isolated.
 * All data is pre-formatted strings — no format-utils dependency.
 */

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { WaitlistModal, waitlistConfigs } from './WaitlistModal';
import styles from './EnterprisePreview.module.css';

/* ── Inline MiniScoreRing (lightweight ProgressRing clone, 28x28) ── */

function MiniScoreRing({ value, color }: { value: number; color: string }) {
  const size = 28;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border-default)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/* ── Demo data (all pre-formatted strings) ── */

type Direction = 'up' | 'down' | 'neutral';

interface StatItem {
  label: string;
  value: string;
  change: { text: string; direction: Direction } | null;
}

const STATS: StatItem[] = [
  { label: 'Active Members', value: '12', change: null },
  { label: 'Sessions This Week', value: '236', change: { text: '25%', direction: 'down' } },
  { label: 'Avg Context Fill', value: '63%', change: null },
  { label: 'Anti-Patterns', value: '98', change: { text: 'detected', direction: 'neutral' } },
];

interface MemberItem {
  name: string;
  role: string;
  score: number;
  color: string;
  tokens: string;
  tokenDelta: { text: string; direction: Direction };
  summaries: string[];
}

const MEMBERS: MemberItem[] = [
  {
    name: 'Sarah Chen',
    role: 'Senior Engineer',
    score: 87,
    color: 'var(--sketch-green)',
    tokens: '142K',
    tokenDelta: { text: '+12%', direction: 'up' },
    summaries: ['Migrated auth to OAuth2', 'Refactored API middleware', 'Added rate limiting'],
  },
  {
    name: 'Marcus Kim',
    role: 'Staff Engineer',
    score: 82,
    color: 'var(--sketch-green)',
    tokens: '98K',
    tokenDelta: { text: '+5%', direction: 'up' },
    summaries: ['Database query optimization', 'Created caching layer'],
  },
  {
    name: 'Elena Petrov',
    role: 'Mid-level Engineer',
    score: 74,
    color: 'var(--sketch-yellow)',
    tokens: '210K',
    tokenDelta: { text: '-8%', direction: 'down' },
    summaries: ['Built dashboard components', 'Fixed SSR hydration bugs', 'Updated test suite'],
  },
  {
    name: 'Jake Miller',
    role: 'Junior Engineer',
    score: 61,
    color: 'var(--sketch-yellow)',
    tokens: '315K',
    tokenDelta: { text: '+32%', direction: 'up' },
    summaries: ['Implemented form validation', 'Styled onboarding flow'],
  },
  {
    name: 'Yuki Tanaka',
    role: 'DevOps Engineer',
    score: 79,
    color: 'var(--sketch-green)',
    tokens: '67K',
    tokenDelta: { text: '-3%', direction: 'down' },
    summaries: ['CI/CD pipeline rework', 'Docker image optimization', 'Monitoring alerts setup'],
  },
];

/* ── Component ── */

export function EnterprisePreview() {
  const { ref, isInView } = useInView({ threshold: 0.1 });
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section id="enterprise" className={styles.section}>
      <div ref={ref} className={`${styles.content} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>See how your team uses AI</h2>
        <p className={styles.subline}>
          Track capability growth, spot anti-patterns, and guide your team's AI adoption
        </p>

        {/* Dashboard preview card */}
        <div className={styles.dashboardCard}>
          {/* Header bar */}
          <div className={styles.dashboardHeader}>
            <Building2 size={16} />
            <span className={styles.dashboardTitle}>Manager Dashboard</span>
            <span className={styles.enterpriseBadge}>Enterprise</span>
          </div>

          {/* Stat cards */}
          <div className={styles.statGrid}>
            {STATS.map((stat) => (
              <div key={stat.label} className={styles.statCard}>
                <div className={styles.statLabel}>{stat.label}</div>
                <div className={styles.statValue}>{stat.value}</div>
                {stat.change && (
                  <span className={`${styles.statChange} ${
                    stat.change.direction === 'up' ? styles.changeUp
                      : stat.change.direction === 'down' ? styles.changeDown
                      : styles.changeNeutral
                  }`}>
                    {stat.change.direction === 'up' && '\u2191'}
                    {stat.change.direction === 'down' && '\u2193'}
                    {' '}{stat.change.text}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Leaderboard table */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>#</th>
                  <th className={styles.th}>Name</th>
                  <th className={styles.th}>Score</th>
                  <th className={styles.th}>Tokens</th>
                  <th className={styles.th}>This Week</th>
                </tr>
              </thead>
              <tbody>
                {MEMBERS.map((member, idx) => (
                  <tr key={member.name}>
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
                        <MiniScoreRing value={member.score} color={member.color} />
                        <span className={styles.scoreText}>{member.score}</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.tokenCell}>
                        <span className={styles.tokenMain}>{member.tokens}</span>
                        <span className={`${styles.tokenDelta} ${
                          member.tokenDelta.direction === 'up' ? styles.changeUp
                            : member.tokenDelta.direction === 'down' ? styles.changeDown
                            : styles.changeNeutral
                        }`}>
                          {member.tokenDelta.text}
                        </span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <ul className={styles.summaryList}>
                        {member.summaries.map((line) => (
                          <li key={line} className={styles.summaryItem}>{line}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Gradient fade at bottom */}
          <div className={styles.fadeOverlay} />
        </div>

        {/* CTA */}
        <div className={styles.cta}>
          <button className={styles.ctaButton} onClick={() => setIsModalOpen(true)}>
            Learn more about Enterprise
          </button>
        </div>
      </div>

      <WaitlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        config={waitlistConfigs.enterprise_contact}
      />
    </section>
  );
}
