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
 *
 * pluginRoot derivation: this file lives at dist/mcp/server-entry.js,
 * so going up 2 levels reaches the plugin root where node_modules/
 * is installed by ensureNativeDeps.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureNativeDeps } from '../lib/native-deps.js';
import { info } from '../lib/logger.js';

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

info('bootstrap', 'ensuring native deps');
ensureNativeDeps({ pluginRoot, fatal: true });
info('bootstrap', 'native deps ready, loading server');

await import('./server.js');
