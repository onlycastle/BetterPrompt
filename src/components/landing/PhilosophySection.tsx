'use client';

import styles from './PhilosophySection.module.css';

export function PhilosophySection() {
  return (
    <section className={styles.section}>
      <div className={styles.content}>
        <blockquote className={styles.oneliner}>
          <span className={styles.onelinerLine1}>AI is a multiplier.</span>
          <span className={styles.onelinerLine2}>But only if you&apos;re still thinking.</span>
        </blockquote>

        <div className={styles.philosophy}>
          <p>
            Technology moves fast. AI is making it exponential.
          </p>
          <p>
            Here&apos;s the uncomfortable truth: when thinking becomes optional,
            we stop doing{'\u00A0'}it. And when we stop thinking, we stop growing.
          </p>
          <p className={styles.emphasis}>
            AI isn&apos;t the problem. Unconscious dependency is.
          </p>
          <p>
            The developers who thrive won&apos;t be those who delegate everything.
            They&apos;ll be those who know when to think for themselves and when
            to let AI multiply their{'\u00A0'}work.
          </p>
        </div>

        <div className={styles.discord}>
          <blockquote className={styles.discordQuote}>
            <span className={styles.discordLine1}>If this resonates, join our Discord.</span>
            <span className={styles.discordLine2}>Let&apos;s share knowledge for better AI collaboration.</span>
          </blockquote>
          <a
            href="https://discord.gg/xS3eDseCFH"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.discordLink}
          >
            <svg
              className={styles.discordIcon}
              viewBox="0 -28.5 256 256"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid"
            >
              <path
                d="M216.856 16.597A208.502 208.502 0 0 0 164.042 0c-2.275 4.113-4.933 9.645-6.766 14.046-19.692-2.961-39.203-2.961-58.533 0-1.832-4.4-4.55-9.933-6.846-14.046a207.809 207.809 0 0 0-52.855 16.638C5.618 67.147-3.443 116.4 1.087 164.956c22.169 16.555 43.653 26.612 64.775 33.193A161.094 161.094 0 0 0 79.735 175.3a136.413 136.413 0 0 1-21.846-10.632 108.636 108.636 0 0 0 5.356-4.237c42.122 19.702 87.89 19.702 129.51 0a131.66 131.66 0 0 0 5.355 4.237 136.07 136.07 0 0 1-21.886 10.653c4.006 8.02 8.638 15.67 13.873 22.848 21.142-6.58 42.646-16.637 64.815-33.213 5.316-56.288-9.08-105.09-38.056-148.36ZM85.474 135.095c-12.645 0-23.015-11.805-23.015-26.18s10.149-26.2 23.015-26.2c12.867 0 23.236 11.804 23.015 26.2.02 14.375-10.148 26.18-23.015 26.18Zm85.051 0c-12.645 0-23.014-11.805-23.014-26.18s10.148-26.2 23.014-26.2c12.867 0 23.236 11.804 23.015 26.2 0 14.375-10.148 26.18-23.015 26.18Z"
                fill="currentColor"
              />
            </svg>
            <span>Join the Community</span>
          </a>
        </div>
      </div>
    </section>
  );
}
