#!/usr/bin/env npx tsx
/**
 * Start UI Script
 *
 * Starts both the API server and the React development server.
 */

import { spawn } from 'node:child_process';
import { join } from 'node:path';

const ROOT_DIR = join(import.meta.dirname, '..');

console.log('🚀 Starting Knowledge Base Web UI...\n');

// Start API server
const api = spawn('npm', ['run', 'api'], {
  cwd: ROOT_DIR,
  stdio: 'inherit',
  shell: true,
});

// Wait a bit for API to start
setTimeout(() => {
  // Start React dev server
  const webUi = spawn('npm', ['run', 'dev'], {
    cwd: join(ROOT_DIR, 'web-ui'),
    stdio: 'inherit',
    shell: true,
  });

  webUi.on('error', (err) => {
    console.error('Failed to start web-ui:', err);
  });
}, 2000);

api.on('error', (err) => {
  console.error('Failed to start API server:', err);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});
