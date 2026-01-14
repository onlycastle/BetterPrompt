/**
 * Scroll Navigation Hook
 *
 * Provides smooth scroll navigation for the report viewer with:
 * - IntersectionObserver-based section activation
 * - Terminal tab synchronization
 * - Keyboard shortcuts (arrow keys, j/k, number keys, Home/End)
 *
 * @module hooks/useScrollNavigation
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ScrollNavigationOptions {
  /** ID of the scroll container element */
  containerId?: string;
  /** CSS selector for section elements */
  sectionSelector?: string;
  /** CSS selector for tab elements */
  tabSelector?: string;
  /** Callback when active section changes */
  onSectionChange?: (sectionId: string, index: number) => void;
  /** Enable keyboard navigation (default: true) */
  enableKeyboard?: boolean;
  /** Debounce time for section activation in ms (default: 50) */
  activationDebounce?: number;
  /** Debounce time for keyboard input in ms (default: 100) */
  keyboardDebounce?: number;
}

export interface ScrollNavigationReturn {
  /** Currently active section ID */
  activeSection: string | null;
  /** Currently active section index */
  activeSectionIndex: number;
  /** Scroll to a specific section by ID */
  scrollToSection: (sectionId: string) => void;
  /** Navigate by relative index (positive = forward, negative = backward) */
  navigateByIndex: (delta: number) => void;
  /** Ref to attach to the scroll container */
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook for managing scroll-based navigation in the report viewer.
 *
 * @example
 * ```tsx
 * const {
 *   activeSection,
 *   scrollToSection,
 *   navigateByIndex,
 *   containerRef
 * } = useScrollNavigation({
 *   onSectionChange: (sectionId, index) => {
 *     console.log(`Active section: ${sectionId} (index: ${index})`);
 *   }
 * });
 *
 * return (
 *   <div ref={containerRef} className="scroll-container">
 *     <section data-section="result" data-index="0">...</section>
 *     <section data-section="collaboration" data-index="1">...</section>
 *   </div>
 * );
 * ```
 */
export function useScrollNavigation(
  options: ScrollNavigationOptions = {}
): ScrollNavigationReturn {
  const {
    sectionSelector = '.snap-section',
    tabSelector = '.terminal-tab',
    onSectionChange,
    enableKeyboard = true,
    activationDebounce = 50,
    keyboardDebounce = 100,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number>(0);

  // Refs for debouncing
  const activationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const keyDebounceRef = useRef<boolean>(false);
  const currentSectionRef = useRef<Element | null>(null);

  /**
   * Activate a section and update UI state
   */
  const activateSection = useCallback(
    (section: Element) => {
      if (currentSectionRef.current === section) return;

      const container = containerRef.current;
      if (!container) return;

      // Get all sections
      const sections = container.querySelectorAll(sectionSelector);

      // Update section classes
      sections.forEach((s) => s.classList.remove('in-view'));
      section.classList.add('in-view');
      currentSectionRef.current = section;

      const sectionId = section.getAttribute('data-section') || '';
      const sectionIndex = parseInt(section.getAttribute('data-index') || '0', 10);

      setActiveSection(sectionId);
      setActiveSectionIndex(sectionIndex);

      // Update terminal tabs
      const tabs = document.querySelectorAll(tabSelector);
      tabs.forEach((tab) => {
        const isActive = tab.getAttribute('data-section') === sectionId;
        tab.classList.toggle('active', isActive);
      });

      // Call user callback
      onSectionChange?.(sectionId, sectionIndex);
    },
    [sectionSelector, tabSelector, onSectionChange]
  );

  /**
   * Request activation with debounce
   */
  const requestActivation = useCallback(
    (section: Element) => {
      if (activationTimeoutRef.current) {
        clearTimeout(activationTimeoutRef.current);
      }
      activationTimeoutRef.current = setTimeout(
        () => activateSection(section),
        activationDebounce
      );
    },
    [activateSection, activationDebounce]
  );

  /**
   * Scroll to a section by ID
   */
  const scrollToSection = useCallback(
    (sectionId: string) => {
      const container = containerRef.current;
      if (!container) return;

      const target = container.querySelector(
        `${sectionSelector}[data-section="${sectionId}"]`
      );
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [sectionSelector]
  );

  /**
   * Navigate by relative index
   */
  const navigateByIndex = useCallback(
    (delta: number) => {
      const container = containerRef.current;
      if (!container) return;

      const sections = container.querySelectorAll(sectionSelector);
      const currentIndex = currentSectionRef.current
        ? parseInt(currentSectionRef.current.getAttribute('data-index') || '0', 10)
        : 0;

      const newIndex = Math.max(0, Math.min(sections.length - 1, currentIndex + delta));
      const targetSection = container.querySelector(
        `${sectionSelector}[data-index="${newIndex}"]`
      );

      if (targetSection) {
        const sectionId = targetSection.getAttribute('data-section');
        if (sectionId) {
          scrollToSection(sectionId);
        }
      }
    },
    [sectionSelector, scrollToSection]
  );

  /**
   * Set up IntersectionObserver for section detection
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const sections = container.querySelectorAll(sectionSelector);

    const observerOptions: IntersectionObserverInit = {
      root: container,
      rootMargin: '-10% 0px -80% 0px',
      threshold: [0, 0.1, 0.2],
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.05) {
          requestActivation(entry.target);
        }
      });
    }, observerOptions);

    sections.forEach((section) => {
      sectionObserver.observe(section);
    });

    // Initialize first section
    if (sections.length > 0) {
      activateSection(sections[0]);
    }

    return () => {
      sectionObserver.disconnect();
      if (activationTimeoutRef.current) {
        clearTimeout(activationTimeoutRef.current);
      }
    };
  }, [sectionSelector, requestActivation, activateSection]);

  /**
   * Set up keyboard navigation
   */
  useEffect(() => {
    if (!enableKeyboard) return;

    const container = containerRef.current;
    if (!container) return;

    const sections = container.querySelectorAll(sectionSelector);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // Debounce rapid key presses
      if (keyDebounceRef.current) return;
      keyDebounceRef.current = true;
      setTimeout(() => {
        keyDebounceRef.current = false;
      }, keyboardDebounce);

      // Handle number keys 1-8 for direct section navigation
      const numericIndex = parseInt(e.key, 10);
      if (numericIndex >= 1 && numericIndex <= 8) {
        e.preventDefault();
        const index = numericIndex - 1;
        if (index < sections.length) {
          const targetSection = container.querySelector(
            `${sectionSelector}[data-index="${index}"]`
          );
          const sectionId = targetSection?.getAttribute('data-section');
          if (sectionId) {
            scrollToSection(sectionId);
          }
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          navigateByIndex(1);
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          navigateByIndex(-1);
          break;
        case 'Home':
          e.preventDefault();
          navigateByIndex(-100);
          break;
        case 'End':
          e.preventDefault();
          navigateByIndex(100);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    enableKeyboard,
    keyboardDebounce,
    sectionSelector,
    navigateByIndex,
    scrollToSection,
  ]);

  /**
   * Set up tab click handlers
   */
  useEffect(() => {
    const tabs = document.querySelectorAll(tabSelector);

    const handleTabClick = (e: Event) => {
      const tab = e.currentTarget as HTMLElement;
      const sectionId = tab.getAttribute('data-section');
      if (sectionId) {
        scrollToSection(sectionId);
      }
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', handleTabClick);
    });

    return () => {
      tabs.forEach((tab) => {
        tab.removeEventListener('click', handleTabClick);
      });
    };
  }, [tabSelector, scrollToSection]);

  return {
    activeSection,
    activeSectionIndex,
    scrollToSection,
    navigateByIndex,
    containerRef,
  };
}

/**
 * Apply animation styles to a quote element
 */
function animateQuote(
  el: HTMLElement,
  show: boolean,
  delayIndex: number
): void {
  if (show) {
    el.style.display = 'block';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => {
      el.style.transition = 'all 0.3s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, delayIndex * 50);
  } else {
    el.style.transition = 'all 0.2s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => {
      el.style.display = 'none';
    }, 200);
  }
}

/**
 * Toggle visibility of dimension quotes with animation.
 * Utility function for progressive disclosure.
 *
 * @param quoteWallId - ID of the quote wall container
 * @param isExpanded - Current expansion state
 * @returns New expansion state
 */
export function toggleDimensionQuotes(
  quoteWallId: string,
  isExpanded: boolean
): boolean {
  const wall = document.getElementById(quoteWallId);
  if (!wall) return isExpanded;

  const quotes = wall.querySelectorAll('.quote-card');
  const VISIBLE_COUNT = 3;

  quotes.forEach((quote, idx) => {
    if (idx >= VISIBLE_COUNT) {
      animateQuote(quote as HTMLElement, !isExpanded, idx - VISIBLE_COUNT);
    }
  });

  return !isExpanded;
}

export default useScrollNavigation;
