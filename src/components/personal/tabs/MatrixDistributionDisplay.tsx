/**
 * MatrixDistributionDisplay Component
 *
 * Displays 15-bar style distribution (5 types × 3 control levels)
 * with collapsible type groups and matrix names.
 */

import { useState, useMemo } from 'react';
import { VERBOSE_TYPE_METADATA } from '../../../types/verbose';
import type { CodingStyleType, AIControlLevel, TypeDistribution, MatrixDistribution } from '../../../types/verbose';
import { MATRIX_NAMES, deriveMatrixDistribution } from '../../../lib/models/coding-style';
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
  'scientist',
  'collaborator',
  'speedrunner',
  'craftsman',
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
  // Track which type groups are expanded
  const [expandedTypes, setExpandedTypes] = useState<Set<CodingStyleType>>(
    new Set([primaryType]) // Primary type starts expanded
  );

  // Derive matrix distribution if not provided
  const matrix = useMemo(() => {
    if (matrixDistribution) {
      return matrixDistribution;
    }
    return deriveMatrixDistribution(distribution, controlLevel, controlScore);
  }, [distribution, controlLevel, controlScore, matrixDistribution]);

  // Find the highest percentage control level for the primary type
  const primaryTypeHighestLevel = useMemo(() => {
    const levels: AIControlLevel[] = ['cartographer', 'navigator', 'explorer'];
    let maxLevel: AIControlLevel = controlLevel;
    let maxPct = -1;

    for (const level of levels) {
      const matrixKey = `${primaryType}_${level}` as keyof MatrixDistribution;
      const pct = matrix[matrixKey] || 0;
      if (pct > maxPct) {
        maxPct = pct;
        maxLevel = level;
      }
    }

    return maxLevel;
  }, [matrix, primaryType, controlLevel]);

  const toggleExpand = (type: CodingStyleType) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedTypes(new Set(STYLE_TYPES));
  };

  const collapseAll = () => {
    setExpandedTypes(new Set());
  };

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <div className={styles.header}>
        <span className={styles.title}>Style Matrix</span>
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            onClick={expandAll}
            title="Expand all"
          >
            ▼
          </button>
          <button
            className={styles.actionBtn}
            onClick={collapseAll}
            title="Collapse all"
          >
            ▲
          </button>
        </div>
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
              <button
                className={styles.typeHeader}
                onClick={() => toggleExpand(type)}
                aria-expanded={isExpanded}
              >
                <span className={styles.chevron}>
                  {isExpanded ? '▾' : '▸'}
                </span>
                <span className={styles.typeEmoji}>{typeMeta.emoji}</span>
                <span className={styles.typeName}>{typeMeta.name}</span>
                <div className={styles.typeBarContainer}>
                  <div
                    className={styles.typeBar}
                    style={{ width: `${typePct}%` }}
                  />
                </div>
                <span className={styles.typePct}>{typePct}%</span>
              </button>

              {/* Expanded sub-levels */}
              {isExpanded && (
                <div className={styles.subLevels}>
                  {CONTROL_LEVELS.map((level) => {
                    const matrixKey = `${type}_${level}` as keyof MatrixDistribution;
                    const levelPct = matrix[matrixKey] || 0;
                    const matrixName = MATRIX_NAMES[type][level];
                    const isSelectedCombo = isPrimaryType && level === primaryTypeHighestLevel;

                    return (
                      <div
                        key={level}
                        className={`${styles.subLevelRow} ${isSelectedCombo ? styles.selectedCombo : ''}`}
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
