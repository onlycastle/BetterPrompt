import styles from './UnlockSection.module.css';

interface UnlockSectionProps {
  isUnlocked: boolean;
  dashboardBaseUrl?: string;
}

/**
 * CTA section for locked/unlocked states
 * Shows unlock badge when premium, paywall when free
 * ALWAYS shows dual dashboard buttons (My Dashboard + Enterprise)
 */
export function UnlockSection({
  isUnlocked,
  dashboardBaseUrl = 'https://www.nomoreaislop.xyz',
}: UnlockSectionProps) {
  const personalUrl = `${dashboardBaseUrl}/personal`;
  const enterpriseUrl = `${dashboardBaseUrl}/enterprise`;

  return (
    <div className={styles.unlockSection}>
      {isUnlocked ? (
        <>
          {/* Unlocked State */}
          <div className={styles.unlockedBadge}>
            <div className={styles.badgeIcon}>✨</div>
            <h3 className={styles.badgeTitle}>Full Analysis Unlocked</h3>
            <p className={styles.badgeSubtitle}>
              You have access to all premium features and detailed breakdowns.
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Locked State - Paywall */}
          <div className={styles.lockedContent}>
            <h3 className={styles.lockedTitle}>🔒 Unlock Detailed Analysis</h3>
            <p className={styles.lockedDescription}>
              Get the complete picture of your AI collaboration patterns with detailed breakdowns,
              personalized recommendations, and professional insights.
            </p>

            <ul className={styles.featureList}>
              <li>🤝 Full AI Collaboration breakdown + improvement strategies</li>
              <li>🎯 Best & worst prompt examples with improvement tips</li>
              <li>🔥 Complete burnout risk analysis + time patterns</li>
              <li>🛠️ All tool mastery data + optimization strategies</li>
              <li>🎮 AI Control Index deep-dive + professional tips</li>
              <li>💪 Skill Resilience analysis + practice exercises</li>
              <li>📊 Peer comparison percentiles (vs 10,000+ users)</li>
              <li>📈 Learning velocity tracking</li>
              <li>💬 All conversation evidence examples</li>
              <li>🎯 Personalized growth roadmap</li>
              <li>📄 Downloadable PDF report</li>
              <li>🏷️ Shareable badge for your profile</li>
            </ul>

            <div className={styles.ctaBox}>
              <div className={styles.ctaPrice}>☕ ONE-TIME: $4.99</div>
              <div className={styles.ctaSubtitle}>
                Less than a coffee • Unlock this analysis forever
              </div>
            </div>

            <p className={styles.proNote}>
              Want unlimited analyses + trend tracking?{' '}
              <span className={styles.proHighlight}>PRO: $6.99/month</span>
            </p>

            <div className={styles.dashboardDivider}>
              <p className={styles.dashboardPrompt}>
                Track your growth or manage your team
              </p>
            </div>
          </div>
        </>
      )}

      {/* Dashboard Buttons - ALWAYS SHOWN */}
      <div className={styles.dashboardButtons}>
        <a
          href={personalUrl}
          className={`${styles.dashboardBtn} ${styles.personal}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          My Dashboard
        </a>
        <a
          href={enterpriseUrl}
          className={`${styles.dashboardBtn} ${styles.enterprise}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21h18" />
            <path d="M5 21V7l8-4v18" />
            <path d="M19 21V11l-6-4" />
            <path d="M9 9v.01" />
            <path d="M9 12v.01" />
            <path d="M9 15v.01" />
            <path d="M9 18v.01" />
          </svg>
          Enterprise
        </a>
      </div>
    </div>
  );
}
