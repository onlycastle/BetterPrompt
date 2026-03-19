'use client';

import { BarChart3, Users, TrendingUp } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import { Button } from '@/components/ui/Button';
import styles from './TeamSection.module.css';

const teamMembers = [
  {
    icon: BarChart3,
    name: 'Team Velocity',
    stats: '142 sessions · 38.4h · 284k tokens this week',
    now: 'No visibility into how engineers use AI - managers guess who is effective based on output alone',
    fix: 'Session-level analytics: token burn rate, anti-pattern frequency, and efficiency scores per developer',
  },
  {
    icon: Users,
    name: 'Growth Tracking',
    stats: '8 members · 5 dimensions · weekly snapshots',
    now: 'AI training is a one-time workshop. No way to measure if developers actually improved over time',
    fix: 'Continuous scoring across Thinking, Communication, Learning, Efficiency, and Outcomes with trend lines',
  },
  {
    icon: TrendingUp,
    name: 'AI Retrospectives',
    stats: 'Auto-generated from real session data',
    now: 'Sprint retros mention AI vaguely - "we should use AI more" - with no data',
    fix: 'Data-driven KPT retrospectives showing what to keep, problems to address, and experiments to try',
  },
];

export function TeamSection() {
  const { ref, isInView } = useInView({ threshold: 0.15 });

  return (
    <section id="for-teams" className={styles.section}>
      <div ref={ref} className={`${styles.content} ${isInView ? styles.visible : ''}`}>
        <span className={styles.sectionLabel}>For Teams</span>
        <h2 className={styles.headline}>
          Your team builds with AI every day.
          <br />
          <em>Do you know how well?</em>
        </h2>

        <div className={styles.grid}>
          {teamMembers.map((member) => (
            <div key={member.name} className={styles.card}>
              <div className={styles.roleHeader}>
                <div className={styles.iconWrapper}>
                  <member.icon size={22} />
                </div>
                <div className={styles.roleName}>{member.name}</div>
              </div>

              <div className={styles.statsBadge}>{member.stats}</div>

              <div className={styles.workflowBlock}>
                <div className={styles.workflowItem}>
                  <span className={`${styles.workflowLabel} ${styles.workflowNow}`}>Now</span>
                  <span className={styles.workflowText}>{member.now}</span>
                </div>
                <div className={styles.workflowItem}>
                  <span className={`${styles.workflowLabel} ${styles.workflowFix}`}>Fix</span>
                  <span className={styles.workflowText}>{member.fix}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.ctaWrapper}>
          <a href="https://github.com/onlycastle/BetterPrompt" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="lg">
              Enterprise Dashboard
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
