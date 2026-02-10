/**
 * InsightsTab Component
 * Displays personalized recommendations
 */

import { RecommendationsList } from '../../RecommendationsList';
import { EmptyStatePrompt } from '../shared/EmptyStatePrompt';
import type { PersonalAnalytics } from '../../../../types/personal';
import type { VerboseAnalysisData } from '../../../../types/verbose';
import type { AgentOutputs } from '../../../../lib/models/agent-outputs';
import styles from './InsightsTab.module.css';

interface InsightsTabProps {
  analytics: PersonalAnalytics | null;
  analysis: VerboseAnalysisData | null;
  agentOutputs?: AgentOutputs;
}

/**
 * Data-driven UI: No isPaid prop needed.
 * Backend pre-filters data based on tier.
 */
export function InsightsTab({ analytics }: InsightsTabProps) {
  const hasRecommendations = analytics?.recommendations && analytics.recommendations.length > 0;

  if (!hasRecommendations) {
    return (
      <EmptyStatePrompt
        title="No Insights Yet"
        message="Complete more analyses to receive personalized recommendations and growth insights."
        showCommand={true}
      />
    );
  }

  return (
    <div className={styles.container}>
      {/* Personalized Recommendations */}
      {hasRecommendations && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Recommended Resources</h3>
          <p className={styles.sectionDescription}>
            Curated learning materials to help you level up.
          </p>
          <RecommendationsList recommendations={analytics!.recommendations} />
        </section>
      )}
    </div>
  );
}

export default InsightsTab;
