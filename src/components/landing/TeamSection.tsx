'use client';

import { ClipboardList, Palette, Megaphone } from 'lucide-react';
import { track } from '@vercel/analytics';
import { useInView } from '@/hooks/useInView';
import { Button } from '@/components/ui/Button';
import styles from './TeamSection.module.css';

const teamMembers = [
  {
    icon: ClipboardList,
    name: 'Sarah',
    title: 'Product Manager',
    stats: '52 messages · 38 min · 12k tokens',
    now: 'Kept saying "add a login page" — AI built 6 different versions, none matched the actual user flow',
    fix: 'One prompt with auth requirements: OAuth provider, session length, redirect rules',
  },
  {
    icon: Palette,
    name: 'James',
    title: 'Designer',
    stats: '34 messages · 25 min · 8k tokens',
    now: '"Make the hero section pop" — regenerated the same generic gradient layout 9 times',
    fix: 'Reference image + specific constraints: "dark bg, 64px heading, 16px body, #3B82F6 accent"',
  },
  {
    icon: Megaphone,
    name: 'Maria',
    title: 'Marketing Lead',
    stats: '41 messages · 30 min · 15k tokens',
    now: 'Asked for launch email copy — got generic "We\'re excited to announce" every time, off-brand',
    fix: 'Pasted brand voice guide + past examples in first message. On-brand draft in one shot',
  },
];

export function TeamSection() {
  const { ref, isInView } = useInView({ threshold: 0.15 });

  const handleCtaClick = () => {
    track('cta_click', { location: 'team', type: 'read_team_setup' });
    window.location.href = '/docs';
  };

  return (
    <section id="for-teams" className={styles.section}>
      <div ref={ref} className={`${styles.content} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>
          Your team builds with AI every day.
          <br />
          Run one self-hosted server and review where they get stuck.
        </h2>

        <div className={styles.grid}>
          {teamMembers.map((member) => (
            <div key={member.name} className={styles.card}>
              <div className={styles.roleHeader}>
                <div className={styles.iconWrapper}>
                  <member.icon size={22} />
                </div>
                <div>
                  <div className={styles.roleName}>{member.name}</div>
                  <div className={styles.roleTitle}>{member.title}</div>
                </div>
              </div>

              <div className={styles.statsBadge}>{member.stats}</div>

              <div className={styles.workflowBlock}>
                <div className={styles.workflowItem}>
                  <span className={`${styles.workflowLabel} ${styles.workflowNow}`}>Now→</span>
                  <span className={styles.workflowText}>{member.now}</span>
                </div>
                <div className={styles.workflowItem}>
                  <span className={`${styles.workflowLabel} ${styles.workflowFix}`}>Fix→</span>
                  <span className={styles.workflowText}>{member.fix}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.ctaWrapper}>
          <Button variant="secondary" size="lg" onClick={handleCtaClick}>
            Read Team Setup →
          </Button>
        </div>
      </div>
    </section>
  );
}
