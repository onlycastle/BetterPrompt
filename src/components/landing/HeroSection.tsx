'use client';

import { TerminalCommand } from './TerminalCommand';
import styles from './HeroSection.module.css';

export function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={styles.content}>
        <div className={styles.badge}>No More AI Slop</div>
        <h1 className={styles.headline}>
          Are you getting better with AI{' '}
          <br className={styles.breakDesktop} />
          or just more <span className={styles.accent}>dependent</span>?
        </h1>

        <p className={styles.subheadline}>
          Analyze your real conversations to find out
        </p>

        <div className={styles.cta}>
          <TerminalCommand command="npx no-ai-slop" />
        </div>
      </div>
    </section>
  );
}
