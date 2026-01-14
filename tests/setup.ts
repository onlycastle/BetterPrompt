/**
 * Global Test Setup
 *
 * Runs before all tests. Sets up environment variables,
 * global mocks, and cleanup hooks.
 */

import { beforeEach, afterEach, afterAll, vi } from 'vitest';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = 'test-api-key-mock';
process.env.NOSLOP_TELEMETRY = 'false';
process.env.NOSLOP_STORAGE_PATH = '/tmp/nomoreaislop-test';

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Global cleanup after all tests to prevent process hanging
afterAll(async () => {
  // Reset Supabase singleton to close any open connections
  try {
    const { resetSupabaseClient } = await import(
      '../src/infrastructure/storage/supabase/client.js'
    );
    resetSupabaseClient?.();
  } catch {
    // Module may not be loaded in all test contexts
  }

  // Brief delay to allow connections to close
  await new Promise((resolve) => setTimeout(resolve, 100));
});

// Global test utilities
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      testUtils: {
        mockDate: (date: Date) => void;
        resetDate: () => void;
      };
    }
  }
}

// Date mocking utilities
const realDate = Date;
global.testUtils = {
  mockDate: (date: Date) => {
    vi.useFakeTimers();
    vi.setSystemTime(date);
  },
  resetDate: () => {
    vi.useRealTimers();
  },
};
