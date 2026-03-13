'use client';

import { useInView } from '@/hooks/useInView';
import { Button } from '@/components/ui/Button';
import styles from './ProductPreviewSection.module.css';

function staggerClass(isInView: boolean, delayClass: string, ...extra: string[]): string {
  const base = `${styles.staggerItem} ${delayClass}`;
  const visibility = isInView ? styles.visible : '';
  return [base, visibility, ...extra].filter(Boolean).join(' ');
}

const STEPS = [
  {
    number: '01',
    headline: "Your team's AI usage, finally visible",
    description:
      "See every engineer's AI sessions, token consumption, and efficiency scores in one dashboard. The growth leaderboard ranks your team by improvement trajectory - not just raw output.",
    headerTitle: 'Team Dashboard',
    dotClass: styles.dotGray,
    nodeVariant: styles.nodeInput,
    numberColorClass: styles.numberMuted,
    src: '/landing/team_dashboard.png',
    alt: 'Team dashboard with growth leaderboard, session counts, token burn rates, and efficiency scores per developer',
  },
  {
    number: '02',
    headline: "The blind spots your team doesn't know they have",
    description:
      'Automatically surface team-wide anti-patterns like prompt inflation, context bloat, and verbose error pasting. See who\u2019s affected and get actionable recommendations.',
    headerTitle: 'Blind Spot Detection',
    dotClass: styles.dotRed,
    nodeVariant: styles.nodeAlert,
    numberColorClass: styles.numberRed,
    src: '/landing/team_problem.png',
    alt: 'Anti-pattern deep dive showing prompt length inflation, context bloat, and other patterns across team members',
  },
  {
    number: '03',
    headline: 'Sprint updates that write themselves',
    description:
      "Know who built what across every project - without status meetings. Session data maps to repositories and shows each contributor's work alongside their session count.",
    headerTitle: 'Project Activity',
    dotClass: styles.dotCyan,
    nodeVariant: styles.nodeSolution,
    numberColorClass: styles.numberCyan,
    src: '/landing/team_projects.png',
    alt: 'Project activity view showing team members, their sessions, and contributions across projects',
  },
] as const;

export function ProductPreviewSection() {
  const { ref, isInView } = useInView({ threshold: 0.1 });

  return (
    <section id="preview" className={styles.section}>
      <div ref={ref} className={styles.wrapper}>
        <span className={styles.sectionLabel}>How It Works</span>
        <h2 className={styles.sectionTitle}>From raw sessions to team insights</h2>

        {STEPS.map((step, i) => {
          const nodeDelay = i === 0 ? styles.delay0 : i === 1 ? styles.delay2 : styles.delay4;
          const arrowDelay = i === 0 ? styles.delay1 : styles.delay3;

          return (
            <div key={step.number}>
              {/* Step card */}
              <div className={staggerClass(isInView, nodeDelay, styles.stepBlock)}>
                {/* Text block */}
                <div className={styles.textBlock}>
                  <span className={`${styles.stepNumber} ${step.numberColorClass}`}>
                    {step.number}
                  </span>
                  <h3 className={styles.stepHeadline}>{step.headline}</h3>
                  <p className={styles.stepDescription}>{step.description}</p>
                </div>

                {/* Screenshot frame */}
                <div className={`${styles.screenshotFrame} ${step.nodeVariant}`}>
                  <div className={styles.nodeHeader}>
                    <span className={`${styles.headerDot} ${step.dotClass}`} />
                    <span className={styles.headerTitle}>{step.headerTitle}</span>
                  </div>
                  <img
                    src={step.src}
                    alt={step.alt}
                    className={styles.nodeScreenshot}
                  />
                </div>
              </div>

              {/* Arrow (after steps 1 and 2 only) */}
              {i < 2 && (
                <div className={staggerClass(isInView, arrowDelay, styles.arrow)}>
                  <div className={styles.arrowLine} />
                </div>
              )}
            </div>
          );
        })}

        {/* CTA */}
        <div className={styles.ctaWrapper}>
          <a href="https://github.com/onlycastle/BetterPrompt" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="lg">
              View on GitHub
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
