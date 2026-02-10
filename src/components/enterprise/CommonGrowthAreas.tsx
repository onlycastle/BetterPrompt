/**
 * CommonGrowthAreas Component
 * Displays team-level growth areas grouped by worker domain with severity indicators
 */

'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '../ui/Card';
import { pluralizeMembers } from './format-utils';
import type { TeamGrowthAreaAggregate } from '../../types/enterprise';
import styles from './CommonGrowthAreas.module.css';

export interface CommonGrowthAreasProps {
  areas: TeamGrowthAreaAggregate[];
}

const DOMAIN_ORDER = [
  'thinkingQuality',
  'communicationPatterns',
  'learningBehavior',
  'contextEfficiency',
  'sessionOutcome',
] as const;

const DOMAIN_ICONS: Record<string, string> = {
  thinkingQuality: 'TQ',
  communicationPatterns: 'CP',
  learningBehavior: 'LB',
  contextEfficiency: 'CE',
  sessionOutcome: 'SO',
};

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function getDomainIconClass(domain: string): string {
  const classMap: Record<string, string> = {
    thinkingQuality: styles.domainIconTQ,
    communicationPatterns: styles.domainIconCP,
    learningBehavior: styles.domainIconLB,
    contextEfficiency: styles.domainIconCE,
    sessionOutcome: styles.domainIconSO,
  };
  return classMap[domain] ?? '';
}

function getSeverityClass(severity: string): string {
  const classMap: Record<string, string> = {
    critical: styles.severityCritical,
    high: styles.severityHigh,
    medium: styles.severityMedium,
    low: styles.severityLow,
  };
  return classMap[severity] ?? styles.severityLow;
}

export function CommonGrowthAreas({ areas }: CommonGrowthAreasProps) {
  const groupedByDomain = useMemo(() => {
    const groups = new Map<string, TeamGrowthAreaAggregate[]>();

    for (const area of areas) {
      const existing = groups.get(area.domain) ?? [];
      existing.push(area);
      groups.set(area.domain, existing);
    }

    for (const [, groupAreas] of groups) {
      groupAreas.sort((a, b) => {
        const countDiff = b.memberCount - a.memberCount;
        if (countDiff !== 0) return countDiff;
        return (SEVERITY_RANK[b.predominantSeverity] ?? 0) - (SEVERITY_RANK[a.predominantSeverity] ?? 0);
      });
    }

    return DOMAIN_ORDER
      .filter(domain => groups.has(domain))
      .map(domain => ({
        domain,
        label: groups.get(domain)![0].domainLabel,
        areas: groups.get(domain)!,
      }));
  }, [areas]);

  if (areas.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className={styles.empty}>No common growth areas identified</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className={styles.container}>
          {groupedByDomain.map(group => (
            <div key={group.domain} className={styles.domainGroup}>
              <div className={styles.domainHeader}>
                <span className={`${styles.domainIcon} ${getDomainIconClass(group.domain)}`}>
                  {DOMAIN_ICONS[group.domain] ?? '??'}
                </span>
                <span className={styles.domainLabel}>{group.label}</span>
              </div>

              <div className={styles.areaList}>
                {group.areas.map((area, idx) => (
                  <div key={`${area.domain}-${area.title}-${idx}`} className={styles.areaItem}>
                    <div className={styles.areaHeader}>
                      <span className={styles.areaTitle}>{area.title}</span>
                      <span className={`${styles.severityBadge} ${getSeverityClass(area.predominantSeverity)}`}>
                        {area.predominantSeverity}
                      </span>
                    </div>
                    <div className={styles.memberInfo}>
                      <span className={styles.memberCount}>
                        {pluralizeMembers(area.memberCount)} affected
                      </span>
                      {area.affectedMembers.length > 0 && (
                        <span className={styles.memberNames}>
                          ({area.affectedMembers.join(', ')})
                        </span>
                      )}
                    </div>
                    {area.sampleRecommendation && (
                      <p className={styles.recommendation}>{area.sampleRecommendation}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
