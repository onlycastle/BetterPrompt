/**
 * ProjectActivityFeed Component
 * Groups member projects, shows top 5 with expandable "Show more"
 */

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '../ui/Card';
import type { TeamMemberAnalysis } from '../../types/enterprise';
import styles from './ProjectActivityFeed.module.css';

export interface ProjectActivityFeedProps {
  members: TeamMemberAnalysis[];
}

interface AggregatedProject {
  name: string;
  totalSessions: number;
  contributors: { name: string; sessionCount: number; summaryLines: string[] }[];
}

export function ProjectActivityFeed({ members }: ProjectActivityFeedProps) {
  const [showAll, setShowAll] = useState(false);

  const projects = useMemo<AggregatedProject[]>(() => {
    const map = new Map<string, AggregatedProject>();

    for (const m of members) {
      for (const p of m.projects) {
        const existing = map.get(p.projectName) ?? {
          name: p.projectName,
          totalSessions: 0,
          contributors: [],
        };
        existing.totalSessions += p.sessionCount;
        existing.contributors.push({
          name: m.name,
          sessionCount: p.sessionCount,
          summaryLines: p.summaryLines,
        });
        map.set(p.projectName, existing);
      }
    }

    return [...map.values()]
      .sort((a, b) => b.totalSessions - a.totalSessions);
  }, [members]);

  const visible = showAll ? projects : projects.slice(0, 5);
  const hasMore = projects.length > 5;

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {visible.map(project => (
          <Card key={project.name} className={styles.projectCard}>
            <CardContent>
              <div className={styles.projectHeader}>
                <span className={styles.projectName}>{project.name}</span>
                <span className={styles.projectMeta}>
                  {project.contributors.length} {project.contributors.length === 1 ? 'member' : 'members'} &middot; {project.totalSessions} sessions
                </span>
              </div>
              <div className={styles.contributorList}>
                {project.contributors.map(c => (
                  <div key={c.name} className={styles.contributor}>
                    <div className={styles.contributorHeader}>
                      <span className={styles.contributorName}>{c.name}</span>
                      <span className={styles.contributorSessions}>{c.sessionCount} sessions</span>
                    </div>
                    {c.summaryLines.map((line, i) => (
                      <p key={i} className={styles.summaryLine}>{line}</p>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasMore && (
        <button
          className={styles.showMoreBtn}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show less' : `Show ${projects.length - 5} more projects`}
        </button>
      )}
    </div>
  );
}
