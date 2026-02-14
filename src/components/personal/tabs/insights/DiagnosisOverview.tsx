/**
 * DiagnosisOverview - Aggregated growth area diagnoses from all 5 worker domains
 *
 * Renders every growth area across all domains in a flat staggered-reveal list,
 * sorted by severity (critical > high > medium > low). Used in the scrollytelling
 * narrative after the dramatic "but..." NarrativeMoment.
 *
 * Recommendation field remains locked for free tier (handled by GrowthCard internally).
 */

import { useMemo } from 'react';
import type { AggregatedWorkerInsights, WorkerGrowth, ReferencedInsight } from '../../../../lib/models/worker-insights';
import {
  WORKER_DOMAIN_CONFIGS,
  type WorkerDomainConfig,
  applyTranslatedGrowthAreas,
} from '../../../../lib/models/worker-insights';
import { createGrowthKey, type InsightAllocation } from '../../../../lib/utils/insight-deduplication';
import type { TranslatedAgentInsights, UtteranceLookupEntry } from '../../../../lib/models/verbose-evaluation';
import { useScrollReveal } from '../../../../hooks/useScrollReveal';
import { GrowthCard } from './WorkerInsightsSection';
import styles from './DiagnosisOverview.module.css';

const DOMAIN_TO_TRANSLATION_KEY: Partial<Record<keyof AggregatedWorkerInsights, keyof TranslatedAgentInsights>> = {
  thinkingQuality: 'thinkingQuality',
  communicationPatterns: 'communicationPatterns',
  learningBehavior: 'learningBehavior',
  contextEfficiency: 'contextEfficiency',
  sessionOutcome: 'sessionOutcome',
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface DomainGrowth {
  config: WorkerDomainConfig;
  domainKey: string;
  growth: WorkerGrowth;
  /** Original (untranslated) growth for insight allocation key matching */
  originalGrowth: WorkerGrowth;
}

interface DiagnosisOverviewProps {
  workerInsights?: AggregatedWorkerInsights;
  translatedAgentInsights?: TranslatedAgentInsights;
  utteranceLookup?: UtteranceLookupEntry[];
  insightAllocation?: InsightAllocation;
}

export function DiagnosisOverview({
  workerInsights,
  translatedAgentInsights,
  utteranceLookup,
  insightAllocation,
}: DiagnosisOverviewProps) {
  const { ref: containerRef, isVisible } = useScrollReveal({ threshold: 0.05 });

  // Build utterance lookup map
  const utteranceLookupMap = useMemo(() => {
    if (!utteranceLookup?.length) return undefined;
    const map = new Map<string, UtteranceLookupEntry>();
    for (const entry of utteranceLookup) {
      map.set(entry.id, entry);
    }
    return map;
  }, [utteranceLookup]);

  // Flatten all growth areas, apply translations, sort by severity
  const allGrowthAreas = useMemo(() => {
    if (!workerInsights) return [];
    const items: DomainGrowth[] = [];

    for (const config of WORKER_DOMAIN_CONFIGS) {
      const domain = workerInsights[config.key];
      if (!domain?.growthAreas.length) continue;

      // Apply translations
      const translationKey = DOMAIN_TO_TRANSLATION_KEY[config.key];
      const translatedInsight = translationKey ? translatedAgentInsights?.[translationKey] : undefined;
      const translated = applyTranslatedGrowthAreas(
        domain.growthAreas,
        translatedInsight?.growthAreas ?? translatedInsight?.growthAreasData
      );

      for (let i = 0; i < translated.length; i++) {
        items.push({
          config,
          domainKey: config.key,
          growth: translated[i],
          originalGrowth: domain.growthAreas[i],
        });
      }
    }

    // Sort by severity (critical first)
    items.sort((a, b) => {
      const aOrder = SEVERITY_ORDER[a.growth.severity ?? 'low'] ?? 3;
      const bOrder = SEVERITY_ORDER[b.growth.severity ?? 'low'] ?? 3;
      return aOrder - bOrder;
    });

    return items;
  }, [workerInsights, translatedAgentInsights]);

  if (allGrowthAreas.length === 0) return null;

  const getInsight = (item: DomainGrowth): ReferencedInsight | undefined => {
    if (!insightAllocation) return undefined;
    const key = createGrowthKey(item.domainKey, item.originalGrowth.title);
    const allocated = insightAllocation.get(key);
    return allocated ?? undefined;
  };

  return (
    <div ref={containerRef} className={styles.container} data-visible={isVisible || undefined}>
      <div className={styles.list}>
        {allGrowthAreas.map((item, idx) => {
          const insight = getInsight(item);
          return (
            <div
              key={`${item.config.key}-${idx}`}
              className={styles.revealItem}
              style={{ transitionDelay: isVisible ? `${idx * 80}ms` : '0ms' }}
            >
              <span className={styles.domainBadge}>
                {item.config.icon} {item.config.title}
              </span>
              <GrowthCard
                growth={item.growth}
                utteranceLookup={utteranceLookupMap}
                referencedInsights={insight ? [insight] : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
