/**
 * ReportTab Component
 * Displays the latest analysis report with tabbed navigation
 */

import { TabbedReportContainer } from './TabbedReportContainer';
import { EmptyStatePrompt } from '../shared/EmptyStatePrompt';
import type { VerboseAnalysisData } from '../../../../types/verbose';
import styles from './ReportTab.module.css';

interface ReportTabProps {
  analysis: VerboseAnalysisData | null;
  hasAnalysis: boolean;
}

/**
 * Data-driven UI: No isPaid prop needed.
 * Backend pre-filters data based on tier.
 */
export function ReportTab({ analysis, hasAnalysis }: ReportTabProps) {
  if (!hasAnalysis || !analysis) {
    return <EmptyStatePrompt />;
  }

  return (
    <div className={styles.container}>
      <TabbedReportContainer
        analysis={analysis}
        agentOutputs={analysis.agentOutputs}
        analysisMetadata={analysis.analysisMetadata}
      />
    </div>
  );
}

export default ReportTab;
