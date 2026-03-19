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
process.env.BETTERPROMPT_TELEMETRY = 'false';
process.env.HOME = '/tmp/betterprompt-test-home';

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
global.testUtils = {
  mockDate: (date: Date) => {
    vi.useFakeTimers();
    vi.setSystemTime(date);
  },
  resetDate: () => {
    vi.useRealTimers();
  },
};
