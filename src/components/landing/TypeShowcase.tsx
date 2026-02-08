'use client';

import {
  TYPE_METADATA,
  CONTROL_LEVEL_METADATA,
  MATRIX_NAMES,
  type CodingStyleType,
  type AIControlLevel,
} from '@/lib/models/coding-style';
import { useInView } from '@/hooks/useInView';
import styles from './TypeShowcase.module.css';

const typeOrder: CodingStyleType[] = [
  'architect',
  'analyst',
  'conductor',
  'speedrunner',
  'trendsetter',
];

const levelOrder: AIControlLevel[] = ['explorer', 'navigator', 'cartographer'];

const shortTaglines: Record<CodingStyleType, string> = {
  architect: 'Plans before coding',
  analyst: 'Verifies everything',
  conductor: 'Orchestrates AI tools',
  speedrunner: 'Ships fast, fixes later',
  trendsetter: 'Explores cutting-edge',
};

const levelTaglines: Record<AIControlLevel, string> = {
  explorer: 'Discovers through experimentation',
  navigator: 'Balances exploration and planning',
  cartographer: 'Maps territory before advancing',
};

// Representative types for mobile card view
const mobileHighlights: { type: CodingStyleType; level: AIControlLevel }[] = [
  { type: 'architect', level: 'cartographer' },
  { type: 'analyst', level: 'navigator' },
  { type: 'speedrunner', level: 'explorer' },
  { type: 'trendsetter', level: 'navigator' },
];

export function TypeShowcase() {
  const { ref, isInView } = useInView({ threshold: 0.1 });

  return (
    <section id="types" className={styles.section}>
      <div ref={ref} className={`${styles.content} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>
          15 Developer Personalities
        </h2>
        <p className={styles.subheadline}>
          Your unique combination of style and control
        </p>

        {/* Desktop: Dimensional equation */}
        <div className={styles.desktopView}>
          <div className={styles.equation}>
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

            <div className={styles.operator}>×</div>

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

          <div className={styles.equalsSection}>
            <span className={styles.equalsSign}>=</span>
            <span className={styles.equalsText}>15 Unique Types</span>
          </div>

          {/* 5×3 Matrix Grid */}
          <div className={styles.matrixContainer}>
            <div className={styles.matrix}>
              <div className={styles.matrixHeader}>
                <div className={styles.matrixCorner}></div>
                {levelOrder.map((level) => (
                  <div key={level} className={styles.matrixLevelHeader}>
                    {CONTROL_LEVEL_METADATA[level].name}
                  </div>
                ))}
              </div>

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
        </div>

        {/* Mobile: Card list of 4 representative types */}
        <div className={styles.mobileView}>
          <div className={styles.mobileCards}>
            {mobileHighlights.map(({ type, level }) => {
              const typeMeta = TYPE_METADATA[type];
              const matrixName = MATRIX_NAMES[type][level];
              return (
                <div key={`${type}-${level}`} className={styles.mobileCard}>
                  <span className={styles.mobileEmoji}>{typeMeta.emoji}</span>
                  <div className={styles.mobileCardContent}>
                    <span className={styles.mobileFormula}>
                      {typeMeta.name} × {CONTROL_LEVEL_METADATA[level].name}
                    </span>
                    <span className={styles.mobileTypeName}>{matrixName}</span>
                    <span className={styles.mobileTagline}>{shortTaglines[type]}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className={styles.mobileMore}>
            ...and 11 more combinations
          </p>
        </div>

        <p className={styles.note}>
          Which one are you? Run the analysis to find out.
        </p>
      </div>
    </section>
  );
}
