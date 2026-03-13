'use client';

import { Shield, Lock, EyeOff } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import styles from './TrustPrivacy.module.css';

const TRUST_ITEMS = [
  {
    icon: Shield,
    label: 'On Your Server',
    text: 'Session data stays on your server - nothing leaves your network',
  },
  {
    icon: Lock,
    label: 'Self-Hosted',
    text: 'Self-hosted means you control access, encryption, and retention',
  },
  {
    icon: EyeOff,
    label: 'No Background',
    text: 'No background processes. Nothing runs until you say so.',
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
          BetterPrompt is open source and self-hosted. Analysis runs on your server with your own Gemini API key. No session data ever leaves your network.
        </p>
      </div>
    </section>
  );
}
