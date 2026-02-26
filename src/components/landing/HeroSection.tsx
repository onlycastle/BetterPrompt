'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { track } from '@vercel/analytics';
import { Button } from '@/components/ui/Button';
import { WaitlistModal, waitlistConfigs } from './WaitlistModal';
import styles from './HeroSection.module.css';

export function HeroSection() {
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  const handleCtaClick = () => {
    track('cta_click', { location: 'hero', type: 'try_it_free' });
    setIsWaitlistOpen(true);
  };

  return (
    <section id="hero" className={styles.hero}>
      <div className={styles.content}>
        <h1 className={styles.headline}>
          The right question changes everything.
        </h1>

        <p className={styles.subheadline}>
          BetterPrompt reads your AI chat history, analyzes your codebase, and tells you exactly how to eliminate roadblocks.
        </p>

        <div className={styles.cta}>
          <Button variant="primary" size="lg" onClick={handleCtaClick}>
            Try It Free
          </Button>
        </div>

        <div className={styles.scrollCue}>
          <span className={styles.scrollText}>See how it works</span>
          <ChevronDown size={20} className={styles.scrollIcon} />
        </div>
      </div>
      <WaitlistModal
        isOpen={isWaitlistOpen}
        onClose={() => setIsWaitlistOpen(false)}
        config={waitlistConfigs.free_trial}
      />
    </section>
  );
}
