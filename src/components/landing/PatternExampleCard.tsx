import styles from './PatternExampleCard.module.css';

export function PatternExampleCard() {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Architecture-First Design Pattern</h3>
        <div className={styles.badges}>
          <span className={styles.badge}>Frequent</span>
          <span className={`${styles.badge} ${styles.badgeHighlight}`}>Highly Effective</span>
        </div>
      </div>

      <div className={styles.description}>
        <p>
          You demonstrate a clear <span className={styles.highlight}>&apos;Architecture First&apos;</span> pattern
          where you define the overall flow and infrastructure structure of the system before writing code.{' '}
          <span className={styles.keyword}>WHAT</span>: You use <code className={styles.code}>/plan</code> commands
          to clarify task order and dependencies, and review potential side effects before making infrastructure changes.{' '}
          <span className={styles.keyword}>WHY</span>: This means you&apos;re not just a feature implementer, but have an{' '}
          <span className={styles.highlight}>&apos;Architect&apos; mindset</span> that prioritizes system stability and maintainability.
          The focus on finding <span className={styles.highlight}>&apos;root causes&apos;</span> rather than fixing surface errors comes from here.{' '}
          <span className={styles.keyword}>HOW</span>: This pattern serves as a strong guideline when AI collaboration
          becomes overwhelming. As a result, it reduces unnecessary code modifications and builds
          reliable, high-quality systems even in production environments.
        </p>
      </div>

      <div className={styles.separator} />

      <div className={styles.examples}>
        <div className={styles.examplesLabel}>EXAMPLES</div>

        <div className={styles.example}>
          <div className={styles.quote}>
            &quot;/plan right now, I think there are problems when fetching quotes from results.
            Find the problems by analyzing the code, and make a resolution plan.&quot;
          </div>
          <div className={styles.explanation}>
            Instead of directing immediate fixes based on symptoms, requests AI to analyze
            and plan first, leading to systematic corrections.
          </div>
        </div>

        <div className={styles.example}>
          <div className={styles.quote}>
            &quot;The fastest way using SST, let&apos;s convert heavy API to lambda. /ultrawork&quot;
          </div>
          <div className={styles.explanation}>
            Prioritizes efficient tools and strategies for complex infra transitions,
            presenting high-level goals to AI.
          </div>
        </div>
      </div>

      <div className={styles.tip}>
        <span className={styles.tipLabel}>Tip:</span>
        <span className={styles.tipText}>
          You&apos;re practicing Simon Willison&apos;s <span className={styles.tipHighlight}>&apos;80% planning, 20% execution&apos;</span> principle.
          The most common mistake in AI collaboration is rushing to generate code. Using <code className={styles.code}>/plan</code>{' '}
          to establish structure first is the best strategy for both token efficiency and code quality.
          Try adding <span className={styles.tipHighlight}>&apos;predict 3 potential blockers&apos;</span> during the planning stage—AI shows higher
          accuracy when analyzing weaknesses of self-created plans.
        </span>
      </div>
    </div>
  );
}
