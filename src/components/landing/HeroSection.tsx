'use client';

import { TerminalCommand } from './TerminalCommand';
import styles from './HeroSection.module.css';

export function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={styles.content}>
        <div className={styles.badge}>No More AI Slop</div>
        <h1 className={styles.headline}>
          Good vibe coders know what they <span className={styles.accent}>shipped</span>.
          <br className={styles.breakDesktop} />
          Do you?
        </h1>

        <p className={styles.subheadline}>
          Review your patterns. Ship better.
        </p>

        <div className={styles.cta}>
          <TerminalCommand command="npx no-ai-slop" />
        </div>
      </div>
    </section>
  );
}
