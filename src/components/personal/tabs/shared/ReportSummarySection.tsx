/**
 * ReportSummarySection Component
 * Shared summary header used by both public (/r/[id]) and dashboard report pages.
 * Renders: TypeResultMinimal + PersonalitySummaryClean
 */

import { useMemo } from 'react';
import { TypeResultMinimal } from '../type-result/TypeResultMinimal';
import { PersonalitySummaryClean } from '../type-result/PersonalitySummaryClean';
import type { VerboseAnalysisData } from '../../../../types/verbose';
import type { AIControlLevel, MatrixDistribution } from '../../../../types/verbose';
import type { AggregatedWorkerInsights } from '../../../../lib/models/worker-insights';
import { MATRIX_NAMES, MATRIX_METADATA, deriveMatrixDistribution } from '../../../../lib/models/coding-style';

import styles from './ReportSummarySection.module.css';

type ReportExperience = 'dashboard' | 'immersive-apple';

interface ReportSummarySectionProps {
  analysis: VerboseAnalysisData;
  workerInsights?: AggregatedWorkerInsights;
  reportId?: string;
  /** Immersive mode: hero viewport layout for TypeResult */
  immersive?: boolean;
  experience?: ReportExperience;
}

export function ReportSummarySection({
  analysis,
  workerInsights,
  reportId,
  immersive,
  experience = 'dashboard',
}: ReportSummarySectionProps) {
  // Derive matrix type (shared by TypeResultMinimal + PersonalitySummaryClean)
  const matrixType = useMemo(() => {
    const controlLevel = analysis.controlLevel ?? 'navigator';
    const controlScore = analysis.controlScore ?? 50;
    const matrix = deriveMatrixDistribution(analysis.distribution, controlLevel, controlScore);
    const levels: AIControlLevel[] = ['cartographer', 'navigator', 'explorer'];
    let dominantLevel: AIControlLevel = controlLevel;
    let maxPct = 0;
    for (const level of levels) {
      const key = `${analysis.primaryType}_${level}` as keyof MatrixDistribution;
      const pct = matrix[key] || 0;
      if (pct > maxPct) { maxPct = pct; dominantLevel = level; }
    }
    return {
      name: MATRIX_NAMES[analysis.primaryType][dominantLevel],
      ...MATRIX_METADATA[analysis.primaryType][dominantLevel],
    };
  }, [analysis.primaryType, analysis.controlLevel, analysis.controlScore, analysis.distribution]);

  return (
    <div
      className={`${styles.summarySection} ${experience === 'immersive-apple' ? styles.immersiveApple : ''}`}
    >
      <TypeResultMinimal
        primaryType={analysis.primaryType}
        distribution={analysis.distribution}
        sessionsAnalyzed={analysis.sessionsAnalyzed}
        controlLevel={analysis.controlLevel}
        controlScore={analysis.controlScore}
        workerInsights={workerInsights}
        immersive={immersive}
      />

      {analysis.personalitySummary && (
        <PersonalitySummaryClean
          summary={analysis.personalitySummary}
          matrixName={matrixType.name}
          matrixEmoji={matrixType.emoji}
          keyStrength={matrixType.keyStrength}
          reportId={reportId}
          primaryType={analysis.primaryType}
          layout={experience === 'immersive-apple' ? 'editorial' : 'card'}
        />
      )}
    </div>
  );
}
