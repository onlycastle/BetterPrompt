import { PatternExampleCard } from './PatternExampleCard';
import styles from './AnalysisPreview.module.css';

export function AnalysisPreview() {
  return (
    <section className={styles.section}>
      <h2 className={styles.headline}>Here&apos;s what we find</h2>

      <div className={styles.featuredCard}>
        <PatternExampleCard />
      </div>

      <div className={styles.grid}>
        {/* Card 1: Your Words, Analyzed */}
        <div className={`${styles.card} ${styles.quoteCard}`}>
          <div className={styles.cardLabel}>Your Words, Analyzed</div>
          <div className={styles.quoteBlock}>
            <span className={styles.quote}>
              &quot;Let me think about this before we start...&quot;
            </span>
          </div>
          <div className={styles.tree}>
            <div className={styles.treeLine}>
              <span className={styles.branch}>├─</span>
              <span className={styles.key}>Behavioral Signal:</span>
              <span className={styles.value}>Strategic Planning</span>
            </div>
            <div className={styles.treeLine}>
              <span className={styles.branch}>├─</span>
              <span className={styles.key}>Dimension:</span>
              <span className={styles.value}>AI Collaboration</span>
            </div>
            <div className={styles.treeLine}>
              <span className={styles.branch}>└─</span>
              <span className={styles.key}>Assessment:</span>
              <span className={`${styles.value} ${styles.strength}`}>Strength</span>
            </div>
          </div>
        </div>

        {/* Card 2: Patterns You Didn't Know */}
        <div className={`${styles.card} ${styles.patternCard}`}>
          <div className={styles.cardLabel}>Patterns You Didn&apos;t Know</div>
          <div className={styles.patternName}>
            Pattern: <span className={styles.highlight}>&quot;Verification Loop&quot;</span>
          </div>
          <div className={styles.tree}>
            <div className={styles.treeLine}>
              <span className={styles.branch}>├─</span>
              <span className={styles.key}>Frequency:</span>
              <span className={styles.value}>12 occurrences</span>
            </div>
            <div className={styles.treeLine}>
              <span className={styles.branch}>├─</span>
              <span className={styles.key}>Behavior:</span>
              <span className={styles.value}>Check AI output before committing</span>
            </div>
            <div className={styles.treeLine}>
              <span className={styles.branch}>└─</span>
              <span className={styles.key}>Control Level:</span>
              <span className={`${styles.value} ${styles.master}`}>AI Master signal</span>
            </div>
          </div>
        </div>

        {/* Card 3: 6-Dimension Breakdown */}
        <div className={`${styles.card} ${styles.dimensionCard}`}>
          <div className={styles.cardLabel}>6-Dimension Breakdown</div>
          <div className={styles.dimensions}>
            <DimensionBar label="AI Control" value={80} />
            <DimensionBar label="Context Engineering" value={50} />
            <DimensionBar label="Tool Mastery" value={70} />
            <DimensionBar label="Skill Resilience" value={65} />
            <DimensionBar label="Burnout Risk" value={35} isInverse />
            <DimensionBar label="AI Collaboration" value={85} />
          </div>
        </div>

        {/* Card 4: Your Priority */}
        <div className={`${styles.card} ${styles.priorityCard}`}>
          <div className={styles.cardLabel}>Your Priority</div>
          <div className={styles.priorityTitle}>
            #1 Focus: <span className={styles.highlight}>Context Engineering</span>
          </div>
          <div className={styles.tree}>
            <div className={styles.treeLine}>
              <span className={styles.branch}>├─</span>
              <span className={styles.key}>Why:</span>
              <span className={styles.value}>&quot;Inconsistent application&quot;</span>
            </div>
            <div className={styles.treeLine}>
              <span className={styles.branch}>├─</span>
              <span className={styles.key}>Impact:</span>
              <span className={styles.value}>Faster iteration cycles</span>
            </div>
            <div className={styles.treeLine}>
              <span className={styles.branch}>└─</span>
              <span className={styles.key}>Action:</span>
              <span className={`${styles.value} ${styles.action}`}>Write clear constraints</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DimensionBar({ label, value, isInverse = false }: { label: string; value: number; isInverse?: boolean }) {
  const blocks = 10;
  const filled = Math.round((value / 100) * blocks);

  return (
    <div className={styles.dimensionRow}>
      <span className={styles.dimensionLabel}>{label}</span>
      <div className={styles.barContainer}>
        <span className={`${styles.bar} ${isInverse ? styles.barInverse : ''}`}>
          {'█'.repeat(filled)}
          {'░'.repeat(blocks - filled)}
        </span>
        <span className={styles.percent}>{value}%</span>
      </div>
    </div>
  );
}
