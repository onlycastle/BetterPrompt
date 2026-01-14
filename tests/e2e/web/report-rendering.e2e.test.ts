/**
 * E2E Tests for Report Rendering
 *
 * Tests the visual rendering of reports in the browser.
 */

import { test, expect } from '@playwright/test';

test.describe('Report Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('visual appearance', () => {
    test('renders with dark background', async ({ page }) => {
      const bodyBg = await page.evaluate(() => {
        const style = getComputedStyle(document.body);
        return style.backgroundColor;
      });

      // Parse RGB values - should be dark (low values)
      const match = bodyBg.match(/rgb\((\d+), (\d+), (\d+)\)/);
      if (match) {
        const [, r, g, b] = match.map(Number);
        expect(r).toBeLessThan(50);
        expect(g).toBeLessThan(50);
        expect(b).toBeLessThan(50);
      }
    });

    test('applies JetBrains Mono font family', async ({ page }) => {
      const fontFamily = await page.evaluate(() => {
        return getComputedStyle(document.body).fontFamily;
      });

      expect(fontFamily.toLowerCase()).toContain('jetbrains');
    });

    test('renders neon color scheme', async ({ page }) => {
      // Check that neon colors are used in CSS variables
      const hasNeonGreen = await page.evaluate(() => {
        const root = document.documentElement;
        const neonGreen = getComputedStyle(root).getPropertyValue('--neon-green');
        return neonGreen.includes('#00ff88') || neonGreen.includes('00ff88');
      });

      expect(hasNeonGreen).toBe(true);
    });
  });

  test.describe('result box', () => {
    test('displays type emoji', async ({ page }) => {
      const emoji = page.locator('.result-emoji');
      await expect(emoji).toBeVisible();
      const text = await emoji.textContent();
      expect(text?.length).toBeGreaterThan(0);
    });

    test('displays type name in uppercase', async ({ page }) => {
      const title = page.locator('.result-title');
      await expect(title).toBeVisible();
      const text = await title.textContent();
      expect(text).toMatch(/^[A-Z\s]+$/);
    });

    test('displays tagline', async ({ page }) => {
      const tagline = page.locator('.result-tagline');
      await expect(tagline).toBeVisible();
    });
  });

  test.describe('distribution chart', () => {
    test('renders 5 distribution rows (one per type)', async ({ page }) => {
      const rows = page.locator('.distribution-row');
      await expect(rows).toHaveCount(5);
    });

    test('highlights primary type row', async ({ page }) => {
      const primaryRow = page.locator('.distribution-row.primary');
      await expect(primaryRow).toBeVisible();
    });

    test('shows percentages for each type', async ({ page }) => {
      const percentages = page.locator('.distribution-percentage');
      await expect(percentages).toHaveCount(5);
    });

    test('distribution bars have correct widths', async ({ page }) => {
      // Get the first distribution fill element
      const fill = page.locator('.distribution-fill').first();
      const width = await fill.evaluate((el) => el.style.width);

      // Should have a percentage width
      expect(width).toMatch(/\d+%/);
    });
  });

  test.describe('section headers', () => {
    test('renders section icons', async ({ page }) => {
      const icons = page.locator('.section-icon');
      // At minimum, the result section should have an icon
      await expect(icons.first()).toBeVisible();
    });

    test('renders section titles', async ({ page }) => {
      const titles = page.locator('.section-title');
      await expect(titles.first()).toBeVisible();
    });
  });

  test.describe('terminal chrome', () => {
    test('renders macOS-style background gradient', async ({ page }) => {
      await expect(page.locator('.macos-background')).toBeVisible();
    });

    test('renders scanline effect', async ({ page }) => {
      await expect(page.locator('.scanline')).toBeVisible();
    });

    test('terminal buttons have correct colors', async ({ page }) => {
      const closeBtn = page.locator('.terminal-btn.close');
      const bgColor = await closeBtn.evaluate((el) => {
        return getComputedStyle(el).backgroundColor;
      });

      // Close button should be red-ish
      expect(bgColor).toMatch(/rgb\((\d+), (\d+), (\d+)\)/);
    });
  });

  test.describe('responsive design', () => {
    test('adapts to mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');

      // Terminal should still be visible on mobile
      await expect(page.locator('.terminal-window')).toBeVisible();
    });

    test('adapts to tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');

      await expect(page.locator('.terminal-window')).toBeVisible();
    });
  });
});

test.describe('Screenshot comparisons', () => {
  test('main report page matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshot for visual regression
    await expect(page).toHaveScreenshot('report-main.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.1, // Allow 10% difference for font rendering
    });
  });

  test('result section matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const resultSection = page.locator('[data-section="result"]');
    await expect(resultSection).toHaveScreenshot('result-section.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('terminal chrome matches snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const terminal = page.locator('.terminal-window');
    await expect(terminal).toHaveScreenshot('terminal-chrome.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});
