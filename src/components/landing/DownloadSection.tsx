'use client';

import Image from 'next/image';
import { Download, Shield, RefreshCw, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TerminalCommand } from './TerminalCommand';
import styles from './DownloadSection.module.css';

const features = [
  {
    icon: Terminal,
    title: 'Local Analysis',
    description: 'Your session logs never leave your machine during scanning',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'Data processed securely, nothing stored on our servers',
  },
  {
    icon: RefreshCw,
    title: 'Auto Updates',
    description: 'Always stay up to date with the latest features',
  },
];

// Get the latest release download URL
// In production, this would come from GitHub Releases API
const DOWNLOAD_URL = 'https://github.com/sungmancho/nomoreaislop/releases/latest';

export function DownloadSection() {
  const handleDownload = () => {
    window.open(DOWNLOAD_URL, '_blank');
  };

  return (
    <section className={styles.section} id="download">
      <div className={styles.container}>
        <h2 className={styles.headline}>Get the desktop app</h2>

        <p className={styles.description}>
          Download the macOS app to analyze your Claude Code sessions locally.
          Free to scan. Pay only for full insights.
        </p>

        <div className={styles.downloadCard}>
          <div className={styles.appInfo}>
            <div className={styles.appIcon}>
              <Image
                src="/images/logo.png"
                alt="NoMoreAISlop"
                width={64}
                height={64}
              />
            </div>
            <div className={styles.appDetails}>
              <span className={styles.appName}>NoMoreAISlop</span>
              <span className={styles.appVersion}>macOS • Universal</span>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            icon={<Download size={20} />}
            onClick={handleDownload}
          >
            Download for macOS
          </Button>

          <div className={styles.divider}>
            <span className={styles.dividerLine} />
            <span className={styles.dividerText}>or use the CLI</span>
            <span className={styles.dividerLine} />
          </div>

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
          Requires macOS 11.0 or later • Intel &amp; Apple Silicon
        </p>
      </div>
    </section>
  );
}
