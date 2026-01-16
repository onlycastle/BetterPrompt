/**
 * ReportTab Component
 * Displays the latest analysis report in Notion/Linear style
 */

import { TypeResultMinimal } from './TypeResultMinimal';
import { PersonalitySummaryClean } from './PersonalitySummaryClean';
import { PromptPatternsClean } from './PromptPatternsClean';
import { DimensionInsightsClean } from './DimensionInsightsClean';
import { EmptyStatePrompt } from './EmptyStatePrompt';
import type { VerboseAnalysisData } from '../../../types/verbose';
import styles from './ReportTab.module.css';

interface ReportTabProps {
  analysis: VerboseAnalysisData | null;
  hasAnalysis: boolean;
}

export function ReportTab({ analysis, hasAnalysis }: ReportTabProps) {
  if (!hasAnalysis || !analysis) {
    return <EmptyStatePrompt />;
  }

  return (
    <div className={styles.container}>
      {/* Type Result */}
      <TypeResultMinimal
        primaryType={analysis.primaryType}
        distribution={analysis.distribution}
        sessionsAnalyzed={analysis.sessionsAnalyzed}
      />

      {/* Personality Summary */}
      {analysis.personalitySummary && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Your AI Coding Personality</h3>
          <PersonalitySummaryClean summary={analysis.personalitySummary} />
        </section>
      )}

      {/* Prompt Patterns */}
      {analysis.promptPatterns && analysis.promptPatterns.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Communication Patterns</h3>
          <PromptPatternsClean patterns={analysis.promptPatterns} />
        </section>
      )}

      {/* Dimension Insights */}
      {analysis.dimensionInsights && analysis.dimensionInsights.length > 0 && (
        <section className={styles.section}>
          <DimensionInsightsClean
            insights={analysis.dimensionInsights}
            sessionsAnalyzed={analysis.sessionsAnalyzed}
          />
        </section>
      )}
    </div>
  );
}

export default ReportTab;
