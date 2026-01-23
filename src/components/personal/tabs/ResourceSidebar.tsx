/**
 * ResourceSidebar Component
 *
 * Container for ResourcePreviewCards in the right sidebar.
 * Shows learning resources with rich OG previews.
 *
 * Features:
 * - Free users: 1 resource + locked teaser
 * - Paid users: All resources visible
 * - Notebook sketch style header
 */

'use client';

import type { ParsedResource } from '../../../lib/models/agent-outputs';
import { ResourcePreviewCard } from './ResourcePreviewCard';
import styles from './ResourceSidebar.module.css';

interface ResourceSidebarProps {
  resources: ParsedResource[];
  isPaid: boolean;
}

export function ResourceSidebar({ resources, isPaid }: ResourceSidebarProps) {
  if (resources.length === 0) return null;

  // Free users see only 1 resource
  const visibleResources = isPaid ? resources : resources.slice(0, 1);
  const hiddenCount = resources.length - visibleResources.length;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Learning Resources</h3>

      <div className={styles.cards}>
        {visibleResources.map((resource, idx) => (
          <ResourcePreviewCard key={idx} resource={resource} />
        ))}
      </div>

      {/* Free user teaser */}
      {!isPaid && hiddenCount > 0 && (
        <div className={styles.teaser}>
          <span className={styles.lockIcon}>🔒</span>
          <span className={styles.teaserText}>
            {hiddenCount} more resource{hiddenCount > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}

export default ResourceSidebar;
