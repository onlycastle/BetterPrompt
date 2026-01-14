/**
 * Scroll Navigation Script
 *
 * Provides smooth scroll navigation for the web report with:
 * - Intersection Observer-based section activation
 * - Terminal tab navigation
 * - Keyboard shortcuts (arrow keys, j/k, number keys, Home/End)
 * - Progressive disclosure for dimension quotes
 *
 * @module scroll-navigation
 */

/**
 * Generates the client-side scroll navigation JavaScript code.
 *
 * This function returns a self-executing script that:
 * - Detects which section is currently in view using IntersectionObserver
 * - Syncs terminal tab states with the active section
 * - Handles smooth scrolling between sections
 * - Provides keyboard navigation (arrow keys, vim-style j/k, number shortcuts)
 * - Implements progressive disclosure for dimension quote lists
 *
 * @returns {string} JavaScript code as a string to be injected into the HTML template
 */
export function getScrollScript(): string {
  return `
    (function() {
      const container = document.getElementById('scroll-container');
      const sections = document.querySelectorAll('.snap-section');
      const terminalTabs = document.querySelectorAll('.terminal-tab');

      let currentSection = null;
      let isScrolling = false;
      let activationTimeout = null;
      let keyDebounce = false;

      // Natural scroll detection - activate when section top is near viewport top
      const observerOptions = {
        root: container,
        rootMargin: '-10% 0px -80% 0px',
        threshold: [0, 0.1, 0.2]
      };

      const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.05) {
            requestActivation(entry.target);
          }
        });
      }, observerOptions);

      // Observe all sections
      sections.forEach(section => {
        sectionObserver.observe(section);
      });

      // Debounced activation request
      function requestActivation(section) {
        if (activationTimeout) clearTimeout(activationTimeout);
        activationTimeout = setTimeout(() => activateSection(section), 50);
      }

      // Activate a section
      function activateSection(section) {
        if (currentSection === section) return;

        // Update section classes
        sections.forEach(s => s.classList.remove('in-view'));
        section.classList.add('in-view');
        currentSection = section;

        const sectionId = section.dataset.section;

        // Update terminal tabs (primary navigation)
        terminalTabs.forEach(tab => {
          const isActive = tab.dataset.section === sectionId;
          tab.classList.toggle('active', isActive);
        });
      }

      // Scroll to section
      function scrollToSection(sectionId) {
        const target = document.querySelector('.snap-section[data-section="' + sectionId + '"]');
        if (target) {
          isScrolling = true;
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(() => { isScrolling = false; }, 500);
        }
      }

      // Navigate by index
      function navigateByIndex(delta) {
        const currentIndex = currentSection ? parseInt(currentSection.dataset.index) : 0;
        const newIndex = Math.max(0, Math.min(sections.length - 1, currentIndex + delta));
        const targetSection = document.querySelector('[data-index="' + newIndex + '"]');
        if (targetSection) {
          scrollToSection(targetSection.dataset.section);
        }
      }

      // Terminal tab click handlers (primary navigation)
      terminalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          scrollToSection(tab.dataset.section);
        });
      });

      // Keyboard navigation with debounce
      document.addEventListener('keydown', (e) => {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Debounce rapid key presses
        if (keyDebounce) return;
        keyDebounce = true;
        setTimeout(() => { keyDebounce = false; }, 100);

        switch(e.key) {
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
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7':
          case '8':
            e.preventDefault();
            const index = parseInt(e.key) - 1;
            if (index < sections.length) {
              const targetSection = document.querySelector('[data-index="' + index + '"]');
              if (targetSection) {
                scrollToSection(targetSection.dataset.section);
              }
            }
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
      });

      // Initialize first section
      if (sections.length > 0) {
        activateSection(sections[0]);
      }
    })();

    // Progressive disclosure for dimension quotes
    function toggleDimensionQuotes(quoteWallId, btn, totalQuotes) {
      const wall = document.getElementById(quoteWallId);
      if (!wall) return;

      const quotes = wall.querySelectorAll('.quote-card');
      const isCollapsed = quotes[3] && quotes[3].style.display === 'none';

      if (isCollapsed) {
        // Expand - show all quotes with animation
        quotes.forEach((quote, idx) => {
          if (idx >= 3) {
            quote.style.display = 'block';
            quote.style.opacity = '0';
            quote.style.transform = 'translateY(-8px)';
            setTimeout(() => {
              quote.style.transition = 'all 0.3s ease';
              quote.style.opacity = '1';
              quote.style.transform = 'translateY(0)';
            }, (idx - 3) * 50);
          }
        });
        btn.innerHTML = '<span>Show less</span>';
      } else {
        // Collapse - hide quotes after first 3
        quotes.forEach((quote, idx) => {
          if (idx >= 3) {
            quote.style.transition = 'all 0.2s ease';
            quote.style.opacity = '0';
            quote.style.transform = 'translateY(-8px)';
            setTimeout(() => {
              quote.style.display = 'none';
            }, 200);
          }
        });
        const hiddenCount = totalQuotes - 3;
        btn.innerHTML = '<span>Show</span><span class="count" style="background: rgba(0,255,136,0.1); padding: 2px 6px; border-radius: 4px; color: var(--neon-green);">+' + hiddenCount + '</span><span>more quotes</span>';
      }
    }
  `;
}
