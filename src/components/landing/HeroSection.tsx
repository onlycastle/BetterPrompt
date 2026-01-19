'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import styles from './HeroSection.module.css';

export function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={styles.content}>
        <h1 className={styles.headline}>
          Are you getting better with AI
          <span className={styles.emDash}>—</span>
          <br className={styles.breakDesktop} />
          or just more dependent?
        </h1>

        <p className={styles.subheadline}>
          Analyze your real conversations to find out
        </p>

        <div className={styles.cta}>
          <Button
            variant="primary"
            size="lg"
            icon={<Download size={20} />}
            onClick={() => {
              // TODO: Connect to desktop app download
            }}
          >
            Download for macOS
          </Button>
        </div>
      </div>
    </section>
  );
}
