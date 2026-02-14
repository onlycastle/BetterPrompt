/**
 * StrengthsOverview - Aggregated strengths from all 5 worker domains
 *
 * Renders every strength across all domains in a flat staggered-reveal list.
 * Used in the scrollytelling narrative flow after the "your shining moments"
 * NarrativeMoment. Each card fades in one by one as the user scrolls.
 */

import { useMemo } from 'react';
import type { AggregatedWorkerInsights, WorkerStrength } from '../../../../lib/models/worker-insights';
import {
  WORKER_DOMAIN_CONFIGS,
  type WorkerDomainConfig,
  applyTranslatedStrengths,
} from '../../../../lib/models/worker-insights';
import type { TranslatedAgentInsights, UtteranceLookupEntry } from '../../../../lib/models/verbose-evaluation';
import { useScrollReveal } from '../../../../hooks/useScrollReveal';
import { StrengthCard } from './WorkerInsightsSection';
import styles from './StrengthsOverview.module.css';

const DOMAIN_TO_TRANSLATION_KEY: Partial<Record<keyof AggregatedWorkerInsights, keyof TranslatedAgentInsights>> = {
  thinkingQuality: 'thinkingQuality',
  communicationPatterns: 'communicationPatterns',
  learningBehavior: 'learningBehavior',
  contextEfficiency: 'contextEfficiency',
  sessionOutcome: 'sessionOutcome',
};

interface DomainStrength {
  config: WorkerDomainConfig;
  strength: WorkerStrength;
}

interface StrengthsOverviewProps {
  workerInsights?: AggregatedWorkerInsights;
  translatedAgentInsights?: TranslatedAgentInsights;
  utteranceLookup?: UtteranceLookupEntry[];
}

export function StrengthsOverview({
  workerInsights,
  translatedAgentInsights,
  utteranceLookup,
}: StrengthsOverviewProps) {
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

  // Flatten all strengths from all domains with translation overlay
  const allStrengths = useMemo(() => {
    if (!workerInsights) return [];
    const items: DomainStrength[] = [];

    for (const config of WORKER_DOMAIN_CONFIGS) {
      const domain = workerInsights[config.key];
      if (!domain?.strengths.length) continue;

      // Apply translations
      const translationKey = DOMAIN_TO_TRANSLATION_KEY[config.key];
      const translatedInsight = translationKey ? translatedAgentInsights?.[translationKey] : undefined;
      const translated = applyTranslatedStrengths(
        domain.strengths,
        translatedInsight?.strengths ?? translatedInsight?.strengthsData
      );

      for (const strength of translated) {
        items.push({ config, strength });
      }
    }

    return items;
  }, [workerInsights, translatedAgentInsights]);

  if (allStrengths.length === 0) return null;

  return (
    <div ref={containerRef} className={styles.container} data-visible={isVisible || undefined}>
      <div className={styles.list}>
        {allStrengths.map((item, idx) => (
          <div
            key={`${item.config.key}-${idx}`}
            className={styles.revealItem}
            style={{ transitionDelay: isVisible ? `${idx * 80}ms` : '0ms' }}
          >
            <span className={styles.domainBadge}>
              {item.config.icon} {item.config.title}
            </span>
            <StrengthCard
              strength={item.strength}
              utteranceLookup={utteranceLookupMap}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
