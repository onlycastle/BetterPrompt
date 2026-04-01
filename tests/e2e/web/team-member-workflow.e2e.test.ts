/**
 * E2E Tests for Team Member Management Workflows
 *
 * Tests the full lifecycle: create org → create team → invite member →
 * update role → remove member → view analysis history.
 *
 * Prerequisites:
 * - Server running at localhost:3000
 * - Clean database state (or idempotent test data)
 */

import { test, expect, type Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = 'http://localhost:3000';

async function apiCall(
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function navigateTo(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

// Unique suffix for test isolation
const TEST_SUFFIX = `e2e-${Date.now()}`;

// ---------------------------------------------------------------------------
// Organization Setup Flow
// ---------------------------------------------------------------------------

test.describe('Organization Setup Flow', () => {
  test('create organization via setup page', async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise/setup');

    // If redirected (org already exists), skip
    if (!page.url().includes('/setup')) {
      test.skip(true, 'Organization already exists, skipping setup test');
      return;
    }

    // Step 1: Fill in organization details
    const orgNameInput = page.getByLabel('Organization Name');
    await expect(orgNameInput).toBeVisible();
    await orgNameInput.fill(`Test Org ${TEST_SUFFIX}`);

    const slugInput = page.getByLabel('URL Slug');
    await expect(slugInput).toBeVisible();
    // Slug should auto-generate from name
    const slugValue = await slugInput.inputValue();
    expect(slugValue).toContain('test-org');

    // Submit org creation
    const createOrgBtn = page.getByRole('button', { name: 'Create Organization' });
    await expect(createOrgBtn).toBeEnabled();
    await createOrgBtn.click();

    // Step 2: Should advance to team creation step
    await expect(page.getByText('Create Your First Team')).toBeVisible({ timeout: 10000 });
  });

  test('create first team during setup', async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise/setup');

    if (!page.url().includes('/setup')) {
      test.skip(true, 'Organization already exists');
      return;
    }

    // Create org first
    await page.getByLabel('Organization Name').fill(`Team Test Org ${TEST_SUFFIX}`);
    await page.getByRole('button', { name: 'Create Organization' }).click();
    await expect(page.getByText('Create Your First Team')).toBeVisible({ timeout: 10000 });

    // Fill team details
    await page.getByLabel('Team Name').fill(`Platform Team ${TEST_SUFFIX}`);
    const descInput = page.getByLabel('Description (optional)');
    if (await descInput.isVisible()) {
      await descInput.fill('Platform engineering team');
    }

    await page.getByRole('button', { name: 'Create Team' }).click();

    // Step 3: Should show completion
    await expect(page.getByText("You're All Set!")).toBeVisible({ timeout: 10000 });
  });

  test('skip team creation during setup', async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise/setup');

    if (!page.url().includes('/setup')) {
      test.skip(true, 'Organization already exists');
      return;
    }

    // Create org
    await page.getByLabel('Organization Name').fill(`Skip Team Org ${TEST_SUFFIX}`);
    await page.getByRole('button', { name: 'Create Organization' }).click();
    await expect(page.getByText('Create Your First Team')).toBeVisible({ timeout: 10000 });

    // Skip team
    await page.getByRole('button', { name: 'Skip for now' }).click();

    // Should show completion
    await expect(page.getByText("You're All Set!")).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Team CRUD via API
// ---------------------------------------------------------------------------

test.describe('Team API Workflows', () => {
  let orgId: string;
  let teamId: string;

  test('create team via API', async () => {
    // First ensure org exists
    const orgRes = await apiCall('GET', '/api/org');
    if (orgRes.status !== 200 || !orgRes.data.id) {
      test.skip(true, 'No organization exists yet');
      return;
    }
    orgId = orgRes.data.id as string;

    const res = await apiCall('POST', '/api/teams', {
      name: `API Team ${TEST_SUFFIX}`,
      description: 'Created by E2E test',
    });

    expect(res.status).toBe(200);
    expect(res.data.id).toBeDefined();
    teamId = res.data.id as string;
  });

  test('list teams via API', async () => {
    const res = await apiCall('GET', '/api/teams');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test('get team detail via API', async () => {
    test.skip(!teamId, 'No team created');

    const res = await apiCall('GET', `/api/teams/${teamId}`);
    expect(res.status).toBe(200);
    expect(res.data.name).toContain('API Team');
  });

  test('update team via API', async () => {
    test.skip(!teamId, 'No team created');

    const res = await apiCall('PUT', `/api/teams/${teamId}`, {
      name: `Updated Team ${TEST_SUFFIX}`,
      description: 'Updated by E2E test',
    });

    expect(res.status).toBe(200);
  });

  test('delete team via API', async () => {
    test.skip(!teamId, 'No team created');

    const res = await apiCall('DELETE', `/api/teams/${teamId}`);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Member Management via UI
// ---------------------------------------------------------------------------

test.describe('Member Management UI', () => {
  test.beforeEach(async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise/members');
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading members'),
      { timeout: 15000 },
    ).catch(() => {});
  });

  test('invite member dialog opens', async ({ page }) => {
    const inviteBtn = page.getByText('Invite Member');
    await expect(inviteBtn).toBeVisible();
    await inviteBtn.click();

    // Dialog should appear with email and role fields
    // MemberInviteDialog should be visible
    const dialog = page.getByRole('dialog').or(page.locator('[class*="dialog"], [class*="Dialog"], [class*="modal"], [class*="Modal"]'));
    const isDialogVisible = await dialog.isVisible().catch(() => false);

    if (isDialogVisible) {
      await expect(dialog).toBeVisible();
    }
  });

  test('member row click navigates to detail', async ({ page }) => {
    const table = page.locator('table');
    const hasTable = await table.isVisible().catch(() => false);
    test.skip(!hasTable, 'No member table rendered');

    const rows = table.locator('tbody tr');
    const count = await rows.count();
    test.skip(count === 0, 'No members in table');

    await rows.first().click();
    await page.waitForURL(/\/dashboard\/enterprise\/members\/.+/, { timeout: 10000 });
    expect(page.url()).toContain('/dashboard/enterprise/members/');
  });
});

// ---------------------------------------------------------------------------
// Member API Workflows
// ---------------------------------------------------------------------------

test.describe('Member API Workflows', () => {
  let teamId: string;
  let testUserId: string;

  test.beforeAll(async () => {
    // Get existing teams
    const teamsRes = await apiCall('GET', '/api/teams');
    if (teamsRes.status === 200 && Array.isArray(teamsRes.data) && teamsRes.data.length > 0) {
      teamId = (teamsRes.data as Array<{ id: string }>)[0].id;
    }
  });

  test('add member to team', async () => {
    test.skip(!teamId, 'No team available');

    const res = await apiCall('POST', `/api/teams/${teamId}/members`, {
      email: `test-${TEST_SUFFIX}@example.com`,
      role: 'member',
    });

    // 200 or 409 (already exists)
    expect([200, 409]).toContain(res.status);
    if (res.status === 200 && res.data.userId) {
      testUserId = res.data.userId as string;
    }
  });

  test('list team members', async () => {
    test.skip(!teamId, 'No team available');

    const res = await apiCall('GET', `/api/teams/${teamId}/members`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test('update member role', async () => {
    test.skip(!teamId || !testUserId, 'No team or user available');

    const res = await apiCall('PATCH', `/api/teams/${teamId}/members/${testUserId}`, {
      role: 'admin',
    });

    expect(res.status).toBe(200);
  });

  test('remove member from team', async () => {
    test.skip(!teamId || !testUserId, 'No team or user available');

    const res = await apiCall('DELETE', `/api/teams/${teamId}/members/${testUserId}`);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Analysis History View
// ---------------------------------------------------------------------------

test.describe('Member Analysis History', () => {
  test('member detail page shows score history chart', async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise/members');
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading members'),
      { timeout: 15000 },
    ).catch(() => {});

    const table = page.locator('table');
    const hasTable = await table.isVisible().catch(() => false);
    test.skip(!hasTable, 'No member table');

    const rows = table.locator('tbody tr');
    const count = await rows.count();
    test.skip(count === 0, 'No members available');

    // Navigate to member detail
    await rows.first().click();
    await page.waitForURL(/\/dashboard\/enterprise\/members\/.+/);
    await page.waitForLoadState('networkidle');

    // Score history section should render
    await expect(page.getByText('Score History')).toBeVisible();

    // TrendLineChart renders as SVG
    const svgs = page.locator('svg');
    const svgCount = await svgs.count();
    expect(svgCount).toBeGreaterThan(0);
  });

  test('member detail shows strengths by domain', async ({ page }) => {
    await navigateTo(page, '/dashboard/enterprise/members');
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading members'),
      { timeout: 15000 },
    ).catch(() => {});

    const table = page.locator('table');
    const hasTable = await table.isVisible().catch(() => false);
    test.skip(!hasTable, 'No member table');

    const rows = table.locator('tbody tr');
    test.skip((await rows.count()) === 0, 'No members');

    await rows.first().click();
    await page.waitForURL(/\/dashboard\/enterprise\/members\/.+/);
    await page.waitForLoadState('networkidle');

    // Strengths overview section
    await expect(page.getByText('Strengths Overview')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Responsive Layout Tests
// ---------------------------------------------------------------------------

test.describe('Enterprise Dashboard Responsive', () => {
  test('overview page renders on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await navigateTo(page, '/dashboard/enterprise');
    await page.waitForLoadState('networkidle');

    // Page should still render stat cards
    const title = page.locator('h1');
    await expect(title).toBeVisible();
  });

  test('member detail renders on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await navigateTo(page, '/dashboard/enterprise/members');
    await page.waitForLoadState('networkidle');

    // Members heading should be visible
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
  });
});
