'use client';

import { useEffect } from 'react';
import { Shield, Lock, EyeOff } from 'lucide-react';
import { track } from '@vercel/analytics';
import { useInView } from '@/hooks/useInView';
import styles from './TrustPrivacy.module.css';

const TRUST_ITEMS = [
  {
    icon: Shield,
    text: 'You choose which sessions to analyze on your own server',
  },
  {
    icon: Lock,
    text: 'Auth and report history stay in local SQLite, not a hosted database',
  },
  {
    icon: EyeOff,
    text: 'No background processes. Nothing runs until you say so.',
  },
] as const;

export function TrustPrivacy() {
  const { ref, isInView } = useInView({ threshold: 0.15 });

  useEffect(() => {
    if (isInView) {
      track('section_view', { section: 'trust' });
    }
  }, [isInView]);

  return (
    <section id="trust" className={styles.section}>
      <div ref={ref} className={`${styles.content} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>Your data stays yours</h2>

        <div className={styles.grid}>
          {TRUST_ITEMS.map((item) => (
            <div key={item.text} className={styles.item}>
              <div className={styles.iconWrapper}>
                <item.icon size={20} />
              </div>
              <p className={styles.text}>{item.text}</p>
            </div>
          ))}
        </div>

        <p className={styles.clarification}>
          The CLI reads session data locally, sends it to your self-hosted Next.js server for Gemini analysis, and stores the result under your control.
        </p>
      </div>
    </section>
  );
}
