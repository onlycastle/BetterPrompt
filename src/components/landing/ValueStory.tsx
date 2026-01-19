import { FileText, BarChart3, Target } from 'lucide-react';
import styles from './ValueStory.module.css';

const values = [
  {
    icon: FileText,
    title: 'Real Data',
    subtitle: 'Your actual conversations, not a quiz',
    detail: 'We analyze 15-50 quotes from your sessions',
  },
  {
    icon: BarChart3,
    title: 'Deep Analysis',
    subtitle: '6 dimensions, not just a personality type',
    detail: 'AI Control, Context Engineering, Skill Resilience, and more',
  },
  {
    icon: Target,
    title: 'Actionable Growth',
    subtitle: 'Specific priorities, not generic advice',
    detail: 'Your top 3 focus areas with expected impact',
  },
];

export function ValueStory() {
  return (
    <section className={styles.section}>
      <h2 className={styles.headline}>
        We don&apos;t guess. We show you.
      </h2>

      <div className={styles.grid}>
        {values.map((value) => (
          <div key={value.title} className={styles.card}>
            <div className={styles.iconWrapper}>
              <value.icon size={24} />
            </div>
            <h3 className={styles.title}>{value.title}</h3>
            <p className={styles.subtitle}>{value.subtitle}</p>
            <p className={styles.detail}>{value.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
