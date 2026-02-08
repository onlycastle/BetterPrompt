'use client';

import { ChevronDown } from 'lucide-react';
import { TerminalCommand } from './TerminalCommand';
import styles from './HeroSection.module.css';

export function HeroSection() {
  return (
    <section id="hero" className={styles.hero}>
      <div className={styles.content}>
        <div className={styles.badge}>No More AI Slop</div>
        <h1 className={styles.headline}>
          AI isn&apos;t the problem.
          <br />
          <span className={styles.accent}>Unconscious dependency</span> is.
        </h1>

        <p className={styles.subheadline}>
          Analyze your Claude Code sessions. Discover your AI collaboration patterns.
        </p>

        <div className={styles.cta}>
          <TerminalCommand command="npx no-ai-slop" location="hero" />
        </div>

        <div className={styles.scrollCue}>
          <span className={styles.scrollText}>See how it works</span>
          <ChevronDown size={20} className={styles.scrollIcon} />
        </div>
      </div>
    </section>
  );
}
