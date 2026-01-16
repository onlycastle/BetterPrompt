/**
 * Comparison Page
 *
 * Side-by-side comparison of Free vs Premium tier reports.
 * Used for product planning and marketing review.
 */

import { useParams } from 'react-router-dom';
import { useComparison, useFeatureComparison } from '@/hooks';
import styles from './ComparisonPage.module.css';
import { REPORT_TYPE_METADATA } from '@/types/report';

export function ComparisonPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const { data: comparisonData, isLoading, error } = useComparison(reportId);
  const { data: featureData } = useFeatureComparison();

  // If no reportId, show feature comparison only
  if (!reportId) {
    return <FeatureComparisonOnly featureData={featureData} />;
  }

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading comparison...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorEmoji}>😔</div>
        <h1>Report Not Found</h1>
        <p>{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
      </div>
    );
  }

  if (!comparisonData) {
    return null;
  }

  const { free, premium, featureComparison } = comparisonData;
  const typeInfo = REPORT_TYPE_METADATA[free.typeResult.primaryType as keyof typeof REPORT_TYPE_METADATA];

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1>Free vs Premium Comparison</h1>
        <p className={styles.subtitle}>
          See what's included in each tier for your <strong>{typeInfo?.name || free.typeResult.primaryType}</strong> analysis
        </p>
      </header>

      {/* Side by Side Comparison */}
      <div className={styles.comparison}>
        {/* Free Tier Column */}
        <div className={styles.column}>
          <div className={styles.tierHeader}>
            <span className={styles.tierBadge} data-tier="free">FREE</span>
            <h2>Basic Analysis</h2>
            <p className={styles.tierPrice}>$0</p>
          </div>

          <div className={styles.reportPreview}>
            {/* Type Result - Available in Free */}
            <section className={styles.section}>
              <h3>Your AI Coding Style</h3>
              <div className={styles.typeCard}>
                <span className={styles.typeEmoji}>{typeInfo?.emoji || '🎯'}</span>
                <span className={styles.typeName}>{typeInfo?.name || free.typeResult.primaryType}</span>
              </div>
              <div className={styles.distribution}>
                {Object.entries(free.typeResult.distribution).map(([type, percentage]) => {
                  const meta = REPORT_TYPE_METADATA[type as keyof typeof REPORT_TYPE_METADATA];
                  return (
                    <div key={type} className={styles.distributionBar}>
                      <span className={styles.barLabel}>
                        {meta?.emoji} {meta?.name || type}
                      </span>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className={styles.barValue}>{Math.round(percentage)}%</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Locked Sections */}
            <section className={`${styles.section} ${styles.locked}`}>
              <div className={styles.lockOverlay}>
                <span className={styles.lockIcon}>🔒</span>
                <span>6 Dimension Analysis</span>
              </div>
              <div className={styles.blurredContent}>
                <div className={styles.mockContent}></div>
                <div className={styles.mockContent}></div>
                <div className={styles.mockContent}></div>
              </div>
            </section>

            <section className={`${styles.section} ${styles.locked}`}>
              <div className={styles.lockOverlay}>
                <span className={styles.lockIcon}>🔒</span>
                <span>Tool Usage Deep Dive</span>
              </div>
              <div className={styles.blurredContent}>
                <div className={styles.mockContent}></div>
                <div className={styles.mockContent}></div>
              </div>
            </section>

            <section className={`${styles.section} ${styles.locked}`}>
              <div className={styles.lockOverlay}>
                <span className={styles.lockIcon}>🔒</span>
                <span>Growth Roadmap</span>
              </div>
              <div className={styles.blurredContent}>
                <div className={styles.mockContent}></div>
              </div>
            </section>
          </div>

          <div className={styles.tierFooter}>
            <p className={styles.featureCount}>
              {featureComparison.filter(f => f.free).length} features included
            </p>
          </div>
        </div>

        {/* Premium Tier Column */}
        <div className={`${styles.column} ${styles.premium}`}>
          <div className={styles.tierHeader}>
            <span className={styles.tierBadge} data-tier="premium">PREMIUM</span>
            <h2>Full Analysis</h2>
            <p className={styles.tierPrice}>
              <span className={styles.oneTime}>$6.99</span>
              <span className={styles.priceNote}>one-time</span>
            </p>
          </div>

          <div className={styles.reportPreview}>
            {/* Type Result - Same as Free */}
            <section className={styles.section}>
              <h3>Your AI Coding Style</h3>
              <div className={styles.typeCard}>
                <span className={styles.typeEmoji}>{typeInfo?.emoji || '🎯'}</span>
                <span className={styles.typeName}>{typeInfo?.name || premium.typeResult.primaryType}</span>
              </div>
              <div className={styles.distribution}>
                {Object.entries(premium.typeResult.distribution).map(([type, percentage]) => {
                  const meta = REPORT_TYPE_METADATA[type as keyof typeof REPORT_TYPE_METADATA];
                  return (
                    <div key={type} className={styles.distributionBar}>
                      <span className={styles.barLabel}>
                        {meta?.emoji} {meta?.name || type}
                      </span>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className={styles.barValue}>{Math.round(percentage)}%</span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Unlocked Sections */}
            <section className={`${styles.section} ${styles.unlocked}`}>
              <div className={styles.unlockBadge}>
                <span>✨</span> Unlocked
              </div>
              <h3>6 Dimension Analysis</h3>
              <div className={styles.dimensionGrid}>
                <div className={styles.dimensionItem}>🤝 AI Collaboration</div>
                <div className={styles.dimensionItem}>🎯 Context Engineering</div>
                <div className={styles.dimensionItem}>🔥 Burnout Risk</div>
                <div className={styles.dimensionItem}>🛠️ Tool Mastery</div>
                <div className={styles.dimensionItem}>🎮 AI Control</div>
                <div className={styles.dimensionItem}>💪 Skill Resilience</div>
              </div>
            </section>

            <section className={`${styles.section} ${styles.unlocked}`}>
              <div className={styles.unlockBadge}>
                <span>✨</span> Unlocked
              </div>
              <h3>Tool Usage Deep Dive</h3>
              <p className={styles.sectionDesc}>
                Detailed analysis of how you use different tools, with optimization tips.
              </p>
            </section>

            <section className={`${styles.section} ${styles.unlocked}`}>
              <div className={styles.unlockBadge}>
                <span>✨</span> Unlocked
              </div>
              <h3>Growth Roadmap</h3>
              <p className={styles.sectionDesc}>
                Personalized learning path with milestones and progress tracking.
              </p>
            </section>

            {premium.sessionMetadata && (
              <section className={styles.section}>
                <h3>Session Metadata</h3>
                <div className={styles.metadata}>
                  {premium.sessionMetadata.durationMinutes && (
                    <div>Duration: {premium.sessionMetadata.durationMinutes} min</div>
                  )}
                  {premium.sessionMetadata.messageCount && (
                    <div>Messages: {premium.sessionMetadata.messageCount}</div>
                  )}
                  {premium.sessionMetadata.toolCallCount && (
                    <div>Tool Calls: {premium.sessionMetadata.toolCallCount}</div>
                  )}
                </div>
              </section>
            )}
          </div>

          <div className={styles.tierFooter}>
            <p className={styles.featureCount}>
              {featureComparison.filter(f => f.premium).length} features included
            </p>
            <p className={styles.premiumExtra}>
              +{featureComparison.filter(f => f.premium && !f.free).length} premium features
            </p>
          </div>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className={styles.featureTable}>
        <h2>Feature Comparison</h2>
        <table>
          <thead>
            <tr>
              <th>Feature</th>
              <th>Free</th>
              <th>Premium</th>
            </tr>
          </thead>
          <tbody>
            {featureComparison.map((feature) => (
              <tr key={feature.feature}>
                <td>
                  <div className={styles.featureName}>{feature.feature}</div>
                  <div className={styles.featureDesc}>{feature.description}</div>
                </td>
                <td className={styles.checkCell}>
                  {feature.free ? (
                    <span className={styles.check}>✓</span>
                  ) : (
                    <span className={styles.cross}>—</span>
                  )}
                </td>
                <td className={styles.checkCell}>
                  {feature.premium ? (
                    <span className={styles.check}>✓</span>
                  ) : (
                    <span className={styles.cross}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CTA */}
      <div className={styles.cta}>
        <h2>Ready to unlock your full analysis?</h2>
        <p>Get detailed insights and a personalized growth roadmap.</p>
        <div className={styles.ctaButtons}>
          <button className={styles.primaryBtn}>
            Get Premium ($6.99)
          </button>
          <button className={styles.secondaryBtn}>
            Go PRO ($9/mo)
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Feature comparison view when no reportId is provided
 */
function FeatureComparisonOnly({ featureData }: { featureData: ReturnType<typeof useFeatureComparison>['data'] }) {
  if (!featureData) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading features...</p>
      </div>
    );
  }

  const { features, stats, byCategory } = featureData;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Free vs Premium Features</h1>
        <p className={styles.subtitle}>
          Compare what's included in each tier
        </p>
      </header>

      {/* Stats Summary */}
      <div className={styles.statsSummary}>
        <div className={styles.statCard}>
          <span className={styles.statNumber}>{stats.freeFeatureCount}</span>
          <span className={styles.statLabel}>Free Features</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNumber}>{stats.premiumOnlyCount}</span>
          <span className={styles.statLabel}>Premium Only</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNumber}>{stats.premiumFeatureCount}</span>
          <span className={styles.statLabel}>Total Premium</span>
        </div>
      </div>

      {/* Features by Category */}
      {Object.entries(byCategory).map(([category, items]) => (
        <div key={category} className={styles.categorySection}>
          <h2 className={styles.categoryTitle}>
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </h2>
          <div className={styles.categoryFeatures}>
            {items.map((feature) => (
              <div
                key={feature.feature}
                className={`${styles.featureCard} ${!feature.free ? styles.premiumOnly : ''}`}
              >
                <div className={styles.featureCardHeader}>
                  <span className={styles.featureCardName}>{feature.feature}</span>
                  {!feature.free && (
                    <span className={styles.premiumBadge}>Premium</span>
                  )}
                </div>
                <p className={styles.featureCardDesc}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Full Table */}
      <div className={styles.featureTable}>
        <h2>Complete Feature List</h2>
        <table>
          <thead>
            <tr>
              <th>Feature</th>
              <th>Free</th>
              <th>Premium</th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => (
              <tr key={feature.feature}>
                <td>
                  <div className={styles.featureName}>{feature.feature}</div>
                  <div className={styles.featureDesc}>{feature.description}</div>
                </td>
                <td className={styles.checkCell}>
                  {feature.free ? (
                    <span className={styles.check}>✓</span>
                  ) : (
                    <span className={styles.cross}>—</span>
                  )}
                </td>
                <td className={styles.checkCell}>
                  {feature.premium ? (
                    <span className={styles.check}>✓</span>
                  ) : (
                    <span className={styles.cross}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
