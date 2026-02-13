'use client';

import { useRouter } from 'next/navigation';
import { useInView } from '@/hooks/useInView';
import { Button } from '@/components/ui/Button';
import { track } from '@vercel/analytics';
import { ShowcaseAntiPattern } from './showcase/ShowcaseAntiPattern';
import { ShowcaseWeekly } from './showcase/ShowcaseWeekly';
import { ShowcaseStrength } from './showcase/ShowcaseStrength';
import styles from './AnalysisShowcase.module.css';

const CARDS = [ShowcaseAntiPattern, ShowcaseWeekly, ShowcaseStrength];

export function AnalysisShowcase() {
  const router = useRouter();
  const { ref, isInView } = useInView({ threshold: 0.1 });

  const handleCtaClick = () => {
    track('cta_click', { location: 'showcase', type: 'get_started_free' });
    router.push('/dashboard/analyze');
  };

  return (
    <section id="preview" className={styles.section}>
      <div ref={ref} className={styles.wrapper}>
        <div className={styles.header}>
          <h2 className={styles.headline}>Here&apos;s what we actually analyze</h2>
          <p className={styles.subheadline}>Real insights. Not a personality quiz.</p>
        </div>

        <div className={styles.grid}>
          {CARDS.map((Card, i) => (
            <div
              key={i}
              className={`${styles.cardSlot} ${isInView ? styles.cardVisible : ''}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              <Card />
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <p className={styles.disclaimer}>
            Sample data shown. Get your personalized report.
          </p>
          <div className={styles.cta}>
            <Button variant="primary" size="lg" onClick={handleCtaClick}>
              Get Started Free
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
