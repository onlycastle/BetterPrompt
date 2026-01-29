/**
 * ResourceBubble Component
 * Displays learning resources for Growth Area cards.
 *
 * Modes:
 * - Default: Speech bubble style positioned next to the card (standalone)
 * - Inline (inline=true): Displays inside the card with a left border separator
 *
 * Free users see 1 resource + locked teaser; paid users see all resources
 */

import type { ParsedResource } from '../../../../lib/models/agent-outputs';
import styles from './ResourceBubble.module.css';

interface ResourceBubbleProps {
  resources: ParsedResource[];
  isPaid: boolean;
  /** When true, displays inline within the card instead of as a speech bubble */
  inline?: boolean;
}

/**
 * Get emoji icon for resource type
 */
function getResourceTypeIcon(type: ParsedResource['type']): string {
  switch (type) {
    case 'docs':
      return '📖';
    case 'tutorial':
      return '🎓';
    case 'course':
      return '📚';
    case 'article':
      return '📄';
    case 'video':
      return '🎬';
    default:
      return '🔗';
  }
}

export function ResourceBubble({ resources, isPaid, inline = false }: ResourceBubbleProps) {
  if (resources.length === 0) return null;

  const visibleResources = isPaid ? resources : resources.slice(0, 1);
  const hiddenCount = resources.length - visibleResources.length;

  const bubbleClassName = inline
    ? `${styles.bubble} ${styles.inlineBubble}`
    : styles.bubble;

  return (
    <div className={bubbleClassName}>
      {/* Speech bubble tail pointing left - hidden in inline mode */}
      {!inline && <div className={styles.bubbleTail} />}

      <div className={styles.bubbleContent}>
        <div className={styles.bubbleHeader}>
          <span className={styles.bubbleIcon}>📚</span>
          <span className={styles.bubbleTitle}>Learn More</span>
        </div>

        <ul className={styles.resourceList}>
          {visibleResources.map((resource, idx) => (
            <li key={idx} className={styles.resourceItem}>
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.resourceLink}
              >
                <span className={styles.resourceIcon}>{getResourceTypeIcon(resource.type)}</span>
                <span className={styles.resourceTopic}>{resource.topic}</span>
                <span className={styles.externalIcon}>↗</span>
              </a>
              <span className={styles.resourceType}>{resource.type}</span>
            </li>
          ))}
        </ul>

        {/* Locked teaser for free users */}
        {!isPaid && hiddenCount > 0 && (
          <div className={styles.lockedTeaser}>
            <span className={styles.lockIcon}>🔒</span>
            <span>
              {hiddenCount} more resource{hiddenCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResourceBubble;
