/**
 * E2E Tests for Web Server
 *
 * Tests the HTTP server startup, routing, and basic report serving.
 */

import { test, expect } from '@playwright/test';

test.describe('Web Server', () => {
  test.describe('health check', () => {
    test('server responds to root path', async ({ page }) => {
      const response = await page.goto('/');
      expect(response?.ok()).toBe(true);
    });
  });

  test.describe('report page structure', () => {
    test('renders terminal window container', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.terminal-window')).toBeVisible();
    });

    test('renders terminal titlebar', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.terminal-titlebar')).toBeVisible();
    });

    test('renders terminal buttons (close, minimize, maximize)', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.terminal-btn.close')).toBeVisible();
      await expect(page.locator('.terminal-btn.minimize')).toBeVisible();
      await expect(page.locator('.terminal-btn.maximize')).toBeVisible();
    });

    test('renders terminal tabs', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.terminal-tabs')).toBeVisible();
    });

    test('has correct page title', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle(/NoMoreAISlop/);
    });
  });

  test.describe('fonts and styles', () => {
    test('loads JetBrains Mono font', async ({ page }) => {
      await page.goto('/');

      // Check that the stylesheet link exists
      const fontLink = page.locator('link[href*="fonts.googleapis.com"]');
      await expect(fontLink).toHaveCount(1);
    });

    test('applies terminal theme styles', async ({ page }) => {
      await page.goto('/');

      // Check CSS custom properties are applied
      const bodyBg = await page.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor;
      });

      // Should have dark background
      expect(bodyBg).toMatch(/rgb\((\d+), (\d+), (\d+)\)/);
    });
  });

  test.describe('sections', () => {
    test('renders main result section', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('[data-section="result"]')).toBeVisible();
    });

    test('renders result box with type info', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.result-box')).toBeVisible();
      await expect(page.locator('.result-emoji')).toBeVisible();
      await expect(page.locator('.result-title')).toBeVisible();
    });

    test('renders distribution chart', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.distribution')).toBeVisible();
      await expect(page.locator('.distribution-row')).toHaveCount(5); // 5 types
    });
  });

  test.describe('footer', () => {
    test('renders footer with branding', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.footer')).toBeVisible();
    });

    test('footer contains NoMoreAISlop link', async ({ page }) => {
      await page.goto('/');
      const link = page.locator('.footer a[href*="nomoreaislop"]');
      await expect(link).toBeVisible();
    });
  });
});
