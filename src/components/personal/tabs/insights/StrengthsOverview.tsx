/**
 * StrengthsOverview - Aggregated strengths from all 5 worker domains
 *
 * Renders every strength across all domains in a flat list with per-card
 * scroll reveal (each card fades in individually as it enters the viewport).
 */

import { useMemo, useEffect, useState } from 'react';
import type { WorkerStrength } from '../../../../lib/models/worker-insights';
import {
  WORKER_DOMAIN_CONFIGS,
  DOMAIN_TO_TRANSLATION_KEY,
  type WorkerDomainConfig,
  applyTranslatedStrengths,
  type AggregatedWorkerInsights,
} from '../../../../lib/models/worker-insights';
import type { TranslatedAgentInsights, UtteranceLookupEntry } from '../../../../lib/models/verbose-evaluation';
import { useScrollReveal } from '../../../../hooks/useScrollReveal';
import { StrengthCard } from './WorkerInsightsSection';
import styles from './StrengthsOverview.module.css';

interface DomainStrength {
  config: WorkerDomainConfig;
  strength: WorkerStrength;
}

interface StrengthsOverviewProps {
  workerInsights?: AggregatedWorkerInsights;
  translatedAgentInsights?: TranslatedAgentInsights;
  utteranceLookup?: UtteranceLookupEntry[];
  onViewContext?: (utteranceId: string) => void;
  /** Immersive mode: strip card frames, increase spacing */
  immersive?: boolean;
}

const INITIAL_VISIBLE_IMMERSIVE = 4;
const INITIAL_VISIBLE_DEFAULT = 6;
const LOAD_BATCH = 4;

function ScrollRevealItem({ children, index }: { children: React.ReactNode; index: number }) {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  return (
    <div
      ref={ref}
      className={styles.revealItem}
      data-visible={isVisible || undefined}
      style={{ transitionDelay: isVisible ? `${Math.min(index, 3) * 80}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}

export function StrengthsOverview({
  workerInsights,
  translatedAgentInsights,
  utteranceLookup,
  onViewContext,
  immersive,
}: StrengthsOverviewProps) {
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
      const translationKey = DOMAIN_TO_TRANSLATION_KEY[config.key] as keyof TranslatedAgentInsights | undefined;
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

  const activeDomainCount = useMemo(
    () => new Set(allStrengths.map((item) => item.config.key)).size,
    [allStrengths]
  );

  const initialVisible = immersive ? INITIAL_VISIBLE_IMMERSIVE : INITIAL_VISIBLE_DEFAULT;
  const [visibleCount, setVisibleCount] = useState(initialVisible);

  useEffect(() => {
    setVisibleCount(initialVisible);
  }, [initialVisible, allStrengths.length]);

  if (allStrengths.length === 0) return null;

  const visibleStrengths = allStrengths.slice(0, visibleCount);
  const hiddenCount = Math.max(allStrengths.length - visibleStrengths.length, 0);
  const canCollapse = visibleStrengths.length > initialVisible;

  return (
    <div className={styles.container} data-immersive={immersive || undefined}>
      <header className={styles.sectionIntro}>
        <h3 className={styles.sectionTitle}>Start Here</h3>
        <p className={styles.sectionCopy}>
          Read the first {Math.min(visibleStrengths.length, initialVisible)} strengths for a quick signal.
          Expand only when you need the full domain-level detail.
        </p>
        <p className={styles.sectionMeta}>
          {allStrengths.length} strengths from {activeDomainCount} domains
        </p>
      </header>

      <div className={styles.list}>
        {visibleStrengths.map((item, idx) => (
          <ScrollRevealItem key={`${item.config.key}-${idx}`} index={idx}>
            <span className={styles.domainBadge}>
              {item.config.icon} {item.config.title}
            </span>
            <StrengthCard
              strength={item.strength}
              utteranceLookup={utteranceLookupMap}
              onViewContext={onViewContext}
              immersive={immersive}
            />
          </ScrollRevealItem>
        ))}
      </div>

      {allStrengths.length > initialVisible && (
        <div className={styles.listControls}>
          {hiddenCount > 0 ? (
            <button
              type="button"
              className={styles.toggleButton}
              onClick={() => setVisibleCount((prev) => Math.min(allStrengths.length, prev + LOAD_BATCH))}
            >
              Show {Math.min(hiddenCount, LOAD_BATCH)} more strengths
            </button>
          ) : (
            <button
              type="button"
              className={styles.toggleButton}
              onClick={() => setVisibleCount(initialVisible)}
              disabled={!canCollapse}
            >
              Collapse list
            </button>
          )}
        </div>
      )}
    </div>
  );
}
