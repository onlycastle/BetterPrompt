import { SamplePreviewFrame } from './SamplePreviewFrame';
import styles from './AnalysisPreview.module.css';

export function AnalysisPreview() {
  return (
    <section id="preview" className={styles.section}>
      <SamplePreviewFrame>
        <div className={styles.header}>
          <h2 className={styles.headline}>Sample Report Preview</h2>
          <p className={styles.subheadline}>
            This is what your personalized analysis looks like
          </p>
        </div>

        {/* Hero: Personality Type Card */}
        <div className={styles.typeCard}>
          <div className={styles.typeHeader}>
            <span className={styles.typeEmoji}>🔬</span>
            <div className={styles.typeInfo}>
              <h3 className={styles.typeName}>The Analyst</h3>
              <p className={styles.typeTagline}>Deep investigator who verifies and questions everything</p>
            </div>
          </div>

          <p className={styles.typeDescription}>
            You combine systematic verification with critical thinking to ensure nothing
            slips through the cracks. Your investigative approach catches issues early.
          </p>

          <div className={styles.traitBadges}>
            <span className={styles.traitBadge}>Systematic verification</span>
            <span className={styles.traitBadge}>Critical thinking</span>
            <span className={styles.traitBadge}>Deep investigation</span>
          </div>

          <div className={styles.separator} />

          {/* Style Matrix */}
          <div className={styles.matrixSection}>
            <div className={styles.matrixHeader}>
              <span className={styles.matrixLabel}>STYLE MATRIX</span>
              <div className={styles.matrixControls}>
                <span className={styles.controlBtn}>▼</span>
                <span className={styles.controlBtn}>▲</span>
              </div>
            </div>

            <div className={styles.matrix}>
              <StyleMatrixRow emoji="🏗️" name="The Architect" percent={25} />
              <StyleMatrixRow emoji="🎼" name="The Conductor" percent={10} />
              <StyleMatrixRow emoji="⚡" name="The Speedrunner" percent={15} />
              <StyleMatrixRow emoji="🚀" name="The Trendsetter" percent={15} />
              <StyleMatrixRow
                emoji="🔬"
                name="The Analyst"
                percent={35}
                isPrimary
                expanded
                subLevels={[
                  { name: 'Questioner', percent: 3.5 },
                  { name: 'Research Lead', percent: 28.0, isHighlighted: true },
                  { name: 'Quality Sentinel', percent: 3.5 },
                ]}
              />
            </div>
          </div>

          <div className={styles.sessionsFooter}>
            Based on 15 sessions analyzed
          </div>
        </div>

        {/* Tabs Preview */}
        <div className={styles.tabNav}>
          <button className={styles.tabBtn}>
            <span className={styles.tabIcon}>💬</span> Prompt Patterns
          </button>
          <button className={styles.tabBtn}>
            <span className={styles.tabIcon}>📊</span> Dimension Insights
          </button>
          <button className={`${styles.tabBtn} ${styles.tabActive}`}>
            <span className={styles.tabIcon}>&gt;_</span> AI Agent Insights
          </button>
        </div>

        {/* AI Agent Section */}
        <div className={styles.agentSection}>
          <div className={styles.agentHeader}>
            <span className={styles.agentIcon}>&gt;_</span>
            <h3 className={styles.agentTitle}>AI Agent Insights</h3>
          </div>
          <p className={styles.agentSubtitle}>
            Specialized AI workers analyzed your coding patterns to discover hidden habits
          </p>

          {/* Agent Card */}
          <div className={styles.agentCard}>
            <div className={styles.agentCardHeader}>
              <div className={styles.agentNameSection}>
                <span className={styles.agentCardIcon}>🔍</span>
                <span className={styles.agentName}>Pattern Detective</span>
              </div>
              <div className={styles.scoreGauge}>
                <span className={styles.scoreValue}>98%</span>
                <span className={styles.scoreLabel}>Confidence</span>
              </div>
            </div>

            <div className={styles.insightsBox}>
              <div className={styles.insightsHeader}>
                <span className={styles.sparkle}>✨</span>
                <span className={styles.insightsTitle}>Key Discoveries</span>
              </div>
              <ul className={styles.insightsList}>
                <li className={styles.insightItem}>
                  Your &apos;Zero Trust&apos; verification skill for AI&apos;s logical flaws is exceptional.
                  Despite higher Strategist scores, the choice of Systems Architect shows sharp
                  data-driven insight.
                </li>
                <li className={styles.insightItem}>
                  You design brand &apos;Vibe&apos; beyond simple feature implementation. The &apos;trendsetter
                  spirit&apos; stands out in meticulously refining even ASCII character pin positions.
                </li>
              </ul>
            </div>

            <button className={styles.detailsToggle}>
              Show Details ▼
            </button>
          </div>

          {/* Locked Agent Cards Preview */}
          <div className={styles.lockedAgentsGrid}>
            <LockedAgentTeaser
              icon="⚠️"
              name="Anti-Pattern Spotter"
              score="82/100"
              label="Health Score"
            />
            <LockedAgentTeaser
              icon="📚"
              name="Knowledge Gap"
              score="86/100"
              label="Knowledge Score"
            />
            <LockedAgentTeaser
              icon="⚡"
              name="Context Efficiency"
              score="72/100"
              label="Efficiency Score"
            />
          </div>
        </div>
      </SamplePreviewFrame>
    </section>
  );
}

interface StyleMatrixRowProps {
  emoji: string;
  name: string;
  percent: number;
  isPrimary?: boolean;
  expanded?: boolean;
  subLevels?: Array<{ name: string; percent: number; isHighlighted?: boolean }>;
}

function StyleMatrixRow({ emoji, name, percent, isPrimary, expanded, subLevels }: StyleMatrixRowProps) {
  return (
    <div className={`${styles.matrixRow} ${isPrimary ? styles.matrixRowPrimary : ''}`}>
      <div className={styles.matrixRowHeader}>
        <span className={styles.chevron}>{expanded ? '▾' : '▸'}</span>
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

      {expanded && subLevels && (
        <div className={styles.subLevels}>
          {subLevels.map((level) => (
            <div
              key={level.name}
              className={`${styles.subLevelRow} ${level.isHighlighted ? styles.subLevelHighlighted : ''}`}
            >
              <span className={styles.subLevelIndent}>└</span>
              <span className={`${styles.subLevelName} ${level.isHighlighted ? styles.subLevelNameHighlighted : ''}`}>
                {level.name}
              </span>
              <div className={styles.subBarContainer}>
                <div
                  className={`${styles.subBar} ${level.isHighlighted ? styles.subBarHighlighted : ''}`}
                  style={{ width: `${level.percent * 2.5}%` }}
                />
              </div>
              <span className={`${styles.subLevelPercent} ${level.isHighlighted ? styles.subLevelPercentHighlighted : ''}`}>
                {level.percent.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface LockedAgentTeaserProps {
  icon: string;
  name: string;
  score: string;
  label: string;
}

function LockedAgentTeaser({ icon, name, score, label }: LockedAgentTeaserProps) {
  return (
    <div className={styles.lockedCard}>
      <div className={styles.lockedHeader}>
        <span className={styles.lockedIcon}>{icon}</span>
        <span className={styles.lockedName}>{name}</span>
        <span className={styles.lockIcon}>🔒</span>
      </div>
      <div className={styles.lockedScore}>
        <span className={styles.lockedScoreValue}>{score}</span>
        <span className={styles.lockedScoreLabel}>{label}</span>
      </div>
      <div className={styles.lockedTeaser}>
        <span className={styles.sparkle}>✨</span>
        <span className={styles.lockedTeaserText}>Key Discoveries</span>
      </div>
      <div className={styles.lockedInsight}>
        <div className={styles.blurredText}>
          Your consistent patterns reveal a methodical approach to problem solving...
        </div>
      </div>
      <div className={styles.unlockPrompt}>
        <span className={styles.lockSmall}>🔒</span>
        <span className={styles.unlockText}>+2 more insights (unlock to see)</span>
      </div>
    </div>
  );
}
