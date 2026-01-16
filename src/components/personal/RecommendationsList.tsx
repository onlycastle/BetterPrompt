/**
 * RecommendationsList Component
 * Priority-sorted learning recommendations
 */

import { BookOpen, Video, Dumbbell, GraduationCap, Clock, ExternalLink } from 'lucide-react';
import { Card } from '../ui/Card';
import type { Recommendation, RecommendationType, RecommendationPriority } from '../../types/personal';
import styles from './RecommendationsList.module.css';

export interface RecommendationsListProps {
  recommendations: Recommendation[];
}

const TYPE_ICONS: Record<RecommendationType, React.ReactNode> = {
  article: <BookOpen size={16} />,
  video: <Video size={16} />,
  exercise: <Dumbbell size={16} />,
  course: <GraduationCap size={16} />,
};

const PRIORITY_LABELS: Record<RecommendationPriority, string> = {
  high: 'High Priority',
  medium: 'Medium Priority',
  low: 'Low Priority',
};

export function RecommendationsList({ recommendations }: RecommendationsListProps) {
  const renderRecommendation = (rec: Recommendation) => {
    const priorityClass = `priority-${rec.priority}`;

    return (
      <Card key={rec.id} padding="lg" hover className={styles.recCard}>
        <div className={styles.cardContent}>
          <div className={styles.header}>
            <div className={`${styles.priorityBadge} ${styles[priorityClass]}`}>
              {PRIORITY_LABELS[rec.priority]}
            </div>
            <div className={`${styles.typeBadge} ${styles[rec.type]}`}>
              {TYPE_ICONS[rec.type]}
              <span>{rec.type}</span>
            </div>
          </div>

          <h4 className={styles.title}>{rec.title}</h4>
          <p className={styles.description}>{rec.description}</p>

          <div className={styles.footer}>
            {rec.estimatedMinutes && (
              <div className={styles.duration}>
                <Clock size={14} />
                <span>{rec.estimatedMinutes} min</span>
              </div>
            )}
            {rec.url && (
              <a
                href={rec.url}
                className={styles.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>View</span>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // Sort by priority (high > medium > low)
  const sortedRecommendations = [...recommendations].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <h3 className={styles.sectionTitle}>Recommended for You</h3>
        <p className={styles.subtitle}>
          Personalized learning resources to improve your AI collaboration skills
        </p>
      </div>

      <div className={styles.list}>
        {sortedRecommendations.map(renderRecommendation)}
      </div>
    </div>
  );
}
