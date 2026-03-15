#!/usr/bin/env node
/**
 * Background Analyzer
 *
 * Spawned as a detached child process by the post-session hook.
 * Reuses the CLI scanner and uploader to run a full analysis,
 * then refreshes the local insight cache.
 *
 * Usage: node background-analyzer.js
 *
 * Environment:
 *   BETTERPROMPT_SERVER_URL  — server URL
 *   BETTERPROMPT_AUTH_TOKEN  — CLI auth token
 */
export {};
