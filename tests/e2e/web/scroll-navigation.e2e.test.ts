/**
 * E2E Tests for Scroll Navigation
 *
 * Tests the tab-based scroll navigation functionality in the report.
 */

import { test, expect } from '@playwright/test';

test.describe('Scroll Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
  });

  test.describe('tab visibility', () => {
    test('displays navigation tabs', async ({ page }) => {
      await expect(page.locator('.terminal-tabs')).toBeVisible();
    });

    test('has at least 2 tabs', async ({ page }) => {
      const tabs = page.locator('.terminal-tab');
      await expect(tabs).toHaveCount(2);
    });

    test('first tab is active by default', async ({ page }) => {
      const firstTab = page.locator('.terminal-tab').first();
      await expect(firstTab).toHaveClass(/active/);
    });
  });

  test.describe('tab interaction', () => {
    test('clicking tab scrolls to corresponding section', async ({ page }) => {
      const secondTab = page.locator('.terminal-tab').nth(1);
      await secondTab.click();

      // Wait for scroll animation
      await page.waitForTimeout(500);

      // Second tab should now be active
      await expect(secondTab).toHaveClass(/active/);
    });

    test('tab becomes active when section is scrolled into view', async ({ page }) => {
      // Scroll to bottom of page
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      // Wait for scroll handler
      await page.waitForTimeout(500);

      // Last tab should be active
      const lastTab = page.locator('.terminal-tab').last();
      await expect(lastTab).toHaveClass(/active/);
    });
  });

  test.describe('snap sections', () => {
    test('renders snap sections for scrolling', async ({ page }) => {
      const snapSections = page.locator('.snap-section');
      await expect(snapSections).toHaveCount(2);
    });

    test('snap sections have data-section attributes', async ({ page }) => {
      const resultSection = page.locator('[data-section="result"]');
      await expect(resultSection).toBeVisible();
    });
  });

  test.describe('scroll container', () => {
    test('has scroll container element', async ({ page }) => {
      await expect(page.locator('.scroll-container, #scroll-container')).toBeVisible();
    });
  });
});
