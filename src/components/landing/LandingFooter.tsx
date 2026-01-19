'use client';

import { Download, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import styles from './LandingFooter.module.css';

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <h2 className={styles.headline}>Ready to find out?</h2>

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

        <div className={styles.links}>
          <a
            href="/docs"
            className={styles.link}
          >
            <BookOpen size={16} />
            <span>Documentation</span>
          </a>
        </div>

        <p className={styles.tagline}>
          Open source. Local analysis. Your data stays yours.
        </p>

        <p className={styles.copyright}>
          &copy; {new Date().getFullYear()} NoMoreAISlop
        </p>
      </div>
    </footer>
  );
}
