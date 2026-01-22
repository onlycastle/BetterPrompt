'use client';

import styles from './PhilosophySection.module.css';

export function PhilosophySection() {
  return (
    <section className={styles.section}>
      <div className={styles.content}>
        <blockquote className={styles.oneliner}>
          <span className={styles.onelinerLine1}>AI is a multiplier.</span>
          <span className={styles.onelinerLine2}>But only if you&apos;re still thinking.</span>
        </blockquote>

        <div className={styles.philosophy}>
          <p>
            Technology moves fast. AI is making it exponential.
          </p>
          <p>
            Here&apos;s the uncomfortable truth: when thinking becomes optional,
            we stop doing it. And when we stop thinking, we stop growing.
          </p>
          <p className={styles.emphasis}>
            AI isn&apos;t the problem. Unconscious dependency is.
          </p>
          <p>
            The developers who thrive won&apos;t be those who delegate everything—
            they&apos;ll be those who know when to think for themselves and when
            to let AI multiply their work.
          </p>
        </div>
      </div>
    </section>
  );
}
