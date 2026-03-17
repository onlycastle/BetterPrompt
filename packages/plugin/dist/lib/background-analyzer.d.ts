#!/usr/bin/env node
/**
 * Background Analyzer
 *
 * @deprecated Removed in plugin-only cutover.
 * BetterPrompt no longer spawns detached analysis work or uploads sessions to a
 * Gemini-backed server pipeline. SessionEnd queues the next local Claude Code
 * run instead; use the queued `/analyze` flow plus `sync_to_team` if needed.
 */
export {};
