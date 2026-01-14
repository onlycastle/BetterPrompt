/**
 * Tests for Share Section Component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderShareSection, renderDashboardButtons } from '../../../../src/web/sections/share.js';
import { TYPE_METADATA } from '../../../../src/web/types.js';
import { createMockTypeResult } from '../../../utils/helpers.js';
import { parseHTML, containsText, hasClass, countElements } from '../../../utils/html-helpers.js';

describe('renderShareSection', () => {
  const mockResult = createMockTypeResult();
  const meta = TYPE_METADATA.architect;

  describe('without reportId', () => {
    it('returns empty string when no reportId provided', () => {
      const html = renderShareSection(mockResult, meta);
      expect(html).toBe('');
    });

    it('returns empty string when reportId is undefined', () => {
      const html = renderShareSection(mockResult, meta, undefined);
      expect(html).toBe('');
    });
  });

  describe('with reportId', () => {
    const reportId = 'test-123';
    const baseUrl = 'https://nomoreaislop.xyz';

    it('renders share section container', () => {
      const html = renderShareSection(mockResult, meta, reportId, baseUrl);
      expect(hasClass(html, 'share-section')).toBe(true);
    });

    it('renders share title', () => {
      const html = renderShareSection(mockResult, meta, reportId, baseUrl);
      expect(containsText(html, 'Share Your Results')).toBe(true);
    });

    it('renders share subtitle', () => {
      const html = renderShareSection(mockResult, meta, reportId, baseUrl);
      expect(containsText(html, 'Show off your AI coding style')).toBe(true);
    });
  });

  describe('share buttons', () => {
    const reportId = 'share-456';
    const baseUrl = 'https://nomoreaislop.xyz';

    it('renders Twitter/X share button', () => {
      const html = renderShareSection(mockResult, meta, reportId, baseUrl);
      expect(hasClass(html, 'twitter')).toBe(true);
      expect(containsText(html, 'Share on X')).toBe(true);
    });

    it('renders LinkedIn share button', () => {
      const html = renderShareSection(mockResult, meta, reportId, baseUrl);
      expect(hasClass(html, 'linkedin')).toBe(true);
      expect(containsText(html, 'Share on LinkedIn')).toBe(true);
    });

    it('renders copy link button', () => {
      const html = renderShareSection(mockResult, meta, reportId, baseUrl);
      expect(hasClass(html, 'copy')).toBe(true);
      expect(containsText(html, 'Copy Link')).toBe(true);
    });

    it('renders 3 share buttons total', () => {
      const html = renderShareSection(mockResult, meta, reportId, baseUrl);
      expect(countElements(html, '.share-btn')).toBe(3);
    });
  });

  describe('share URL', () => {
    it('generates correct share URL', () => {
      const reportId = 'abc-123';
      const baseUrl = 'https://nomoreaislop.xyz';
      const html = renderShareSection(mockResult, meta, reportId, baseUrl);
      expect(html).toContain(`${baseUrl}/r/${reportId}`);
    });

    it('includes share URL input field', () => {
      const html = renderShareSection(mockResult, meta, 'test-id', 'https://example.com');
      expect(html).toContain('share-url-input');
      expect(html).toContain('https://example.com/r/test-id');
    });
  });

  describe('Twitter share content', () => {
    it('includes type name in tweet', () => {
      const html = renderShareSection(mockResult, meta, 'id', 'https://example.com');
      // URL encoded type name
      expect(html).toContain(encodeURIComponent(meta.name));
    });

    it('includes type emoji in tweet', () => {
      const html = renderShareSection(mockResult, meta, 'id', 'https://example.com');
      expect(html).toContain(encodeURIComponent(meta.emoji));
    });

    it('includes tagline in tweet', () => {
      const html = renderShareSection(mockResult, meta, 'id', 'https://example.com');
      expect(html).toContain(encodeURIComponent(meta.tagline));
    });

    it('includes hashtags in tweet', () => {
      const html = renderShareSection(mockResult, meta, 'id', 'https://example.com');
      expect(html).toContain(encodeURIComponent('#NoMoreAISlop'));
      expect(html).toContain(encodeURIComponent('#AICollaboration'));
    });
  });

  describe('toast notification', () => {
    it('includes toast element', () => {
      const html = renderShareSection(mockResult, meta, 'id', 'https://example.com');
      expect(html).toContain('id="toast"');
      expect(containsText(html, 'Link copied to clipboard')).toBe(true);
    });
  });

  describe('copy script', () => {
    it('includes copyShareUrl function', () => {
      const html = renderShareSection(mockResult, meta, 'id', 'https://example.com');
      expect(html).toContain('function copyShareUrl()');
    });

    it('includes clipboard API usage', () => {
      const html = renderShareSection(mockResult, meta, 'id', 'https://example.com');
      expect(html).toContain('navigator.clipboard.writeText');
    });
  });

  describe('share tracking', () => {
    it('includes tracking endpoint for shares', () => {
      const reportId = 'track-123';
      const baseUrl = 'https://nomoreaislop.xyz';
      const html = renderShareSection(mockResult, meta, reportId, baseUrl);
      expect(html).toContain(`/api/reports/${reportId}/share`);
    });

    it('tracks clipboard shares', () => {
      const html = renderShareSection(mockResult, meta, 'id', 'https://example.com');
      expect(html).toContain("platform: 'clipboard'");
    });
  });
});

describe('renderDashboardButtons', () => {
  beforeEach(() => {
    // Clear env
    delete process.env.NOSLOP_DASHBOARD_URL;
  });

  it('renders dashboard buttons container', () => {
    const html = renderDashboardButtons();
    expect(hasClass(html, 'dashboard-buttons')).toBe(true);
  });

  it('renders My Dashboard button', () => {
    const html = renderDashboardButtons();
    expect(containsText(html, 'My Dashboard')).toBe(true);
  });

  it('renders Enterprise button', () => {
    const html = renderDashboardButtons();
    expect(containsText(html, 'Enterprise')).toBe(true);
  });

  it('renders 2 dashboard buttons', () => {
    const html = renderDashboardButtons();
    expect(countElements(html, '.dashboard-btn')).toBe(2);
  });

  it('uses default URL when env not set', () => {
    const html = renderDashboardButtons();
    expect(html).toContain('http://localhost:5173');
  });

  it('uses custom URL from env', () => {
    process.env.NOSLOP_DASHBOARD_URL = 'https://dashboard.nomoreaislop.xyz';
    const html = renderDashboardButtons();
    expect(html).toContain('https://dashboard.nomoreaislop.xyz');
  });

  it('links to personal dashboard', () => {
    const html = renderDashboardButtons();
    expect(html).toContain('/personal');
  });

  it('links to enterprise dashboard', () => {
    const html = renderDashboardButtons();
    expect(html).toContain('/enterprise');
  });

  describe('button styling', () => {
    it('has gradient background for personal button', () => {
      const html = renderDashboardButtons();
      expect(html).toContain('linear-gradient(135deg, #00d4ff, #ff00ff)');
    });

    it('has gradient background for enterprise button', () => {
      const html = renderDashboardButtons();
      expect(html).toContain('linear-gradient(135deg, #00ff88, #00d4ff)');
    });

    it('includes hover effects', () => {
      const html = renderDashboardButtons();
      expect(html).toContain('onmouseover');
      expect(html).toContain('onmouseout');
    });
  });
});
