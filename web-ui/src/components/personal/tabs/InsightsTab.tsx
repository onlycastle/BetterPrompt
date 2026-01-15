/**
 * InsightsTab Component
 * Displays personalized recommendations and growth areas
 */

import { GrowthAreasSection } from './GrowthAreasSection';
import { RecommendationsList } from '../RecommendationsList';
import { EmptyStatePrompt } from './EmptyStatePrompt';
import type { PersonalAnalytics } from '../../../types/personal';
import type { VerboseAnalysisData, DimensionGrowthArea } from '../../../types/verbose';
import styles from './InsightsTab.module.css';

interface InsightsTabProps {
  analytics: PersonalAnalytics | null;
  analysis: VerboseAnalysisData | null;
}

export function InsightsTab({ analytics, analysis }: InsightsTabProps) {
  // Extract growth areas from dimension insights
  const growthAreas: DimensionGrowthArea[] =
    analysis?.dimensionInsights
      ?.flatMap((d) => d.growthAreas)
      ?.slice(0, 5) ?? [];

  const hasRecommendations = analytics?.recommendations && analytics.recommendations.length > 0;
  const hasGrowthAreas = growthAreas.length > 0;

  if (!hasRecommendations && !hasGrowthAreas) {
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
      {/* Growth Areas from Analysis */}
      {hasGrowthAreas && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Areas for Growth</h3>
          <p className={styles.sectionDescription}>
            Key opportunities to improve your AI collaboration based on your recent sessions.
          </p>
          <GrowthAreasSection areas={growthAreas} />
        </section>
      )}

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
