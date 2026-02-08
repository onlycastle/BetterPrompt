'use client';

import { EVIDENCE_QUOTES } from './showcase-data';
import styles from './TasteCards.module.css';

export function TasteCardEvidence() {
  return (
    <div className={styles.card}>
      <span className={styles.label}>EVIDENCE</span>
      <div className={styles.evidenceQuotes}>
        {EVIDENCE_QUOTES.map((q, i) => (
          <blockquote key={i} className={styles.quote}>
            <p className={styles.quoteText}>{q.text}</p>
            <cite className={styles.quoteMeta}>
              {q.session} &middot; {q.turn}
            </cite>
          </blockquote>
        ))}
      </div>
    </div>
  );
}
