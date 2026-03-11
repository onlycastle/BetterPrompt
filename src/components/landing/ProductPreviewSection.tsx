'use client';

import { useState } from 'react';
import { track } from '@vercel/analytics';
import { useInView } from '@/hooks/useInView';
import { Button } from '@/components/ui/Button';
import { WaitlistModal, waitlistConfigs } from './WaitlistModal';
import styles from './ProductPreviewSection.module.css';

function staggerClass(isInView: boolean, delayClass: string, ...extra: string[]): string {
  const base = `${styles.staggerItem} ${delayClass}`;
  const visibility = isInView ? styles.visible : '';
  return [base, visibility, ...extra].filter(Boolean).join(' ');
}

export function ProductPreviewSection() {
  const { ref, isInView } = useInView({ threshold: 0.1 });
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);

  const handleCtaClick = () => {
    track('cta_click', { location: 'product_preview', type: 'self_hosted_get_started' });
    setIsWaitlistOpen(true);
  };

  return (
    <section id="preview" className={styles.section}>
      <div ref={ref} className={styles.wrapper}>
        <h2 className={styles.sectionTitle}>See what NoMoreAISlop finds</h2>

        <div className={staggerClass(isInView, styles.delay0, styles.node, styles.nodeInput)}>
          <div className={styles.nodeHeader}>
            <span className={`${styles.headerDot} ${styles.dotGray}`} />
            <span className={styles.headerTitle}>Local Inputs</span>
            <span className={styles.stepLabel}>Step 1</span>
          </div>
          <div className={styles.nodeBody}>
            <p className={styles.problemDesc}>
              The CLI reads your Claude Code and Cursor session history from your machine.
            </p>
          </div>
        </div>

        <div className={staggerClass(isInView, styles.delay1, styles.arrow)}>
          <div className={styles.arrowLine} />
        </div>

        <div className={staggerClass(isInView, styles.delay2, styles.node, styles.nodeAlert)}>
          <div className={styles.nodeHeader}>
            <span className={`${styles.headerDot} ${styles.dotRed}`} />
            <span className={styles.headerTitle}>Local Analysis</span>
            <span className={styles.stepLabel}>Step 2</span>
          </div>
          <div className={styles.nodeBody}>
            <p className={styles.problemDesc}>
              Your self-hosted Next.js server runs the Gemini worker pipeline and stores the
              result in local SQLite.
            </p>
          </div>
        </div>

        <div className={staggerClass(isInView, styles.delay3, styles.arrow)}>
          <div className={styles.arrowLine} />
        </div>

        <div className={staggerClass(isInView, styles.delay4, styles.node, styles.nodeSolution)}>
          <div className={styles.nodeHeader}>
            <span className={`${styles.headerDot} ${styles.dotCyan}`} />
            <span className={styles.headerTitle}>Local Report</span>
            <span className={styles.stepLabel}>Step 3</span>
          </div>
          <div className={styles.nodeBody}>
            <p className={styles.problemDesc}>
              Review your report in the dashboard, share a local-hosted report URL, and keep your
              data under your own control.
            </p>
          </div>
        </div>

        <div className={styles.ctaWrapper}>
          <Button variant="primary" size="lg" onClick={handleCtaClick}>
            Open Quick Start
          </Button>
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
