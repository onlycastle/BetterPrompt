'use client';

import { Shield, Lock, Terminal } from 'lucide-react';
import { TerminalCommand } from './TerminalCommand';
import styles from './DownloadSection.module.css';

const features = [
  {
    icon: Terminal,
    title: 'Local Scanning',
    description: 'CLI reads your session files locally, no agents on your machine',
  },
  {
    icon: Shield,
    title: 'Secure Analysis',
    description: 'Data encrypted in transit, only insights stored—not raw sessions',
  },
  {
    icon: Lock,
    title: 'No Installation',
    description: 'Run directly with npx, no global install required',
  },
];

export function DownloadSection() {
  return (
    <section className={styles.section} id="download">
      <div className={styles.container}>
        <h2 className={styles.headline}>Try it now</h2>

        <p className={styles.description}>
          Run the CLI to analyze your Claude Code sessions locally.
          Free to scan. Pay only for full insights.
        </p>

        <div className={styles.downloadCard}>
          <TerminalCommand command="npx no-ai-slop" />
        </div>

        <div className={styles.features}>
          {features.map((feature) => (
            <div key={feature.title} className={styles.feature}>
              <div className={styles.featureIcon}>
                <feature.icon size={18} />
              </div>
              <div className={styles.featureContent}>
                <span className={styles.featureTitle}>{feature.title}</span>
                <span className={styles.featureDescription}>
                  {feature.description}
                </span>
              </div>
            </div>
          ))}
        </div>

        <p className={styles.requirements}>
          Requires Node.js 18+ • macOS, Linux, or Windows
        </p>
      </div>
    </section>
  );
}
