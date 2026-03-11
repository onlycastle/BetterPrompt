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
    track('cta_click', { location: 'hero', type: 'self_hosted_get_started' });
    setIsWaitlistOpen(true);
  };

  return (
    <section id="hero" className={styles.hero}>
      <div className={styles.content}>
        <h1 className={styles.headline}>
          See how you actually work with AI.
        </h1>

        <p className={styles.subheadline}>
          NoMoreAISlop runs on your own server, analyzes your Claude Code and Cursor sessions
          with your Gemini API key, and stores reports locally.
        </p>

        <div className={styles.cta}>
          <Button variant="primary" size="lg" onClick={handleCtaClick}>
            Get Started
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
