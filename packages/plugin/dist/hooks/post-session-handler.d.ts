#!/usr/bin/env node
/**
 * Post-Session Hook Handler
 *
 * Called by Claude Code after each session ends.
 * Checks debounce rules and spawns the background analyzer if needed.
 *
 * Exit codes:
 *   0 = hook ran successfully (analysis may or may not have been triggered)
 *   1 = unexpected error
 *
 * This must be fast (<100ms) — it runs synchronously in Claude Code's
 * hook pipeline, so we only check debounce rules and spawn a detached process.
 */
export {};
