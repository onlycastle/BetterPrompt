'use client';

import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import styles from './HeroSection.module.css';

const SUBJECTS = ['you', 'your team'] as const;

export function HeroSection() {
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setAnimate(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % SUBJECTS.length);
        setAnimate(false);
      }, 400);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <section id="hero" className={styles.hero}>
      <div className={styles.content}>
        <div className={styles.terminalLine}>
          <span className={styles.promptSymbol}>$</span>
          <span className={styles.command}>/plugin install betterprompt@betterprompt</span>
          <span className={styles.cursor} />
        </div>

        <h1 className={styles.headline}>
          See how{' '}
          <span className={styles.rotatingWrapper}>
            <span className={`${styles.rotatingText} ${animate ? styles.rotatingOut : styles.rotatingIn}`}>
              {SUBJECTS[index]}
            </span>
          </span>
          {' '}<em>actually</em> use AI.
        </h1>

        <p className={styles.subheadline}>
          Analyze AI coding sessions from Claude Code and Cursor directly inside Claude Code.
          Get local reports on thinking patterns, efficiency, and growth areas without a separate analysis server.
        </p>

        <div className={styles.cta}>
          <a
            href="https://github.com/onlycastle/BetterPrompt"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="primary" size="lg" className={styles.ctaButton}>
              View on GitHub
            </Button>
          </a>
        </div>

        <div className={styles.badges}>
          <span className={styles.badge}>Open Source</span>
          <span className={styles.badgeDot} />
          <span className={styles.badge}>Self-Hosted</span>
          <span className={styles.badgeDot} />
          <span className={styles.badge}>Your Data Stays Yours</span>
        </div>
      </div>

      <div className={styles.scrollCue}>
        <span className={styles.scrollText}>See how it works</span>
        <ChevronDown size={20} className={styles.scrollIcon} />
      </div>

    </section>
  );
}
