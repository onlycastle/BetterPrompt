/**
 * ResourceBubble Component
 * Displays learning resources for Growth Area cards.
 *
 * Modes:
 * - Default: Speech bubble style positioned next to the card (standalone)
 * - Inline (inline=true): Displays inside the card with a left border separator
 *
 * Data-driven UI: No isPaid prop needed.
 * Backend pre-filters resources array (free tier gets 1 resource).
 * Component simply renders what it receives.
 */

import type { ParsedResource } from '../../../../lib/models/agent-outputs';
import styles from './ResourceBubble.module.css';

interface ResourceBubbleProps {
  /** Resources to display (pre-filtered by backend based on tier) */
  resources: ParsedResource[];
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

/**
 * Data-driven UI: Resources array is pre-filtered by backend.
 * Component renders all resources it receives without client-side filtering.
 */
export function ResourceBubble({ resources, inline = false }: ResourceBubbleProps) {
  if (resources.length === 0) return null;

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
          {resources.map((resource, idx) => {
            const isLocked = !resource.url;
            return (
              <li key={idx} className={`${styles.resourceItem} ${isLocked ? styles.lockedItem : ''}`}>
                {isLocked ? (
                  <span className={`${styles.resourceLink} ${styles.lockedLink}`}>
                    <span className={styles.resourceIcon}>{getResourceTypeIcon(resource.type)}</span>
                    <span className={styles.resourceTopic}>{resource.topic}</span>
                    <span className={styles.lockIcon}>&#x1f512;</span>
                  </span>
                ) : (
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
                )}
                <span className={styles.resourceType}>{resource.type}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default ResourceBubble;
