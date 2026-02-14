'use client';

/**
 * EnterprisePreview (TeamSection) - Self-contained static preview of the
 * Team Dashboard for the landing page. No imports from enterprise/ to keep
 * bundle isolated. All data is pre-formatted strings.
 */

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { WaitlistModal, waitlistConfigs } from './WaitlistModal';
import styles from './EnterprisePreview.module.css';

/* -- Inline MiniScoreRing (lightweight ProgressRing clone, 28x28) -- */

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

/* -- Demo data (all pre-formatted strings) -- */

type Direction = 'up' | 'down' | 'neutral';

interface StatItem {
  label: string;
  value: string;
  change: { text: string; direction: Direction } | null;
}

const STATS: StatItem[] = [
  { label: 'Active Members', value: '8', change: null },
  { label: 'Sessions This Week', value: '142', change: { text: '18%', direction: 'up' } },
  { label: 'Avg AI Control', value: '64%', change: null },
  { label: 'Risk Items', value: '23', change: { text: 'detected', direction: 'neutral' } },
];

const directionStyles: Record<Direction, string> = {
  up: styles.changeUp,
  down: styles.changeDown,
  neutral: styles.changeNeutral,
};

const directionArrows: Record<Direction, string> = {
  up: '\u2191',
  down: '\u2193',
  neutral: '',
};

interface MemberItem {
  name: string;
  role: string;
  score: number;
  color: string;
  summaries: string[];
}

const MEMBERS: MemberItem[] = [
  {
    name: 'Sarah Park',
    role: 'Product Manager',
    score: 72,
    color: 'var(--sketch-green)',
    summaries: ['Built checkout flow with Cursor', 'User dashboard prototyping', 'Payment integration'],
  },
  {
    name: 'James Lee',
    role: 'Designer',
    score: 58,
    color: 'var(--sketch-yellow)',
    summaries: ['Created component library', 'Landing page redesign', 'Design system tokens'],
  },
  {
    name: 'Maria Chen',
    role: 'Marketing Lead',
    score: 81,
    color: 'var(--sketch-green)',
    summaries: ['Analytics dashboard build', 'A/B test framework', 'Email template system'],
  },
  {
    name: 'Tom Wilson',
    role: 'Operations',
    score: 45,
    color: 'var(--sketch-yellow)',
    summaries: ['Internal tools automation', 'Report generator', 'Inventory tracker'],
  },
];

/* -- Component -- */

export function EnterprisePreview() {
  const { ref, isInView } = useInView({ threshold: 0.1 });
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <section id="teams" className={styles.section}>
      <div ref={ref} className={`${styles.content} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>See how your team uses AI</h2>
        <p className={styles.subline}>
          Same analysis, team-wide visibility. Know who&apos;s building securely and who needs support.
        </p>

        {/* Dashboard preview card */}
        <div className={styles.dashboardCard}>
          {/* Header bar */}
          <div className={styles.dashboardHeader}>
            <Building2 size={16} />
            <span className={styles.dashboardTitle}>Manager Dashboard</span>
            <span className={styles.enterpriseBadge}>Team Plan</span>
          </div>

          {/* Stat cards */}
          <div className={styles.statGrid}>
            {STATS.map((stat) => (
              <div key={stat.label} className={styles.statCard}>
                <div className={styles.statLabel}>{stat.label}</div>
                <div className={styles.statValue}>{stat.value}</div>
                {stat.change && (
                  <span className={`${styles.statChange} ${directionStyles[stat.change.direction]}`}>
                    {directionArrows[stat.change.direction]}
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
                  <th className={styles.th}>AI Control</th>
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
            Start a team trial
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
