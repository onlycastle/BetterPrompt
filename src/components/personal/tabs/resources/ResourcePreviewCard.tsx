/**
 * ResourcePreviewCard Component
 *
 * Displays a learning resource as a rich preview card with OG metadata.
 * Shows thumbnail, title, and site name fetched from the URL's Open Graph tags.
 *
 * Features:
 * - Loading skeleton while fetching OG data
 * - Fallback icon when no thumbnail available
 * - Notebook sketch style consistent with design system
 */

'use client';

import { useOGMetadata } from '../../../../hooks/useOGMetadata';
import type { ParsedResource } from '../../../../lib/models/agent-outputs';
import styles from './ResourcePreviewCard.module.css';

interface ResourcePreviewCardProps {
  resource: ParsedResource;
}

/**
 * Get emoji icon for resource type (used as fallback when no thumbnail)
 */
function getTypeIcon(type: ParsedResource['type']): string {
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
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function ResourcePreviewCard({ resource }: ResourcePreviewCardProps) {
  const { data: metadata, isLoading } = useOGMetadata(resource.url);

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.card}
    >
      {/* Thumbnail with loading skeleton */}
      <div className={styles.thumbnail}>
        {isLoading ? (
          <div className={styles.skeleton} />
        ) : metadata?.image ? (
          <img
            src={metadata.image}
            alt=""
            className={styles.thumbnailImage}
            loading="lazy"
          />
        ) : (
          <div className={styles.fallbackIcon}>{getTypeIcon(resource.type)}</div>
        )}
      </div>

      {/* Content section */}
      <div className={styles.content}>
        {/* Title - prefer OG title, fallback to topic */}
        <h4 className={styles.title}>
          {metadata?.title || resource.topic}
        </h4>

        {/* Metadata row */}
        <div className={styles.meta}>
          <span className={styles.siteName}>
            {getTypeIcon(resource.type)} {metadata?.siteName || resource.type}
          </span>
          {metadata?.publishedDate && (
            <>
              <span className={styles.separator}>•</span>
              <span className={styles.date}>{formatDate(metadata.publishedDate)}</span>
            </>
          )}
        </div>
      </div>
    </a>
  );
}

export default ResourcePreviewCard;
