/**
 * ReportTab Component
 * Displays the latest analysis report with tabbed navigation
 */

import { TabbedReportContainer } from './TabbedReportContainer';
import { EmptyStatePrompt } from './EmptyStatePrompt';
import type { VerboseAnalysisData } from '../../../types/verbose';
import styles from './ReportTab.module.css';

interface ReportTabProps {
  analysis: VerboseAnalysisData | null;
  hasAnalysis: boolean;
  /** Whether the user has unlocked premium content */
  isPaid?: boolean;
}

export function ReportTab({ analysis, hasAnalysis, isPaid = false }: ReportTabProps) {
  if (!hasAnalysis || !analysis) {
    return <EmptyStatePrompt />;
  }

  return (
    <div className={styles.container}>
      <TabbedReportContainer
        analysis={analysis}
        agentOutputs={analysis.agentOutputs}
        isPaid={isPaid}
      />
    </div>
  );
}

export default ReportTab;
