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
    track('cta_click', { location: 'product_preview', type: 'try_it_free' });
    setIsWaitlistOpen(true);
  };

  return (
    <section id="preview" className={styles.section}>
      <div ref={ref} className={styles.wrapper}>
        <h2 className={styles.sectionTitle}>See what BetterPrompt finds</h2>

        {/* Step 1 — Your Project */}
        <div
          className={staggerClass(isInView, styles.delay0, styles.node, styles.nodeInput)}
        >
          <div className={styles.nodeHeader}>
            <span className={`${styles.headerDot} ${styles.dotGray}`} />
            <span className={styles.headerTitle}>Your Project</span>
            <span className={styles.stepLabel}>Step 1</span>
          </div>
          <div className={styles.dualPanel}>
            {/* File tree */}
            <div className={styles.panelLeft}>
              <span className={styles.panelTitle}>your-project/</span>
              <div className={styles.fileTree}>
                <div className={styles.fileEntry}>
                  <span className={styles.fileIcon}>📁</span>
                  <span className={styles.fileName}>src/</span>
                </div>
                <div className={`${styles.fileEntry} ${styles.fileIndent}`}>
                  <span className={styles.fileIcon}>📄</span>
                  <span className={styles.fileName}>auth-config.ts</span>
                </div>
                <div className={`${styles.fileEntry} ${styles.fileIndent}`}>
                  <span className={styles.fileIcon}>📄</span>
                  <span className={styles.fileName}>checkout-page.ts</span>
                </div>
                <div className={`${styles.fileEntry} ${styles.fileIndent}`}>
                  <span className={styles.fileIcon}>📄</span>
                  <span className={styles.fileName}>token-handler.ts</span>
                </div>
              </div>
              <span className={styles.fileStat}>3 files · 847 lines</span>
            </div>
            {/* Chat history */}
            <div className={styles.panelRight}>
              <span className={styles.panelTitle}>AI Chat History</span>
              <div className={styles.chatLine}>
                <span className={styles.chatRole}>You</span>
                <span className={styles.chatText}>Checkout keeps failing</span>
              </div>
              <div className={styles.chatLine}>
                <span className={styles.chatRole}>AI</span>
                <span className={styles.chatTextFaded}>Try clearing the cache...</span>
              </div>
              <div className={styles.chatLine}>
                <span className={styles.chatRole}>You</span>
                <span className={styles.chatText}>Still fails after a few minutes</span>
              </div>
              <div className={styles.chatLine}>
                <span className={styles.chatRole}>AI</span>
                <span className={styles.chatTextFaded}>Let me check the button...</span>
              </div>
              <div className={styles.chatEllipsis}>···</div>
              <div className={styles.chatLine}>
                <span className={styles.chatRole}>You</span>
                <span className={styles.chatText}>Same error again</span>
              </div>
              <span className={styles.chatStat}>47 messages · 47 min</span>
            </div>
          </div>
        </div>

        {/* Arrow 1 */}
        <div
          className={staggerClass(isInView, styles.delay1, styles.arrow)}
        >
          <div className={styles.arrowLine} />
        </div>

        {/* Step 2 — Problem Found */}
        <div
          className={staggerClass(isInView, styles.delay2, styles.node, styles.nodeAlert)}
        >
          <div className={styles.nodeHeader}>
            <span className={`${styles.headerDot} ${styles.dotRed}`} />
            <span className={styles.headerTitle}>Problem Found</span>
            <span className={styles.stepLabel}>Step 2</span>
          </div>
          <div className={styles.nodeBody}>
            <div className={styles.problemHeader}>
              <span className={styles.problemIcon}>!</span>
              <span className={styles.problemTitle}>JWT Token Expired</span>
              <span className={styles.severityBadge}>Auth Error</span>
            </div>
            <p className={styles.problemDesc}>
              Your app&apos;s login pass expires before checkout finishes — like a parking ticket
              running out while you&apos;re still in the store.
            </p>
            <div className={styles.workflowBlock}>
              <div className={styles.workflowLine}>
                <span className={`${styles.workflowLabel} ${styles.workflowNow}`}>Now:</span>
                <span>Login &rarr; browse &rarr; checkout &rarr; login expired &rarr; payment fails</span>
              </div>
              <div className={styles.workflowLine}>
                <span className={`${styles.workflowLabel} ${styles.workflowFix}`}>Fix:</span>
                <span>Auto-refresh the login pass before it expires</span>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow 2 */}
        <div
          className={staggerClass(isInView, styles.delay3, styles.arrow)}
        >
          <div className={styles.arrowLine} />
        </div>

        {/* Step 3 — Better Prompt */}
        <div
          className={staggerClass(isInView, styles.delay4, styles.node, styles.nodeSolution)}
        >
          <div className={styles.nodeHeader}>
            <span className={`${styles.headerDot} ${styles.dotCyan}`} />
            <span className={styles.headerTitle}>Better Prompt</span>
            <span className={styles.stepLabel}>Step 3</span>
          </div>
          <div className={styles.nodeBody}>
            <div className={styles.suggestionBlock}>
              <span className={styles.suggestionPrefix}>💡 Ask this instead</span>
              <p className={styles.promptText}>
                &ldquo;My checkout fails after a few minutes of browsing. I think the auth token
                in token-handler.ts might be expiring. Can you add auto-refresh before it
                expires?&rdquo;
              </p>
            </div>
            <span className={styles.outcome}>&rarr; Fixed in 2 minutes</span>
          </div>
        </div>

        {/* CTA */}
        <div className={styles.ctaWrapper}>
          <Button variant="primary" size="lg" onClick={handleCtaClick}>
            Try It Free
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
