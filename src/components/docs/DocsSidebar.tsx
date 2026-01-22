'use client';

import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import styles from './DocsSidebar.module.css';

interface Section {
  id: string;
  label: string;
}

interface DocsSidebarProps {
  sections: Section[];
}

export function DocsSidebar({ sections }: DocsSidebarProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id || '');
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0,
      }
    );

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [sections]);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Toggle */}
      <button
        className={styles.mobileToggle}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label={isMobileOpen ? 'Close navigation' : 'Open navigation'}
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
        <span>Navigation</span>
      </button>

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isMobileOpen ? styles.mobileOpen : ''}`}>
        <nav className={styles.nav}>
          <ul className={styles.navList}>
            {sections.map((section) => (
              <li key={section.id}>
                <button
                  className={`${styles.navLink} ${activeSection === section.id ? styles.active : ''}`}
                  onClick={() => handleClick(section.id)}
                >
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className={styles.overlay}
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}
