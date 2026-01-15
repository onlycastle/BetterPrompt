import { useState, useCallback } from 'react';
import styles from './DimensionInsights.module.css';

type DimensionName =
  | 'aiCollaboration'
  | 'contextEngineering'
  | 'toolMastery'
  | 'burnoutRisk'
  | 'aiControl'
  | 'skillResilience';

/**
 * NOTE: Evidence is now a string array (just quotes) instead of object array
 * to reduce nesting depth for Gemini API compatibility.
 */
interface DimensionStrength {
  title: string;
  description: string;
  evidence: string[];
}

interface DimensionGrowthArea {
  title: string;
  description: string;
  evidence: string[];
  recommendation: string;
}

interface PerDimensionInsight {
  dimension: DimensionName;
  dimensionDisplayName: string;
  strengths: DimensionStrength[];
  growthAreas: DimensionGrowthArea[];
}

interface DimensionInsightsProps {
  dimensionInsights: PerDimensionInsight[];
  sessionsAnalyzed: number;
  isUnlocked: boolean;
}

interface DimensionConfig {
  color: string;
  bgColor: string;
  icon: string;
}

const DIMENSION_CONFIG: Record<DimensionName, DimensionConfig> = {
  aiCollaboration: {
    color: 'var(--neon-green)',
    bgColor: 'rgba(0, 255, 136, 0.08)',
    icon: '🤝',
  },
  contextEngineering: {
    color: 'var(--neon-cyan)',
    bgColor: 'rgba(0, 212, 255, 0.08)',
    icon: '📐',
  },
  toolMastery: {
    color: '#ff6b35',
    bgColor: 'rgba(255, 107, 53, 0.08)',
    icon: '🛠️',
  },
  burnoutRisk: {
    color: 'var(--neon-red)',
    bgColor: 'rgba(255, 71, 87, 0.08)',
    icon: '🔥',
  },
  aiControl: {
    color: 'var(--neon-purple)',
    bgColor: 'rgba(168, 85, 247, 0.08)',
    icon: '🎮',
  },
  skillResilience: {
    color: 'var(--neon-yellow)',
    bgColor: 'rgba(251, 191, 36, 0.08)',
    icon: '💪',
  },
};

const DEFAULT_CONFIG: DimensionConfig = {
  color: 'var(--text-secondary)',
  bgColor: 'var(--bg-tertiary)',
  icon: '📊',
};

const VISIBLE_COUNT = 2;

function countEvidence<T extends { evidence: string[] }>(items: T[]): number {
  return items.reduce((sum, item) => sum + item.evidence.length, 0);
}

interface QuoteCardProps {
  quote: string;
  config: DimensionConfig;
  isHero?: boolean;
  isHidden?: boolean;
}

function QuoteCard({ quote, config, isHero = false, isHidden = false }: QuoteCardProps) {
  const baseClass = isHero ? styles.heroQuote : styles.regularQuote;
  const className = isHidden ? `${baseClass} ${styles.hidden}` : baseClass;

  return (
    <div
      className={className}
      style={{ '--accent': config.color, '--accent-bg': config.bgColor } as React.CSSProperties}
    >
      {isHero && <div className={styles.heroLabel}>defining moment</div>}
      <p className={styles.quoteText}>"{quote}"</p>
    </div>
  );
}

interface StrengthClusterProps {
  strength: DimensionStrength;
  config: DimensionConfig;
}

function StrengthCluster({ strength, config }: StrengthClusterProps) {
  const [expanded, setExpanded] = useState(false);
  const [heroQuote, ...regularQuotes] = strength.evidence;
  const hiddenCount = Math.max(0, regularQuotes.length - VISIBLE_COUNT);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const accentStyle = { '--accent': config.color, '--accent-bg': config.bgColor } as React.CSSProperties;

  return (
    <div className={styles.strengthCluster}>
      <div className={styles.clusterHeader}>
        <span className={styles.clusterIcon}>✨</span>
        <span className={styles.clusterTitle}>{strength.title}</span>
        <span className={styles.instanceCount} style={accentStyle}>
          {strength.evidence.length} instances
        </span>
      </div>

      <p className={styles.clusterDescription}>{strength.description}</p>

      {heroQuote && <QuoteCard quote={heroQuote} config={config} isHero />}

      <div className={styles.quoteWall}>
        {regularQuotes.map((quote, idx) => (
          <QuoteCard
            key={idx}
            quote={quote}
            config={config}
            isHidden={!expanded && idx >= VISIBLE_COUNT}
          />
        ))}
      </div>

      {hiddenCount > 0 && (
        <button className={styles.showMoreBtn} onClick={toggleExpanded}>
          <span>{expanded ? 'Show less' : 'Show'}</span>
          <span className={styles.moreCount} style={accentStyle}>
            {expanded ? '' : `+${hiddenCount}`}
          </span>
          <span>{expanded ? '' : 'more quotes'}</span>
        </button>
      )}
    </div>
  );
}

interface GrowthClusterProps {
  growth: DimensionGrowthArea;
  isUnlocked: boolean;
}

function GrowthCluster({ growth, isUnlocked }: GrowthClusterProps) {
  const className = isUnlocked ? styles.growthCluster : `${styles.growthCluster} ${styles.blurred}`;

  return (
    <div className={className}>
      <div className={styles.growthHeader}>
        <span className={styles.clusterIcon}>🌱</span>
        <span className={styles.growthTitle}>{growth.title}</span>
        <span className={styles.growthInstanceCount}>{growth.evidence.length} instances</span>
      </div>

      <p className={styles.clusterDescription}>{growth.description}</p>

      <div className={styles.quoteWall}>
        {growth.evidence.map((quote, idx) => (
          <div key={idx} className={styles.growthQuote}>
            <p className={styles.quoteText}>"{quote}"</p>
          </div>
        ))}
      </div>

      <div className={styles.recommendationBox}>
        <div className={styles.recommendationLabel}>
          <span>💡</span>
          <span>Recommendation</span>
        </div>
        <p className={styles.recommendationText}>{growth.recommendation}</p>
      </div>
    </div>
  );
}

interface DimensionCardProps {
  insight: PerDimensionInsight;
  isUnlocked: boolean;
}

function DimensionCard({ insight, isUnlocked }: DimensionCardProps) {
  const config = DIMENSION_CONFIG[insight.dimension] || DEFAULT_CONFIG;
  const totalQuotes = countEvidence(insight.strengths) + countEvidence(insight.growthAreas);
  const accentStyle = { '--accent': config.color, '--accent-bg': config.bgColor } as React.CSSProperties;

  return (
    <article className={styles.dimensionCard} data-dimension={insight.dimension} style={accentStyle}>
      <header className={styles.dimensionHeader}>
        <div className={styles.dimensionTitleGroup}>
          <div className={styles.dimensionIcon}>{config.icon}</div>
          <div>
            <h3 className={styles.dimensionName}>{insight.dimensionDisplayName}</h3>
            <p className={styles.quoteCount}>{totalQuotes} quotes analyzed</p>
          </div>
        </div>
      </header>

      {insight.strengths.length > 0 && (
        <div className={styles.strengthsSection}>
          {insight.strengths.map((strength, idx) => (
            <StrengthCluster key={idx} strength={strength} config={config} />
          ))}
        </div>
      )}

      {insight.growthAreas.length > 0 && (
        <div className={styles.growthSection}>
          {insight.growthAreas.map((growth, idx) => (
            <GrowthCluster key={idx} growth={growth} isUnlocked={isUnlocked} />
          ))}
        </div>
      )}
    </article>
  );
}

/**
 * Dimension insights component for verbose reports
 * Displays strengths with hero quotes and growth areas with recommendations
 */
export function DimensionInsights({
  dimensionInsights,
  sessionsAnalyzed,
  isUnlocked,
}: DimensionInsightsProps) {
  if (!dimensionInsights || dimensionInsights.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>
          <span>📊</span>
          <span>Your AI Coding Dimensions</span>
        </h2>
        <p className={styles.sectionSubtitle}>
          Based on {sessionsAnalyzed} sessions analyzed • Evidence from your actual conversations
        </p>
      </div>
      {dimensionInsights.map((insight, idx) => (
        <DimensionCard key={idx} insight={insight} isUnlocked={isUnlocked} />
      ))}
    </div>
  );
}
