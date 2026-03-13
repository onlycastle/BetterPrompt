'use client';

import { Button } from '@/components/ui/Button';
import { BrandLogo } from './BrandLogo';
import styles from './LandingFooter.module.css';

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <h2 className={styles.headline}>
          Stop guessing. Start measuring.
        </h2>

        <div className={styles.cta}>
          <a href="https://github.com/onlycastle/BetterPrompt" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="lg" className={styles.ctaButton}>
              View on GitHub
            </Button>
          </a>
          <p className={styles.smallText}>
            Self-hosted. Open source. Your data never leaves your network.
          </p>
        </div>

        <hr className={styles.divider} />

        <div className={styles.bottomRow}>
          <BrandLogo size="sm" />

          <div className={styles.links}>
            <a href="/docs" className={styles.link}>
              <span>Docs</span>
            </a>
            <span className={styles.separator}>&middot;</span>
            <a
              href="https://github.com/onlycastle/BetterPrompt"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              <span>GitHub</span>
            </a>
          </div>
        </div>

        <p className={styles.copyright}>
          &copy; {new Date().getFullYear()} BetterPrompt
        </p>
      </div>
    </footer>
  );
}
