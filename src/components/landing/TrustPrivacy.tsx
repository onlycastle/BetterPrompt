'use client';

import { Shield, Lock, EyeOff } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import styles from './TrustPrivacy.module.css';

const TRUST_ITEMS = [
  {
    icon: Shield,
    label: 'On Your Machine',
    text: 'Session data stays local during analysis and does not leave your machine by default',
  },
  {
    icon: Lock,
    label: 'Plugin-First',
    text: 'Claude Code runs the analysis locally with the model session you already have open',
  },
  {
    icon: EyeOff,
    label: 'Queued, Not Detached',
    text: 'Auto-analysis is queued into the next Claude Code session instead of spawning hidden background jobs',
  },
] as const;

export function TrustPrivacy() {
  const { ref, isInView } = useInView({ threshold: 0.15 });

  return (
    <section id="trust" className={styles.section}>
      <div ref={ref} className={`${styles.content} ${isInView ? styles.visible : ''}`}>
        <span className={styles.sectionLabel}>Privacy</span>
        <h2 className={styles.headline}>Your data stays yours</h2>

        <div className={styles.grid}>
          {TRUST_ITEMS.map((item) => (
            <div key={item.label} className={styles.item}>
              <div className={styles.iconWrapper}>
                <item.icon size={20} />
              </div>
              <div className={styles.itemContent}>
                <span className={styles.itemLabel}>{item.label}</span>
                <p className={styles.text}>{item.text}</p>
              </div>
            </div>
          ))}
        </div>

        <p className={styles.clarification}>
          BetterPrompt is open source and local-first. Analysis runs inside Claude Code, and team sync is optional if you want dashboard storage.
        </p>
      </div>
    </section>
  );
}
