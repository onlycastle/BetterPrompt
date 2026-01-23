/**
 * InsightsTab Component
 * Displays personalized recommendations and growth areas
 * Now includes learning resources matched to growth areas
 */

import { useMemo } from 'react';
import { GrowthAreasSection } from './GrowthAreasSection';
import { RecommendationsList } from '../RecommendationsList';
import { EmptyStatePrompt } from './EmptyStatePrompt';
import { parseRecommendedResourcesData, type ParsedResource, type AgentOutputs } from '../../../lib/models/agent-outputs';
import type { PersonalAnalytics } from '../../../types/personal';
import type { VerboseAnalysisData, DimensionGrowthArea } from '../../../types/verbose';
import styles from './InsightsTab.module.css';

interface InsightsTabProps {
  analytics: PersonalAnalytics | null;
  analysis: VerboseAnalysisData | null;
  agentOutputs?: AgentOutputs;
  isPaid?: boolean;
}

export function InsightsTab({ analytics, analysis, agentOutputs, isPaid = false }: InsightsTabProps) {
  // Extract growth areas from dimension insights
  const growthAreas: DimensionGrowthArea[] =
    analysis?.dimensionInsights
      ?.flatMap((d) => d.growthAreas)
      ?.slice(0, 5) ?? [];

  // Build resources map from Knowledge Gap agent output
  // Match resources to growth areas by topic similarity
  const resourcesMap = useMemo(() => {
    const map = new Map<string, ParsedResource[]>();

    if (agentOutputs?.knowledgeGap?.recommendedResourcesData) {
      const allResources = parseRecommendedResourcesData(
        agentOutputs.knowledgeGap.recommendedResourcesData
      );

      // Match resources to growth areas by topic similarity
      growthAreas.forEach((area) => {
        const areaTitle = area.title.toLowerCase();
        const matchingResources = allResources.filter((r) => {
          const resourceTopic = r.topic.toLowerCase();
          // Check if area title contains resource topic or vice versa
          return areaTitle.includes(resourceTopic) ||
            resourceTopic.includes(areaTitle.split(' ')[0]);
        });
        if (matchingResources.length > 0) {
          map.set(area.title, matchingResources);
        }
      });
    }

    return map;
  }, [agentOutputs, growthAreas]);

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
          <GrowthAreasSection areas={growthAreas} isPaid={isPaid} resourcesMap={resourcesMap} />
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
