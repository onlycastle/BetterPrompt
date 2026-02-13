'use client';

import { useEffect } from 'react';
import { Shield, Lock, EyeOff } from 'lucide-react';
import { track } from '@vercel/analytics';
import { useInView } from '@/hooks/useInView';
import styles from './TrustPrivacy.module.css';

const TRUST_ITEMS = [
  {
    icon: Shield,
    text: 'Session summaries are analyzed \u2014 never your source code',
  },
  {
    icon: Lock,
    text: 'Data encrypted in transit, deleted after analysis',
  },
  {
    icon: EyeOff,
    text: 'No agents, no background processes, no tracking',
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
        <h2 className={styles.headline}>Your code stays yours</h2>

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
      </div>
    </section>
  );
}
