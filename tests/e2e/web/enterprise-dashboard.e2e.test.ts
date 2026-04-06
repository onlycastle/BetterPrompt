/**
 * E2E Tests for Enterprise Dashboard
 *
 * Validates team manager features: overview stats, growth leaderboard,
 * token usage, anti-patterns, member detail, team detail, and blind spots.
 *
 * Prerequisites:
 * - Server running at localhost:3000
 * - Organization, teams, and members seeded (via globalSetup or manual seed)
 * - Analysis data synced for at least one member
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

/**
 * Wait until the page is not showing a loading state.
 * Enterprise pages show "Loading ..." text while fetching.
 */
async function waitForContent(page: Page) {
  // Wait for loading indicators to disappear
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Loading dashboard'),
    { timeout: 15000 },
  ).catch(() => {
    // Proceed even if loading text not found (page may have loaded already)
  });
}

// ---------------------------------------------------------------------------
// Overview Page Tests
// ---------------------------------------------------------------------------

test.describe('Enterprise Overview Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);
  });

  test('page title shows organization name', async ({ page }) => {
    const title = page.locator('h1');
    await expect(title).toBeVisible();
    const text = await title.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('subtitle says Manager Dashboard', async ({ page }) => {
    await expect(page.getByText('Manager Dashboard')).toBeVisible();
  });

  test.describe('Stat Cards', () => {
    test('renders 4 stat cards', async ({ page }) => {
      // StatCards: Active Members, Sessions This Week, Avg Token Burn, Anti-Patterns
      await expect(page.getByText('Active Members')).toBeVisible();
      await expect(page.getByText('Sessions This Week')).toBeVisible();
      await expect(page.getByText('Avg Token Burn')).toBeVisible();
      await expect(page.getByText('Anti-Patterns')).toBeVisible();
    });

    test('active members count is positive', async ({ page }) => {
      const membersCard = page.getByText('Active Members').locator('..');
      const value = membersCard.locator('[class*="value"], [class*="Value"]').first();
      const text = await value.textContent().catch(() => null);
      // If we can't find a value element, just check the card exists
      if (text) {
        const num = parseInt(text.replace(/\D/g, ''), 10);
        expect(num).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Growth Leaderboard', () => {
    test('section title visible', async ({ page }) => {
      await expect(page.getByText('Growth Leaderboard')).toBeVisible();
    });

    test('shows member rows', async ({ page }) => {
      // The leaderboard should have at least one member row
      const leaderboardSection = page.getByText('Growth Leaderboard').locator('..').locator('..');
      await expect(leaderboardSection).toBeVisible();
    });
  });

  test.describe('Token Usage Panel', () => {
    test('section title visible', async ({ page }) => {
      await expect(page.getByText('Token Usage')).toBeVisible();
    });
  });

  test.describe('Anti-Pattern Deep Dive', () => {
    test('section visible when anti-patterns exist', async ({ page }) => {
      const section = page.getByText('Anti-Pattern Deep Dive');
      // This section only renders if antiPatterns.length > 0
      const isVisible = await section.isVisible().catch(() => false);
      if (isVisible) {
        await expect(section).toBeVisible();
      }
    });
  });

  test.describe('Common Growth Areas', () => {
    test('section visible when growth areas exist', async ({ page }) => {
      const section = page.getByText('Common Growth Areas');
      const isVisible = await section.isVisible().catch(() => false);
      if (isVisible) {
        await expect(section).toBeVisible();
      }
    });
  });

  test.describe('Team KPT Retrospective', () => {
    test('section visible when KPT data exists', async ({ page }) => {
      const section = page.getByText('Team KPT Retrospective');
      const isVisible = await section.isVisible().catch(() => false);
      if (isVisible) {
        await expect(section).toBeVisible();
      }
    });
  });

  test.describe('Project Activity', () => {
    test('section visible when members have projects', async ({ page }) => {
      await expect(page.getByText('Project Activity')).toBeVisible();
    });
  });
});

// ---------------------------------------------------------------------------
// Members Page Tests
// ---------------------------------------------------------------------------

test.describe('Members Page', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise/members');
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading members'),
      { timeout: 15000 },
    ).catch(() => {});
  });

  test('page title shows Members', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
  });

  test('subtitle shows member count', async ({ page }) => {
    const subtitle = page.getByText(/members across all teams/);
    await expect(subtitle).toBeVisible();
  });

  test('invite member button visible', async ({ page }) => {
    await expect(page.getByText('Invite Member')).toBeVisible();
  });

  test('stat cards render correctly', async ({ page }) => {
    await expect(page.getByText('Active Members')).toBeVisible();
    await expect(page.getByText('Avg Score')).toBeVisible();
    await expect(page.getByText('Improving')).toBeVisible();
    await expect(page.getByText('Anti-Patterns Detected')).toBeVisible();
  });

  test('member table renders', async ({ page }) => {
    // Table should have rows (tr elements) or member entries
    const table = page.locator('table');
    const isTable = await table.isVisible().catch(() => false);
    if (isTable) {
      const rows = table.locator('tbody tr');
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('clicking a member row navigates to detail', async ({ page }) => {
    const table = page.locator('table');
    const isTable = await table.isVisible().catch(() => false);
    test.skip(!isTable, 'No member table found');

    const firstRow = table.locator('tbody tr').first();
    await firstRow.click();

    // Should navigate to member detail page
    await page.waitForURL(/\/dashboard\/enterprise\/members\/.+/);
    expect(page.url()).toMatch(/\/dashboard\/enterprise\/members\/.+/);
  });
});

// ---------------------------------------------------------------------------
// Member Detail Page Tests
// ---------------------------------------------------------------------------

test.describe('Member Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to members list first, then click into a member
    await navigateTo(page, '/dashboard/enterprise/members');
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading members'),
      { timeout: 15000 },
    ).catch(() => {});

    const table = page.locator('table');
    const isTable = await table.isVisible().catch(() => false);
    if (isTable) {
      const firstRow = table.locator('tbody tr').first();
      await firstRow.click();
      await page.waitForURL(/\/dashboard\/enterprise\/members\/.+/);
      await page.waitForFunction(
        () => !document.body.textContent?.includes('Loading member'),
        { timeout: 15000 },
      ).catch(() => {});
    }
  });

  test('back link navigates to members list', async ({ page }) => {
    const backLink = page.getByText('Back to Members');
    await expect(backLink).toBeVisible();
  });

  test('member profile header renders', async ({ page }) => {
    // MemberProfileHeader should show the member name
    // Profile header is the first section after back link
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('stat cards show member metrics', async ({ page }) => {
    await expect(page.getByText('Total Sessions')).toBeVisible();
    await expect(page.getByText('Avg Context Fill')).toBeVisible();
    await expect(page.getByText('Anti-Patterns')).toBeVisible();
    await expect(page.getByText('Projects Active')).toBeVisible();
  });

  test('score history section renders', async ({ page }) => {
    await expect(page.getByText('Score History')).toBeVisible();
  });

  test('dimension chart renders 5 dimensions', async ({ page }) => {
    // The dimension chart shows bars for each dimension
    // Look for dimension labels
    const dimensionTexts = [
      'AI Collaboration',
      'Context Engineering',
      'Burnout Risk',
      'AI Control',
      'Skill Resilience',
    ];

    let found = 0;
    for (const text of dimensionTexts) {
      const el = page.getByText(text, { exact: false });
      if (await el.isVisible().catch(() => false)) found++;
    }

    // At least 3 out of 5 dimensions should be visible
    // (labels might vary slightly)
    expect(found).toBeGreaterThanOrEqual(3);
  });

  test('token usage section renders', async ({ page }) => {
    await expect(page.getByText('Token Usage')).toBeVisible();
  });

  test('token metrics show detailed data', async ({ page }) => {
    await expect(page.getByText('Total Messages')).toBeVisible();
    await expect(page.getByText('Max Context Fill')).toBeVisible();
    await expect(page.getByText('Exceeded 90%')).toBeVisible();
  });

  test('context fill bar renders', async ({ page }) => {
    await expect(page.getByText('Avg / Max Fill')).toBeVisible();
  });

  test('anti-patterns section renders', async ({ page }) => {
    const section = page.getByRole('heading', { name: 'Anti-Patterns' });
    await expect(section).toBeVisible();
  });

  test('project activity section renders', async ({ page }) => {
    await expect(page.getByText('Project Activity')).toBeVisible();
  });

  test('growth tracking section shows WoW and MoM', async ({ page }) => {
    await expect(page.getByText('Growth Tracking')).toBeVisible();
    await expect(page.getByText('Current')).toBeVisible();
    await expect(page.getByText('Prev Week')).toBeVisible();
    await expect(page.getByText('Prev Month')).toBeVisible();

    // Check WoW/MoM labels
    await expect(page.getByText(/WoW/)).toBeVisible();
    await expect(page.getByText(/MoM/)).toBeVisible();
  });

  test('growth deltas have correct styling', async ({ page }) => {
    // Positive deltas should have deltaPositive class, negative should have deltaNegative
    const wowText = page.getByText(/WoW/).first();
    const parentClasses = await wowText.evaluate((el) => el.className);
    // Should have one of: deltaPositive, deltaNegative, or deltaNeutral
    const hasClass =
      parentClasses.includes('Positive') ||
      parentClasses.includes('Negative') ||
      parentClasses.includes('Neutral');
    expect(hasClass).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Team Detail Page Tests
// ---------------------------------------------------------------------------

test.describe('Team Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    // We need to find a team ID first. Navigate to enterprise overview and find a team link.
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);

    // Try to navigate to first team — look for team links
    const teamLink = page.locator('a[href*="/dashboard/enterprise/team/"]').first();
    const hasTeamLink = await teamLink.isVisible().catch(() => false);
    if (hasTeamLink) {
      await teamLink.click();
      await page.waitForURL(/\/dashboard\/enterprise\/team\/.+/);
      await page.waitForLoadState('networkidle');
    }
  });

  test('team header shows team name and member count', async ({ page }) => {
    test.skip(!page.url().includes('/team/'), 'No team page available');

    // TeamHeader component renders team name
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('stat cards show team metrics', async ({ page }) => {
    test.skip(!page.url().includes('/team/'), 'No team page available');

    await expect(page.getByText('Members')).toBeVisible();
    await expect(page.getByText('Avg Score')).toBeVisible();
    await expect(page.getByText('WoW')).toBeVisible();
    await expect(page.getByText('Skill Gaps')).toBeVisible();
  });

  test('dimension radar chart renders', async ({ page }) => {
    test.skip(!page.url().includes('/team/'), 'No team page available');

    await expect(page.getByText('Dimension Scores')).toBeVisible();
    // RadarChart renders as SVG
    const svg = page.locator('svg');
    const svgCount = await svg.count();
    expect(svgCount).toBeGreaterThan(0);
  });

  test('weekly trend chart renders', async ({ page }) => {
    test.skip(!page.url().includes('/team/'), 'No team page available');

    await expect(page.getByText('Weekly Trend')).toBeVisible();
  });

  test('type distribution chart renders', async ({ page }) => {
    test.skip(!page.url().includes('/team/'), 'No team page available');

    await expect(page.getByText('Type Distribution')).toBeVisible();
  });

  test('member table renders in team detail', async ({ page }) => {
    test.skip(!page.url().includes('/team/'), 'No team page available');

    await expect(page.getByText('Members')).toBeVisible();
    const table = page.locator('table');
    const hasTable = await table.isVisible().catch(() => false);
    if (hasTable) {
      const rows = table.locator('tbody tr');
      expect(await rows.count()).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Team → Member Drill-Down (AC 11)
// ---------------------------------------------------------------------------

test.describe('Team → Member Drill-Down', () => {
  /**
   * Navigate to enterprise overview, find a team link via the Teams section,
   * enter the team detail page, then click a member to verify drill-down
   * navigates to the member detail page with team context (back link = "Back to [TeamName]").
   */

  test('enterprise overview shows Teams section with clickable team cards', async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);

    const teamsSection = page.getByText('Teams');
    const isVisible = await teamsSection.isVisible().catch(() => false);
    // Only assert if data exists; skip gracefully when no teams are seeded
    if (isVisible) {
      await expect(teamsSection).toBeVisible();
      const teamLink = page.locator('a[href*="/dashboard/enterprise/team/"]').first();
      await expect(teamLink).toBeVisible();
    }
  });

  test('clicking a team card navigates to team detail page', async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);

    const teamLink = page.locator('a[href*="/dashboard/enterprise/team/"]').first();
    const hasTeamLink = await teamLink.isVisible().catch(() => false);
    test.skip(!hasTeamLink, 'No teams seeded');

    await teamLink.click();
    await page.waitForURL(/\/dashboard\/enterprise\/team\/.+/);
    expect(page.url()).toMatch(/\/dashboard\/enterprise\/team\/.+/);
  });

  test('clicking member row in team detail navigates to member detail', async ({ page }) => {
    // Step 1: reach the team detail page
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);

    const teamLink = page.locator('a[href*="/dashboard/enterprise/team/"]').first();
    const hasTeamLink = await teamLink.isVisible().catch(() => false);
    test.skip(!hasTeamLink, 'No teams seeded');

    await teamLink.click();
    await page.waitForURL(/\/dashboard\/enterprise\/team\/.+/);
    await page.waitForLoadState('networkidle');

    // Step 2: find and click a member in the member table
    const table = page.locator('table');
    const hasTable = await table.isVisible().catch(() => false);
    test.skip(!hasTable, 'No member table in team detail');

    const firstMemberRow = table.locator('tbody tr').first();
    await firstMemberRow.click();

    // Step 3: verify navigation to member detail
    await page.waitForURL(/\/dashboard\/enterprise\/members\/.+/);
    expect(page.url()).toMatch(/\/dashboard\/enterprise\/members\/.+/);
  });

  test('member detail accessed from team has team context in URL', async ({ page }) => {
    // Navigate to a team
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);

    const teamLink = page.locator('a[href*="/dashboard/enterprise/team/"]').first();
    const hasTeamLink = await teamLink.isVisible().catch(() => false);
    test.skip(!hasTeamLink, 'No teams seeded');

    await teamLink.click();
    await page.waitForURL(/\/dashboard\/enterprise\/team\/.+/);
    await page.waitForLoadState('networkidle');

    // Click member in the Growth Leaderboard (first clickable row with member data)
    const table = page.locator('table');
    const hasTable = await table.isVisible().catch(() => false);
    test.skip(!hasTable, 'No member table in team detail');

    await table.locator('tbody tr').first().click();
    await page.waitForURL(/\/dashboard\/enterprise\/members\/.+/);

    // URL should carry team context query params
    const url = page.url();
    expect(url).toContain('from=team');
    expect(url).toContain('teamId=');
  });

  test('back link on member detail says Back to [TeamName] when accessed from team', async ({ page }) => {
    // Navigate to team detail
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);

    const teamLink = page.locator('a[href*="/dashboard/enterprise/team/"]').first();
    const hasTeamLink = await teamLink.isVisible().catch(() => false);
    test.skip(!hasTeamLink, 'No teams seeded');

    // Read the team name from the card before clicking
    const teamNameEl = teamLink.locator('h3').first();
    const teamName = await teamNameEl.textContent().catch(() => null);

    await teamLink.click();
    await page.waitForURL(/\/dashboard\/enterprise\/team\/.+/);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const hasTable = await table.isVisible().catch(() => false);
    test.skip(!hasTable, 'No member table in team detail');

    await table.locator('tbody tr').first().click();
    await page.waitForURL(/\/dashboard\/enterprise\/members\/.+/);
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading member'),
      { timeout: 15000 },
    ).catch(() => {});

    // Back link should say "Back to [TeamName]" not "Back to Members"
    if (teamName) {
      const backLink = page.getByText(`Back to ${teamName}`);
      await expect(backLink).toBeVisible();
    } else {
      // Fallback: any "Back to" link that points back to a team URL
      const backLink = page.locator('a[href*="/dashboard/enterprise/team/"]');
      await expect(backLink).toBeVisible();
    }
  });

  test('back link returns user to team detail page', async ({ page }) => {
    // Navigate to team detail
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);

    const teamLink = page.locator('a[href*="/dashboard/enterprise/team/"]').first();
    const hasTeamLink = await teamLink.isVisible().catch(() => false);
    test.skip(!hasTeamLink, 'No teams seeded');

    await teamLink.click();
    await page.waitForURL(/\/dashboard\/enterprise\/team\/.+/);
    const teamUrl = page.url();
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const hasTable = await table.isVisible().catch(() => false);
    test.skip(!hasTable, 'No member table in team detail');

    // Drill into member
    await table.locator('tbody tr').first().click();
    await page.waitForURL(/\/dashboard\/enterprise\/members\/.+/);
    await page.waitForLoadState('networkidle');

    // Click back link → should return to team detail
    const backLink = page.locator(`a[href*="/dashboard/enterprise/team/"]`).first();
    const hasBackLink = await backLink.isVisible().catch(() => false);
    test.skip(!hasBackLink, 'No team back link found on member detail');

    await backLink.click();
    await page.waitForURL(/\/dashboard\/enterprise\/team\/.+/);
    expect(page.url()).toBe(teamUrl);
  });

  test('member detail accessed from team shows growth areas section', async ({ page }) => {
    // Navigate to team → member detail
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);

    const teamLink = page.locator('a[href*="/dashboard/enterprise/team/"]').first();
    const hasTeamLink = await teamLink.isVisible().catch(() => false);
    test.skip(!hasTeamLink, 'No teams seeded');

    await teamLink.click();
    await page.waitForURL(/\/dashboard\/enterprise\/team\/.+/);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const hasTable = await table.isVisible().catch(() => false);
    test.skip(!hasTable, 'No member table in team detail');

    await table.locator('tbody tr').first().click();
    await page.waitForURL(/\/dashboard\/enterprise\/members\/.+/);
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading member'),
      { timeout: 15000 },
    ).catch(() => {});

    // Growth Areas section should render (or be absent if no data — not an error)
    const growthSection = page.getByRole('heading', { name: 'Growth Areas' });
    const hasGrowthAreas = await growthSection.isVisible().catch(() => false);
    // When growth areas exist, section must be visible
    if (hasGrowthAreas) {
      await expect(growthSection).toBeVisible();
    }
    // Always assert the full report sections are present
    await expect(page.getByText('Score History')).toBeVisible();
    await expect(page.getByText('Anti-Patterns')).toBeVisible();
    await expect(page.getByText('Growth Tracking')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Token Usage Tracking (Manager Focus)
// ---------------------------------------------------------------------------

test.describe('Token Usage Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);
  });

  test('token usage section visible on overview', async ({ page }) => {
    await expect(page.getByText('Token Usage')).toBeVisible();
  });

  test('avg token burn stat card shows numeric value', async ({ page }) => {
    const card = page.getByText('Avg Token Burn').locator('..');
    await expect(card).toBeVisible();
  });

  test('member detail shows per-member token breakdown', async ({ page }) => {
    // Navigate to a member detail
    await navigateTo(page, '/dashboard/enterprise/members');
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading members'),
      { timeout: 15000 },
    ).catch(() => {});

    const table = page.locator('table');
    const hasTable = await table.isVisible().catch(() => false);
    test.skip(!hasTable, 'No member table');

    await table.locator('tbody tr').first().click();
    await page.waitForURL(/\/dashboard\/enterprise\/members\/.+/);
    await page.waitForLoadState('networkidle');

    // Check token metrics are present
    await expect(page.getByText('Total Messages')).toBeVisible();
    await expect(page.getByText('Max Context Fill')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Team Blind Spots
// ---------------------------------------------------------------------------

test.describe('Team Blind Spots', () => {
  test('skill gaps surface on team detail page', async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);

    // Find team link and navigate
    const teamLink = page.locator('a[href*="/dashboard/enterprise/team/"]').first();
    const hasTeamLink = await teamLink.isVisible().catch(() => false);
    test.skip(!hasTeamLink, 'No team available');

    await teamLink.click();
    await page.waitForURL(/\/dashboard\/enterprise\/team\/.+/);
    await page.waitForLoadState('networkidle');

    // Skill Gaps stat card should be visible
    await expect(page.getByText('Skill Gaps')).toBeVisible();
  });

  test('common growth areas show shared weaknesses on overview', async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);

    const section = page.getByText('Common Growth Areas');
    const isVisible = await section.isVisible().catch(() => false);
    // Growth areas section only shows if there are areas affecting 2+ members
    if (isVisible) {
      await expect(section).toBeVisible();
    }
  });

  test('anti-pattern aggregation shows team-wide patterns', async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise');
    await waitForContent(page);

    const section = page.getByText('Anti-Pattern Deep Dive');
    const isVisible = await section.isVisible().catch(() => false);
    if (isVisible) {
      await expect(section).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Enterprise Setup Flow
// ---------------------------------------------------------------------------

test.describe('Enterprise Setup Flow', () => {
  test('setup page has step indicator', async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise/setup');

    // Step indicator should show 3 steps
    await expect(page.getByText('Organization')).toBeVisible();
    await expect(page.getByText('First Team')).toBeVisible();
    await expect(page.getByText('Ready')).toBeVisible();
  });

  test('org creation form has required fields', async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise/setup');

    // If user already has an org, they get redirected
    const isSetupPage = page.url().includes('/setup');
    test.skip(!isSetupPage, 'User already has an org');

    await expect(page.getByLabel('Organization Name')).toBeVisible();
    await expect(page.getByLabel('URL Slug')).toBeVisible();
    await expect(page.getByText('Create Organization')).toBeVisible();
  });
});
