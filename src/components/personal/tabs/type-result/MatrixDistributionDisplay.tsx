/**
 * MatrixDistributionDisplay Component
 *
 * Displays 15-bar style distribution (5 types × 3 control levels)
 * Always shows all type groups expanded with matrix names.
 */

import { useMemo, useState, useCallback } from 'react';
import { VERBOSE_TYPE_METADATA } from '../../../../types/verbose';
import type { CodingStyleType, AIControlLevel, TypeDistribution, MatrixDistribution } from '../../../../types/verbose';
import { MATRIX_NAMES, deriveMatrixDistribution } from '../../../../lib/models/coding-style';
import styles from './MatrixDistributionDisplay.module.css';

interface MatrixDistributionDisplayProps {
  /** 5-value type distribution (required) */
  distribution: TypeDistribution;
  /** Primary coding style type */
  primaryType: CodingStyleType;
  /** User's control level */
  controlLevel: AIControlLevel;
  /** Control score (0-100), used to derive matrix distribution if matrixDistribution not provided */
  controlScore?: number;
  /** Optional pre-computed 15-value matrix distribution */
  matrixDistribution?: MatrixDistribution;
  /** Compact mode for smaller displays */
  compact?: boolean;
}

const STYLE_TYPES: CodingStyleType[] = [
  'architect',
  'analyst',
  'conductor',
  'speedrunner',
  'trendsetter',
];

const CONTROL_LEVELS: AIControlLevel[] = [
  'cartographer',
  'navigator',
  'explorer',
];

const CONTROL_LEVEL_LABELS: Record<AIControlLevel, string> = {
  cartographer: 'Cartographer',
  navigator: 'Navigator',
  explorer: 'Explorer',
};

export function MatrixDistributionDisplay({
  distribution,
  primaryType,
  controlLevel,
  controlScore = 50,
  matrixDistribution,
  compact = false,
}: MatrixDistributionDisplayProps) {
  // Derive matrix distribution if not provided
  const matrix = useMemo(() => {
    if (matrixDistribution) {
      return matrixDistribution;
    }
    return deriveMatrixDistribution(distribution, controlLevel, controlScore);
  }, [distribution, controlLevel, controlScore, matrixDistribution]);

  // Find the control level with highest percentage within primaryType
  // This determines "YOU ARE HERE" position based on actual distribution data
  const dominantControlLevel = useMemo(() => {
    if (!matrix) return controlLevel;

    let maxLevel: AIControlLevel = controlLevel;
    let maxPct = 0;

    for (const level of CONTROL_LEVELS) {
      const key = `${primaryType}_${level}` as keyof MatrixDistribution;
      const pct = matrix[key] || 0;
      if (pct > maxPct) {
        maxPct = pct;
        maxLevel = level;
      }
    }

    return maxLevel;
  }, [matrix, primaryType, controlLevel]);

  // Expand/collapse state: primary type always expanded, others collapsed by default
  const [expandedTypes, setExpandedTypes] = useState<Set<CodingStyleType>>(
    () => new Set([primaryType])
  );
  const toggleType = useCallback((type: CodingStyleType) => {
    if (type === primaryType) return;
    setExpandedTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }, [primaryType]);

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>Style Matrix (5×3)</span>
      </div>

      <div className={styles.typeGroups}>
        {STYLE_TYPES.map((type) => {
          const typeMeta = VERBOSE_TYPE_METADATA[type];
          const typePct = distribution[type] || 0;
          const isPrimaryType = type === primaryType;
          const isExpanded = expandedTypes.has(type);

          return (
            <div
              key={type}
              className={`${styles.typeGroup} ${isPrimaryType ? styles.primaryGroup : ''}`}
            >
              {/* Type header row */}
              <div
                className={`${styles.typeHeader} ${!isPrimaryType ? styles.clickable : ''}`}
                {...(!isPrimaryType ? {
                  onClick: () => toggleType(type),
                  role: 'button',
                  tabIndex: 0,
                  onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') toggleType(type); },
                } : {})}
              >
                {!isPrimaryType && (
                  <span className={styles.chevron}>{isExpanded ? '▼' : '▶'}</span>
                )}
                <span className={styles.typeEmoji}>{typeMeta.emoji}</span>
                <span className={styles.typeName}>{typeMeta.name}</span>
                <div className={styles.typeBarContainer}>
                  <div
                    className={styles.typeBar}
                    style={{ width: `${typePct}%` }}
                  />
                </div>
                <span className={styles.typePct}>{typePct}%</span>
                {isPrimaryType && <span className={styles.primaryMarker}>PRIMARY</span>}
              </div>

              {/* Sub-levels (collapsible for non-primary types) */}
              {isExpanded && (
                <div className={styles.subLevels}>
                  {CONTROL_LEVELS.map((level) => {
                    const matrixKey = `${type}_${level}` as keyof MatrixDistribution;
                    const levelPct = matrix[matrixKey] || 0;
                    const matrixName = MATRIX_NAMES[type][level];
                    const isUserPosition = isPrimaryType && level === dominantControlLevel;

                    return (
                      <div
                        key={level}
                        className={`${styles.subLevelRow} ${isUserPosition ? styles.selectedCombo : ''}`}
                      >
                        <span className={styles.subLevelIndent}>└</span>
                        <span className={styles.subLevelName} title={CONTROL_LEVEL_LABELS[level]}>
                          {matrixName}
                        </span>
                        <div className={styles.subLevelBarContainer}>
                          <div
                            className={styles.subLevelBar}
                            style={{ width: `${Math.min(levelPct * 2, 100)}%` }}
                          />
                        </div>
                        <span className={styles.subLevelPct}>{levelPct.toFixed(1)}%</span>
                        {isUserPosition && <span className={styles.youAreHereMarker}>YOU ARE HERE</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MatrixDistributionDisplay;
