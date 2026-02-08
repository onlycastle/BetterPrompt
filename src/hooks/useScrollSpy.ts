/**
 * useScrollSpy Hook
 *
 * IntersectionObserver-based hook that detects which section is currently
 * in the viewport. Used by FloatingProgressDots to highlight the active section.
 *
 * Root margin: -20% 0px -70% 0px means the "active zone" is the top 20%-30%
 * of the viewport. A section becomes active when it enters this zone.
 */

import { useState, useEffect, type RefObject } from 'react';

interface UseScrollSpyOptions {
  sectionRefs: Map<string, RefObject<HTMLElement | null>>;
  rootMargin?: string;
}

/**
 * Detects which section is currently visible in the viewport.
 *
 * @param options.sectionRefs - Map of section ID to ref
 * @param options.rootMargin - IntersectionObserver root margin (default: '-20% 0px -70% 0px')
 * @returns The ID of the currently active section, or null
 */
export function useScrollSpy({
  sectionRefs,
  rootMargin = '-20% 0px -70% 0px',
}: UseScrollSpyOptions): string | null {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const elements: { id: string; el: HTMLElement }[] = [];
    for (const [id, ref] of sectionRefs) {
      if (ref.current) {
        elements.push({ id, el: ref.current });
      }
    }

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first intersecting entry (topmost visible section)
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section-id');
            if (sectionId) {
              setActiveSection(sectionId);
            }
          }
        }
      },
      { rootMargin, threshold: 0 },
    );

    for (const { el } of elements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [sectionRefs, rootMargin]);

  return activeSection;
}
