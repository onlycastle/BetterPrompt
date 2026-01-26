import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**/*.test.ts', 'tests/integration.test.ts'],
    // Worker pool configuration to ensure proper cleanup
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Use single fork to simplify cleanup
      },
    },
    teardownTimeout: 5000, // Allow 5s for teardown before force exit
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/api/index.ts',
        'src/web/scripts/**',
      ],
      thresholds: {
        lines: 50,
        branches: 50,
        functions: 50,
        statements: 50,
      },
    },
    setupFiles: ['tests/setup.ts'],
    testTimeout: 10000,
  },
});
