/**
 * DiagnosisOverview - Aggregated growth area diagnoses from all 5 worker domains
 *
 * Renders every growth area across all domains in a flat list sorted by severity
 * (critical > high > medium > low) with per-card scroll reveal.
 *
 * Recommendation field remains locked for free tier (handled by GrowthCard internally).
 */

import { useMemo, useEffect, useState } from 'react';
import type { WorkerGrowth, ReferencedInsight } from '../../../../lib/models/worker-insights';
import {
  WORKER_DOMAIN_CONFIGS,
  DOMAIN_TO_TRANSLATION_KEY,
  type WorkerDomainConfig,
  type AggregatedWorkerInsights,
  applyTranslatedGrowthAreas,
} from '../../../../lib/models/worker-insights';
import { createGrowthKey, type InsightAllocation } from '../../../../lib/utils/insight-deduplication';
import type { TranslatedAgentInsights, UtteranceLookupEntry } from '../../../../lib/models/verbose-evaluation';
import { useScrollReveal } from '../../../../hooks/useScrollReveal';
import { GrowthCard } from './WorkerInsightsSection';
import styles from './DiagnosisOverview.module.css';

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const INITIAL_VISIBLE_IMMERSIVE = 3;
const INITIAL_VISIBLE_DEFAULT = 5;
const LOAD_BATCH = 3;

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
  onViewContext?: (utteranceId: string) => void;
  /** Immersive mode: strip card frames, increase spacing */
  immersive?: boolean;
  /** Dark background mode for color inversions */
  isDark?: boolean;
}

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

export function DiagnosisOverview({
  workerInsights,
  translatedAgentInsights,
  utteranceLookup,
  insightAllocation,
  onViewContext,
  immersive,
  isDark,
}: DiagnosisOverviewProps) {
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
      const translationKey = DOMAIN_TO_TRANSLATION_KEY[config.key] as keyof TranslatedAgentInsights | undefined;
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

  const initialVisible = immersive ? INITIAL_VISIBLE_IMMERSIVE : INITIAL_VISIBLE_DEFAULT;
  const [visibleCount, setVisibleCount] = useState(initialVisible);

  useEffect(() => {
    setVisibleCount(initialVisible);
  }, [initialVisible, allGrowthAreas.length]);

  const severitySummary = useMemo(() => {
    const summary = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const item of allGrowthAreas) {
      const key = item.growth.severity ?? 'low';
      if (key in summary) {
        summary[key as keyof typeof summary] += 1;
      }
    }
    return summary;
  }, [allGrowthAreas]);

  const visibleGrowthAreas = allGrowthAreas.slice(0, visibleCount);
  const hiddenCount = Math.max(allGrowthAreas.length - visibleGrowthAreas.length, 0);
  const canCollapse = visibleGrowthAreas.length > initialVisible;

  if (allGrowthAreas.length === 0) return null;

  const getInsight = (item: DomainGrowth): ReferencedInsight | undefined => {
    if (!insightAllocation) return undefined;
    const key = createGrowthKey(item.domainKey, item.originalGrowth.title);
    const allocated = insightAllocation.get(key);
    return allocated ?? undefined;
  };

  return (
    <div className={styles.container} data-immersive={immersive || undefined} data-dark={isDark || undefined}>
      <header className={styles.sectionIntro}>
        <h3 className={styles.sectionTitle}>Read in Severity Order</h3>
        <p className={styles.sectionCopy}>
          Start from critical and high items first. The initial list is intentionally short so you can
          act before diving into every diagnosis.
        </p>
        <div className={styles.severitySummary}>
          {(['critical', 'high', 'medium', 'low'] as const).map((severity) => {
            const count = severitySummary[severity];
            if (count === 0) return null;
            return (
              <span key={severity} className={styles.severityChip} data-severity={severity}>
                {severity} {count}
              </span>
            );
          })}
        </div>
      </header>

      <div className={styles.list}>
        {visibleGrowthAreas.map((item, idx) => {
          const insight = getInsight(item);
          return (
            <ScrollRevealItem key={`${item.config.key}-${idx}`} index={idx}>
              <span className={styles.domainBadge}>
                {item.config.icon} {item.config.title}
              </span>
              <GrowthCard
                growth={item.growth}
                utteranceLookup={utteranceLookupMap}
                referencedInsights={insight ? [insight] : undefined}
                onViewContext={onViewContext}
                immersive={immersive}
                isDark={isDark}
              />
            </ScrollRevealItem>
          );
        })}
      </div>

      {allGrowthAreas.length > initialVisible && (
        <div className={styles.listControls}>
          {hiddenCount > 0 ? (
            <button
              type="button"
              className={styles.toggleButton}
              onClick={() => setVisibleCount((prev) => Math.min(allGrowthAreas.length, prev + LOAD_BATCH))}
            >
              Show {Math.min(hiddenCount, LOAD_BATCH)} more diagnoses
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
