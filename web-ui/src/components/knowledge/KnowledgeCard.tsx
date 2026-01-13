import { Card, CardHeader, CardContent, CardFooter } from '../ui/Card';
import { Badge, PlatformBadge, TierBadge } from '../ui/Badge';
import { ExternalLink, Calendar, User } from 'lucide-react';
import type { KnowledgeItem } from '../../types';
import styles from './KnowledgeCard.module.css';

export interface KnowledgeCardProps {
  item: KnowledgeItem;
  onClick?: () => void;
}

export function KnowledgeCard({ item, onClick }: KnowledgeCardProps) {
  const { title, summary, source, category, relevance, tags, createdAt } = item;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const scorePercent = Math.round(relevance.score * 100);
  const scoreColor =
    scorePercent >= 70 ? 'var(--color-success)' :
    scorePercent >= 50 ? 'var(--color-warning)' :
    'var(--color-text-tertiary)';

  return (
    <Card hover padding="lg" onClick={onClick}>
      <CardHeader>
        <div className={styles.headerTop}>
          <PlatformBadge platform={source.platform as any} />
          {source.credibilityTier && (
            <TierBadge tier={source.credibilityTier} />
          )}
        </div>
        <h3 className={styles.title}>{title}</h3>
      </CardHeader>

      <CardContent>
        <p className={styles.summary}>{summary}</p>

        <div className={styles.meta}>
          {source.author && (
            <span className={styles.metaItem}>
              <User size={14} />
              {source.author}
            </span>
          )}
          <span className={styles.metaItem}>
            <Calendar size={14} />
            {formatDate(createdAt)}
          </span>
          <span className={styles.score} style={{ color: scoreColor }}>
            {scorePercent}%
          </span>
        </div>
      </CardContent>

      <CardFooter>
        <Badge variant="default" size="sm">{category}</Badge>
        {tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="default" size="sm">{tag}</Badge>
        ))}
        {tags.length > 3 && (
          <Badge variant="default" size="sm">+{tags.length - 3}</Badge>
        )}
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.link}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={14} />
        </a>
      </CardFooter>
    </Card>
  );
}
