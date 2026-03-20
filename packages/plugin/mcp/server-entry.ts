#!/usr/bin/env node

/**
 * MCP Server Bootstrap
 *
 * Thin entry point that guarantees native dependencies (better-sqlite3)
 * are installed BEFORE loading the real server.  This is critical for
 * first-run-in-session: the plugin may be installed mid-session after
 * the SessionStart hook has already fired, so the MCP server is the
 * first (and only) entry point that runs.
 *
 * Static imports of better-sqlite3 in cache.ts / results-db.ts would
 * crash Node during module evaluation if the native addon is missing.
 * By deferring the server import to a dynamic `import()`, we ensure
 * ensureNativeDeps() runs first.
 */

import { ensureNativeDeps } from '../lib/native-deps.js';

ensureNativeDeps({ fatal: true });

await import('./server.js');
