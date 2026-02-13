'use client';

import { useEffect } from 'react';
import { track } from '@vercel/analytics';
import { useInView } from '@/hooks/useInView';
import styles from './SocialProofBar.module.css';

const TOOLS = ['Claude Code', 'Cursor', 'Replit', 'Bolt'];

export function SocialProofBar() {
  const { ref, isInView } = useInView({ threshold: 0.15 });

  useEffect(() => {
    if (isInView) {
      track('section_view', { section: 'social-proof' });
    }
  }, [isInView]);

  return (
    <div ref={ref} className={`${styles.bar} ${isInView ? styles.visible : ''}`}>
      <p className={styles.text}>
        Trusted by <strong className={styles.highlight}>2,000+</strong> AI builders
      </p>
      <div className={styles.badges}>
        {TOOLS.map((tool) => (
          <span key={tool} className={styles.badge}>{tool}</span>
        ))}
      </div>
    </div>
  );
}
