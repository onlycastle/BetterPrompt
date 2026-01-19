/**
 * Comparison Page
 * Free vs Premium tier comparison
 */

import { useFeatureComparison } from '../hooks';
import styles from './ComparisonPage.module.css';

interface ComparisonPageProps {
  reportId?: string | null;
  onBack?: () => void;
}

interface FeatureItemProps {
  included: boolean;
  label: string;
  bold?: boolean;
}

function FeatureItem({ included, label, bold = false }: FeatureItemProps) {
  return (
    <li className={included ? styles.included : styles.excluded}>
      <span className={included ? styles.check : styles.cross}>
        {included ? '✓' : '—'}
      </span>
      {bold ? <strong>{label}</strong> : label}
    </li>
  );
}

const FREE_TIER_FEATURES = [
  { label: 'AI Coding Style Type', included: true },
  { label: 'Type Distribution Chart', included: true },
  { label: 'Basic Personality Summary', included: true },
  { label: '6 Dimension Analysis', included: false },
  { label: 'Personalized Strengths', included: false },
  { label: 'Growth Areas & Recommendations', included: false },
  { label: 'Prompt Pattern Analysis', included: false },
  { label: 'Tool Usage Deep Dive', included: false },
];

const PREMIUM_TIER_FEATURES = [
  { label: 'AI Coding Style Type', included: true },
  { label: 'Type Distribution Chart', included: true },
  { label: 'Detailed Personality Summary', included: true },
  { label: '6 Dimension Analysis', included: true, bold: true },
  { label: 'Personalized Strengths', included: true, bold: true },
  { label: 'Growth Areas & Recommendations', included: true, bold: true },
  { label: 'Prompt Pattern Analysis', included: true, bold: true },
  { label: 'Tool Usage Deep Dive', included: true, bold: true },
];

export default function ComparisonPage({ onBack }: ComparisonPageProps) {
  const { data: featureData, isLoading } = useFeatureComparison();

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading comparison...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        {onBack && (
          <button className={styles.backButton} onClick={onBack}>
            ← Back
          </button>
        )}
        <h1 className={styles.title}>Free vs Premium</h1>
        <p className={styles.subtitle}>Compare what's included in each tier</p>
      </header>

      {/* Comparison Columns */}
      <div className={styles.comparison}>
        {/* Free Tier */}
        <div className={styles.column}>
          <div className={styles.tierHeader}>
            <span className={styles.tierBadge} data-tier="free">FREE</span>
            <h2>Basic Analysis</h2>
            <p className={styles.tierPrice}>$0</p>
          </div>

          <ul className={styles.featureList}>
            {FREE_TIER_FEATURES.map(({ label, included }) => (
              <FeatureItem key={label} included={included} label={label} />
            ))}
          </ul>
        </div>

        {/* Premium Tier */}
        <div className={`${styles.column} ${styles.premium}`}>
          <div className={styles.tierHeader}>
            <span className={styles.tierBadge} data-tier="premium">PREMIUM</span>
            <h2>Full Analysis</h2>
            <p className={styles.tierPrice}>
              <span className={styles.price}>$4.99</span>
              <span className={styles.priceNote}>one-time</span>
            </p>
          </div>

          <ul className={styles.featureList}>
            {PREMIUM_TIER_FEATURES.map(({ label, included, bold }) => (
              <FeatureItem key={label} included={included} label={label} bold={bold} />
            ))}
          </ul>

          <div className={styles.highlight}>
            ✨ Unlock your full potential
          </div>
        </div>
      </div>

      {/* Feature Details */}
      {featureData && (
        <div className={styles.featureTable}>
          <h2>Detailed Feature Comparison</h2>
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Free</th>
                <th>Premium</th>
              </tr>
            </thead>
            <tbody>
              {featureData.categories?.map((category) =>
                category.features.map((feature) => (
                  <tr key={feature.name}>
                    <td>
                      <div className={styles.featureName}>{feature.name}</div>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CTA */}
      <div className={styles.cta}>
        <h2>Ready to unlock your full analysis?</h2>
        <p>Get detailed insights and a personalized growth roadmap.</p>
        <button className={styles.ctaButton}>
          Get Premium — $4.99
        </button>
      </div>
    </div>
  );
}
