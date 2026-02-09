/**
 * ResourceSidebar Component
 *
 * Container for ResourcePreviewCards in the right sidebar.
 * Shows learning resources with rich OG previews.
 *
 * Data-driven UI: No isPaid prop needed.
 * Backend pre-filters resources array based on tier.
 * Component renders all resources it receives.
 */

'use client';

import type { ParsedResource } from '../../../../lib/models/agent-outputs';
import { ResourcePreviewCard } from './ResourcePreviewCard';
import styles from './ResourceSidebar.module.css';

interface ResourceSidebarProps {
  /** Resources to display (pre-filtered by backend based on tier) */
  resources: ParsedResource[];
}

/**
 * Data-driven UI: Resources array is pre-filtered by backend.
 * Component renders all resources it receives without client-side filtering.
 */
export function ResourceSidebar({ resources }: ResourceSidebarProps) {
  if (resources.length === 0) return null;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Recommended Reading</h3>
      <p className={styles.subtitle}>Curated for your specific growth areas</p>

      <div className={styles.cards}>
        {resources.map((resource, idx) => (
          <ResourcePreviewCard key={idx} resource={resource} />
        ))}
      </div>
    </div>
  );
}

export default ResourceSidebar;
