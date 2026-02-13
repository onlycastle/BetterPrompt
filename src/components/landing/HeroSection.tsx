'use client';

import { ChevronDown } from 'lucide-react';
import { track } from '@vercel/analytics';
import { Button } from '@/components/ui/Button';
import styles from './HeroSection.module.css';

export function HeroSection() {
  const handleCtaClick = () => {
    track('cta_click', { location: 'hero', type: 'get_free_report' });
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="hero" className={styles.hero}>
      <div className={styles.content}>
        <div className={styles.badge}>No More AI Slop</div>
        <h1 className={styles.headline}>
          You&apos;re building with AI.
          <br />
          But can you see <span className={styles.accent}>what&apos;s going wrong?</span>
        </h1>

        <p className={styles.subheadline}>
          Analyze your AI coding sessions and see what&apos;s actually going
          on — bad patterns, risky habits, and the blind spots holding you
          back.
        </p>

        <div className={styles.cta}>
          <Button variant="primary" size="lg" onClick={handleCtaClick}>
            Get Your Free Report
          </Button>
        </div>

        <div className={styles.scrollCue}>
          <span className={styles.scrollText}>See how it works</span>
          <ChevronDown size={20} className={styles.scrollIcon} />
        </div>
      </div>
    </section>
  );
}
