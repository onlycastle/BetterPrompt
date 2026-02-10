import { ChevronDown } from 'lucide-react';
import { TerminalCommand } from './TerminalCommand';
import { TextRotator } from './TextRotator';
import styles from './HeroSection.module.css';

export function HeroSection() {
  return (
    <section id="hero" className={styles.hero}>
      <div className={styles.content}>
        <div className={styles.badge}>No More AI Slop</div>
        <h1 className={styles.headline}>
          See how <TextRotator words={['you', 'your team']} />
          <br />
          make <span className={styles.accent}>AI slop</span>.
        </h1>

        <p className={styles.subheadline}>
          Analyze your coding sessions. Spot anti-patterns. Build better AI habits.
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
