'use client';

import { useEffect, useState, useRef } from 'react';
import { track } from '@vercel/analytics';
import { Button } from '@/components/ui/Button';
import { BrandLogo } from './BrandLogo';
import { WaitlistModal, waitlistConfigs } from './WaitlistModal';
import styles from './LandingHeader.module.css';

const SECTIONS = [
  { id: 'preview', label: 'Preview' },
  { id: 'for-teams', label: 'Teams' },
  { id: 'pricing', label: 'Pricing' },
] as const;

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
  const [isWaitlistOpen, setIsWaitlistOpen] = useState(false);
  const trackedSections = useRef(new Set<string>());

  // Track hero visibility — controls background + nav fade-in
  useEffect(() => {
    const heroEl = document.getElementById('hero');
    if (!heroEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  // Track active section for nav highlighting + analytics
  useEffect(() => {
    const sectionEls = SECTIONS.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (sectionEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            if (!trackedSections.current.has(entry.target.id)) {
              trackedSections.current.add(entry.target.id);
              track('scroll_depth', { section: entry.target.id });
            }
          }
        }
      },
      { threshold: 0.3, rootMargin: '-64px 0px 0px 0px' },
    );

    for (const el of sectionEls) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleNavClick = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCtaClick = () => {
    track('cta_click', { location: 'header', type: 'try_it_free' });
    setIsWaitlistOpen(true);
  };

  return (
    <>
      <header
        className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}
        aria-label="Site header"
      >
        <div className={styles.inner}>
          <BrandLogo size="md" />

          <ul className={`${styles.sectionNav} ${scrolled ? styles.navVisible : ''}`}>
            {SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <button
                  className={`${styles.navItem} ${activeId === id ? styles.active : ''}`}
                  onClick={() => handleNavClick(id)}
                  aria-current={activeId === id ? 'true' : undefined}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>

          <div className={styles.ctaWrapper}>
            <Button variant="primary" size="sm" onClick={handleCtaClick}>
              Try It Free
            </Button>
          </div>
        </div>
      </header>
      <WaitlistModal
        isOpen={isWaitlistOpen}
        onClose={() => setIsWaitlistOpen(false)}
        config={waitlistConfigs.free_trial}
      />
    </>
  );
}
