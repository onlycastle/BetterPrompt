'use client';

import { SamplePreviewFrame } from './SamplePreviewFrame';
import { useInView } from '@/hooks/useInView';
import styles from './AnalysisPreview.module.css';

export function AnalysisPreview() {
  const { ref, isInView } = useInView({ threshold: 0.1 });

  return (
    <section id="preview" className={styles.section}>
      <div ref={ref} className={`${styles.wrapper} ${isInView ? styles.visible : ''}`}>
        <SamplePreviewFrame>
          <div className={styles.header}>
            <h2 className={styles.headline}>Sample Report Preview</h2>
            <p className={styles.subheadline}>
              This is what your personalized analysis looks like
            </p>
          </div>

          {/* Personality Type Card */}
          <div className={styles.typeCard}>
            <div className={styles.typeHeader}>
              <span className={styles.typeEmoji}>🔬</span>
              <div className={styles.typeInfo}>
                <h3 className={styles.typeName}>The Analyst</h3>
                <p className={styles.typeTagline}>Deep investigator who verifies and questions everything</p>
              </div>
            </div>

            <div className={styles.traitBadges}>
              <span className={styles.traitBadge}>Systematic verification</span>
              <span className={styles.traitBadge}>Critical thinking</span>
            </div>

            <div className={styles.separator} />

            {/* Style Matrix — top 2 only */}
            <div className={styles.matrixSection}>
              <span className={styles.matrixLabel}>STYLE MATRIX</span>
              <div className={styles.matrix}>
                <StyleMatrixRow emoji="🔬" name="The Analyst" percent={35} isPrimary />
                <StyleMatrixRow emoji="🏗️" name="The Architect" percent={25} />
              </div>
              <span className={styles.matrixMore}>...and 3 more styles in your full report</span>
            </div>
          </div>

          {/* Single highlight insight */}
          <div className={styles.insightCard}>
            <div className={styles.insightHeader}>
              <span className={styles.insightIcon}>🔍</span>
              <span className={styles.insightName}>Pattern Detective</span>
              <span className={styles.insightScore}>98%</span>
            </div>
            <div className={styles.insightBody}>
              <span className={styles.sparkle}>✨</span>
              <p className={styles.insightText}>
                Your &apos;Zero Trust&apos; verification skill for AI&apos;s logical flaws is exceptional.
                Despite higher Strategist scores, the choice of Systems Architect shows sharp
                data-driven insight.
              </p>
            </div>
          </div>

          <p className={styles.moreText}>
            ...and 5 more analysis dimensions in your full report
          </p>

          <div className={styles.ctaRow}>
            <span className={styles.ctaText}>
              This is a sample.{' '}
              <a href="#download" className={styles.ctaLink}>
                Run the CLI to see yours →
              </a>
            </span>
          </div>
        </SamplePreviewFrame>
      </div>
    </section>
  );
}

interface StyleMatrixRowProps {
  emoji: string;
  name: string;
  percent: number;
  isPrimary?: boolean;
}

function StyleMatrixRow({ emoji, name, percent, isPrimary }: StyleMatrixRowProps) {
  return (
    <div className={`${styles.matrixRow} ${isPrimary ? styles.matrixRowPrimary : ''}`}>
      <span className={styles.rowEmoji}>{emoji}</span>
      <span className={styles.rowName}>{name}</span>
      <div className={styles.barContainer}>
        <div
          className={`${styles.bar} ${isPrimary ? styles.barPrimary : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={styles.rowPercent}>{percent}%</span>
    </div>
  );
}
