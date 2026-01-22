'use client';

import { useState } from 'react';
import { Download, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { WaitlistModal } from './WaitlistModal';
import styles from './LandingFooter.module.css';

export function LandingFooter() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <h2 className={styles.headline}>Ready to find out?</h2>

        <div className={styles.cta}>
          <Button
            variant="primary"
            size="lg"
            icon={<Download size={20} />}
            onClick={() => setIsModalOpen(true)}
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

      <WaitlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </footer>
  );
}
