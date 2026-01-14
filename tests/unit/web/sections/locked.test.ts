/**
 * Tests for Locked Section Component
 */

import { describe, it, expect } from 'vitest';
import { renderLockedSection } from '../../../../src/web/sections/locked.js';
import { containsText, hasClass } from '../../../utils/html-helpers.js';

describe('renderLockedSection', () => {
  describe('when unlocked', () => {
    it('renders unlock badge', () => {
      const html = renderLockedSection(true);
      expect(containsText(html, 'Full Analysis Unlocked')).toBe(true);
    });

    it('shows sparkle emoji', () => {
      const html = renderLockedSection(true);
      expect(containsText(html, '✨')).toBe(true);
    });

    it('confirms premium access message', () => {
      const html = renderLockedSection(true);
      expect(containsText(html, 'access to all premium features')).toBe(true);
    });

    it('renders dashboard buttons', () => {
      const html = renderLockedSection(true);
      // Dashboard buttons should be present
      expect(hasClass(html, 'locked-section')).toBe(true);
    });
  });

  describe('when locked', () => {
    it('renders paywall title', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'Unlock Full Analysis')).toBe(true);
    });

    it('shows lock emoji', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, '🔒')).toBe(true);
    });

    it('renders description text', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'complete picture of your AI collaboration')).toBe(true);
    });

    it('lists AI Collaboration feature', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'Full AI Collaboration breakdown')).toBe(true);
    });

    it('lists prompt examples feature', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'Best & worst prompt examples')).toBe(true);
    });

    it('lists burnout risk feature', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'Complete burnout risk analysis')).toBe(true);
    });

    it('lists tool mastery feature', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'All tool mastery data')).toBe(true);
    });

    it('lists AI Control feature', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'AI Control Index deep-dive')).toBe(true);
    });

    it('lists Skill Resilience feature', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'Skill Resilience analysis')).toBe(true);
    });

    it('lists peer comparison feature', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'Peer comparison percentiles')).toBe(true);
    });

    it('displays one-time price', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'ONE-TIME: $6.99')).toBe(true);
    });

    it('shows price comparison', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'Less than a coffee')).toBe(true);
    });

    it('mentions PRO option', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'PRO: $9/month')).toBe(true);
    });

    it('includes dashboard CTA', () => {
      const html = renderLockedSection(false);
      expect(containsText(html, 'Track your growth or manage your team')).toBe(true);
    });

    it('has locked-items list', () => {
      const html = renderLockedSection(false);
      expect(hasClass(html, 'locked-items')).toBe(true);
    });

    it('has CTA box', () => {
      const html = renderLockedSection(false);
      expect(hasClass(html, 'cta-box')).toBe(true);
    });
  });
});
