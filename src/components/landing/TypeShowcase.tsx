import {
  TYPE_METADATA,
  CONTROL_LEVEL_METADATA,
  MATRIX_NAMES,
  type CodingStyleType,
  type AIControlLevel,
} from '@/lib/models/coding-style';
import styles from './TypeShowcase.module.css';

const typeOrder: CodingStyleType[] = [
  'architect',
  'scientist',
  'collaborator',
  'speedrunner',
  'craftsman',
];

const levelOrder: AIControlLevel[] = ['explorer', 'navigator', 'cartographer'];

const shortTaglines: Record<CodingStyleType, string> = {
  architect: 'Plans before coding',
  scientist: 'Verifies everything',
  collaborator: 'Iterates through dialogue',
  speedrunner: 'Ships fast, fixes later',
  craftsman: 'Quality over speed',
};

const levelTaglines: Record<AIControlLevel, string> = {
  explorer: 'Discovers through experimentation',
  navigator: 'Balances exploration and planning',
  cartographer: 'Maps territory before advancing',
};

export function TypeShowcase() {
  return (
    <section className={styles.section}>
      <h2 className={styles.headline}>
        15 Developer Personalities
      </h2>
      <p className={styles.subheadline}>
        Your unique combination of style and control
      </p>

      {/* Dimensional equation: 5 Styles × 3 Levels */}
      <div className={styles.equation}>
        {/* 5 Styles */}
        <div className={styles.dimension}>
          <span className={styles.dimensionLabel}>5 Styles</span>
          <div className={styles.styleGrid}>
            {typeOrder.map((type) => {
              const meta = TYPE_METADATA[type];
              return (
                <div key={type} className={styles.card}>
                  <span className={styles.emoji}>{meta.emoji}</span>
                  <h3 className={styles.name}>{meta.name}</h3>
                  <p className={styles.tagline}>{shortTaglines[type]}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Multiplication symbol */}
        <div className={styles.operator}>×</div>

        {/* 3 Levels */}
        <div className={styles.dimension}>
          <span className={styles.dimensionLabel}>3 Levels</span>
          <div className={styles.levelGrid}>
            {levelOrder.map((level) => {
              const meta = CONTROL_LEVEL_METADATA[level];
              return (
                <div key={level} className={styles.levelCard}>
                  <h3 className={styles.levelName}>{meta.name}</h3>
                  <p className={styles.levelTagline}>{levelTaglines[level]}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Equals sign */}
      <div className={styles.equalsSection}>
        <span className={styles.equalsSign}>=</span>
        <span className={styles.equalsText}>15 Unique Types</span>
      </div>

      {/* 5×3 Matrix Grid */}
      <div className={styles.matrixContainer}>
        <div className={styles.matrix}>
          {/* Header row: empty cell + 3 levels */}
          <div className={styles.matrixHeader}>
            <div className={styles.matrixCorner}></div>
            {levelOrder.map((level) => (
              <div key={level} className={styles.matrixLevelHeader}>
                {CONTROL_LEVEL_METADATA[level].name}
              </div>
            ))}
          </div>

          {/* Data rows: style name + 3 combinations */}
          {typeOrder.map((type) => (
            <div key={type} className={styles.matrixRow}>
              <div className={styles.matrixStyleHeader}>
                <span className={styles.matrixStyleEmoji}>
                  {TYPE_METADATA[type].emoji}
                </span>
                <span className={styles.matrixStyleName}>
                  {TYPE_METADATA[type].name}
                </span>
              </div>
              {levelOrder.map((level) => {
                const matrixName = MATRIX_NAMES[type][level];
                return (
                  <div key={`${type}-${level}`} className={styles.matrixCell}>
                    <span className={styles.matrixCellName}>{matrixName}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className={styles.note}>
        Most developers are a mix. See your full distribution.
      </p>
    </section>
  );
}
