import { BookOpen, FlaskConical, Users } from 'lucide-react';
import styles from './KnowledgeSection.module.css';

const evidence = [
  {
    icon: FlaskConical,
    title: 'VCP Research',
    stat: '60%',
    detail: 'of developers report skill atrophy concerns',
  },
  {
    icon: BookOpen,
    title: 'Anthropic Studies',
    stat: '3x',
    detail: 'improvement with context engineering',
  },
  {
    icon: Users,
    title: 'Community Patterns',
    stat: '10,000+',
    detail: 'sessions analyzed to identify what works',
  },
];

export function KnowledgeSection() {
  return (
    <section className={styles.section}>
      <h2 className={styles.headline}>
        Built on research, not vibes
      </h2>

      <div className={styles.grid}>
        {evidence.map((item) => (
          <div key={item.title} className={styles.card}>
            <div className={styles.iconWrapper}>
              <item.icon size={20} />
            </div>
            <div className={styles.content}>
              <span className={styles.title}>{item.title}</span>
              <span className={styles.stat}>{item.stat}</span>
              <span className={styles.detail}>{item.detail}</span>
            </div>
          </div>
        ))}
      </div>

      <p className={styles.note}>
        Your recommendations are matched to YOUR specific growth areas
      </p>
    </section>
  );
}
