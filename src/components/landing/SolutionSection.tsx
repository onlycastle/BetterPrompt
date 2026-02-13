'use client';

import { Brain, ShieldCheck, TrendingUp } from 'lucide-react';
import { useInView } from '@/hooks/useInView';
import styles from './SolutionSection.module.css';

const features = [
  {
    icon: Brain,
    title: 'Behavior Analysis',
    description:
      'See how you actually use AI \u2014 where you accept blindly, where you verify, and where you get stuck.',
  },
  {
    icon: ShieldCheck,
    title: 'Risk Detection',
    description:
      'Security vulnerabilities. Exposed API keys. Missing authentication. We catch what AI won\u2019t tell you about.',
  },
  {
    icon: TrendingUp,
    title: 'Growth Roadmap',
    description:
      'Personalized recommendations based on your actual sessions. Not generic tips \u2014 specific actions for your workflow.',
  },
];

export function SolutionSection() {
  const { ref, isInView } = useInView({ threshold: 0.15 });

  return (
    <section id="solution" className={styles.section}>
      <div ref={ref} className={`${styles.content} ${isInView ? styles.visible : ''}`}>
        <h2 className={styles.headline}>We review what you can&apos;t</h2>

        <div className={styles.grid}>
          {features.map((feature) => (
            <div key={feature.title} className={styles.card}>
              <div className={styles.iconWrapper}>
                <feature.icon size={24} />
              </div>
              <h3 className={styles.title}>{feature.title}</h3>
              <p className={styles.description}>{feature.description}</p>
            </div>
          ))}
        </div>

        <p className={styles.bottomText}>
          Discover your AI Builder Profile — are you an Architect, Speedrunner,
          or somewhere in between?
        </p>
      </div>
    </section>
  );
}
