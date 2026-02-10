'use client';

import { useInView } from '@/hooks/useInView';
import { TerminalCommand } from './TerminalCommand';
import { ShowcaseAntiPattern } from './showcase/ShowcaseAntiPattern';
import { ShowcaseWeekly } from './showcase/ShowcaseWeekly';
import { ShowcaseStrength } from './showcase/ShowcaseStrength';
import styles from './AnalysisShowcase.module.css';

const CARDS = [ShowcaseAntiPattern, ShowcaseWeekly, ShowcaseStrength];

export function AnalysisShowcase() {
  const { ref, isInView } = useInView({ threshold: 0.1 });

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
            Sample data. Run CLI to see yours.
          </p>
          <div className={styles.cta}>
            <TerminalCommand command="npx no-ai-slop" location="download" />
          </div>
        </div>
      </div>
    </section>
  );
}
