'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { BrandLogo } from './BrandLogo';
import styles from './LandingHeader.module.css';

const SECTIONS = [
  { id: 'preview', label: 'How It Works' },
  { id: 'for-teams', label: 'Teams' },
  { id: 'trust', label: 'Privacy' },
] as const;

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
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

  // Track active section for nav highlighting
  useEffect(() => {
    const sectionEls = SECTIONS.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (sectionEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            trackedSections.current.add(entry.target.id);
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

  return (
    <header
      className={styles.header}
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
          <a href="https://github.com/onlycastle/BetterPrompt" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
            <Button variant="primary" size="sm">
              GitHub
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}
