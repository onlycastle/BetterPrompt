'use client';

import { useInView } from '@/hooks/useInView';
import { TerminalCommand } from './TerminalCommand';
import { TasteCardEvidence } from './showcase/TasteCardEvidence';
import { TasteCardPercentile } from './showcase/TasteCardPercentile';
import { TasteCardFocusArea } from './showcase/TasteCardFocusArea';
import { TasteCardActivity } from './showcase/TasteCardActivity';
import styles from './AnalysisShowcase.module.css';

const CARDS = [TasteCardEvidence, TasteCardPercentile, TasteCardFocusArea, TasteCardActivity];

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
              style={{ transitionDelay: `${i * 100}ms` }}
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
