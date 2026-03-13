'use client';

import { useInView } from '@/hooks/useInView';
import styles from './SocialProofBar.module.css';

const TOOLS = ['Claude Code', 'Cursor'];

export function SocialProofBar() {
  const { ref, isInView } = useInView({ threshold: 0.15 });

  return (
    <div ref={ref} className={`${styles.bar} ${isInView ? styles.visible : ''}`}>
      <p className={styles.text}>
        Analyzes sessions from
      </p>
      <div className={styles.badges}>
        {TOOLS.map((tool) => (
          <span key={tool} className={styles.badge}>{tool}</span>
        ))}
      </div>
    </div>
  );
}
