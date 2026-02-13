'use client';

import { useEffect } from 'react';
import { track } from '@vercel/analytics';
import { useInView } from '@/hooks/useInView';
import styles from './ProblemValidation.module.css';

const PAIN_CARDS = [
  {
    trigger: 'It was working fine... then everything broke',
    explanation:
      'AI tools are great at building features. But every fix introduces new bugs. You\u2019re stuck in an endless loop.',
  },
  {
    trigger: 'I shipped it. But is it actually secure?',
    explanation:
      '2,000+ vulnerabilities found in vibe-coded apps. API keys exposed. No authentication. No rate limiting. If you\u2019re not checking, nobody is.',
  },
  {
    trigger: 'I don\u2019t know what I don\u2019t know',
    explanation:
      'Your app looks fine on the surface. But you can\u2019t review what you can\u2019t understand. That\u2019s not a skill gap \u2014 it\u2019s a feedback gap.',
  },
] as const;

export function ProblemValidation() {
  const { ref, isInView } = useInView({ threshold: 0.15 });

  useEffect(() => {
    if (isInView) {
      track('section_view', { section: 'problems' });
    }
  }, [isInView]);

  return (
    <section id="problems" className={styles.section}>
      <div ref={ref} className={`${styles.content} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>Sound familiar?</h2>

        <div className={styles.grid}>
          {PAIN_CARDS.map((card) => (
            <div key={card.trigger} className={styles.card}>
              <p className={styles.trigger}>&ldquo;{card.trigger}&rdquo;</p>
              <p className={styles.explanation}>{card.explanation}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
