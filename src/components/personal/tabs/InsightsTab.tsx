/**
 * InsightsTab Component
 * Displays personalized recommendations and growth areas
 * Now includes learning resources matched to growth areas
 */

import { useMemo } from 'react';
import { GrowthAreasSection } from './GrowthAreasSection';
import { RecommendationsList } from '../RecommendationsList';
import { EmptyStatePrompt } from './EmptyStatePrompt';
import type { ParsedResource, AgentOutputs } from '../../../lib/models/agent-outputs';
import type { PersonalAnalytics } from '../../../types/personal';
import type { VerboseAnalysisData, DimensionGrowthArea, DimensionResourceMatch } from '../../../types/verbose';
import styles from './InsightsTab.module.css';

interface InsightsTabProps {
  analytics: PersonalAnalytics | null;
  analysis: VerboseAnalysisData | null;
  agentOutputs?: AgentOutputs;
  isPaid?: boolean;
}

// Valid ParsedResource types for validation
const VALID_RESOURCE_TYPES = new Set(['docs', 'tutorial', 'course', 'article', 'video']);

function isValidResourceType(type: string): type is ParsedResource['type'] {
  return VALID_RESOURCE_TYPES.has(type);
}

export function InsightsTab({ analytics, analysis, agentOutputs, isPaid = false }: InsightsTabProps) {
  // Extract growth areas from dimension insights (memoized to prevent unnecessary recomputation)
  const growthAreas = useMemo<DimensionGrowthArea[]>(() => {
    return analysis?.dimensionInsights
      ?.flatMap((d) => d.growthAreas)
      ?.slice(0, 5) ?? [];
  }, [analysis?.dimensionInsights]);

  // Build resources map from Knowledge Base (Phase 2.75 deterministic matching)
  // Resources are already matched to dimensions, we map them to growth area titles
  const resourcesMap = useMemo(() => {
    const map = new Map<string, ParsedResource[]>();

    if (!analysis?.knowledgeResources || analysis.knowledgeResources.length === 0) {
      return map;
    }

    // Build dimension -> resources lookup
    const dimensionResources = new Map<string, ParsedResource[]>();
    for (const dimMatch of analysis.knowledgeResources) {
      const resources: ParsedResource[] = dimMatch.knowledgeItems
        .filter(item => isValidResourceType(item.contentType))
        .map(item => ({
          topic: item.title,
          type: item.contentType as ParsedResource['type'],
          url: item.sourceUrl,
        }));
      dimensionResources.set(dimMatch.dimension, resources);
    }

    // Match growth areas to dimension resources
    // Each growth area comes from dimensionInsights which has a dimension field
    growthAreas.forEach((area) => {
      // Find the dimension this growth area belongs to
      const parentDimension = analysis.dimensionInsights?.find(
        d => d.growthAreas.some(ga => ga.title === area.title)
      );

      if (parentDimension) {
        const resources = dimensionResources.get(parentDimension.dimension);
        if (resources && resources.length > 0) {
          map.set(area.title, resources.slice(0, 3)); // Limit to 3 per area
        }
      }
    });

    return map;
  }, [analysis?.knowledgeResources, analysis?.dimensionInsights, growthAreas]);

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
