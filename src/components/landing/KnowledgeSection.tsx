'use client';

import { BookOpen, FlaskConical, Users } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import styles from './KnowledgeSection.module.css';

const evidence = [
  {
    icon: FlaskConical,
    title: 'VCP Research',
    stat: '60%',
    detail: 'of developers report skill atrophy concerns',
    source: 'https://www.visualcapitalist.com/',
  },
  {
    icon: BookOpen,
    title: 'Anthropic Studies',
    stat: '3x',
    detail: 'improvement with context engineering',
    source: 'https://docs.anthropic.com/',
  },
  {
    icon: Users,
    title: 'Community Patterns',
    stat: '10,000+',
    detail: 'sessions analyzed to identify what works',
    source: null,
  },
];

export function KnowledgeSection() {
  const { ref, isInView } = useInView({ threshold: 0.15 });

  return (
    <section id="knowledge" className={styles.section}>
      <div ref={ref} className={`${styles.content} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>
          Built on research, not vibes
        </h2>

        <div className={styles.grid}>
          {evidence.map((item) => (
            <div key={item.title} className={styles.card}>
              <div className={styles.iconWrapper}>
                <item.icon size={20} />
              </div>
              <div className={styles.cardContent}>
                <span className={styles.title}>{item.title}</span>
                <span className={styles.stat}>{item.stat}</span>
                <span className={styles.detail}>{item.detail}</span>
                {item.source && (
                  <a
                    href={item.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.sourceLink}
                  >
                    View source →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className={styles.note}>
          Your recommendations are matched to YOUR specific growth areas
        </p>
      </div>
    </section>
  );
}
