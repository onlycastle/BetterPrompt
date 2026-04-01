/**
 * Playwright Setup Project — Seeds team data before browser tests run.
 *
 * This runs as a Playwright test (not globalSetup), which means the webServer
 * is already started before this executes. This allows API calls to work.
 */

import { test as setup } from '@playwright/test';
import { seedTeamData, cleanupTeamData } from './seed-team-data.js';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

setup('seed team data for E2E tests', async () => {
  setup.setTimeout(60_000);

  try {
    await cleanupTeamData(BASE_URL);
  } catch {
    // First run — nothing to clean
  }

  await seedTeamData(BASE_URL);
});
