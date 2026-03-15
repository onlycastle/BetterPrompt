#!/usr/bin/env node
/**
 * BetterPrompt MCP Server
 *
 * Stdio-based MCP server that exposes developer analysis insights
 * as tools for Claude Code to call proactively.
 *
 * === Local-First Tools (no server needed) ===
 *   scan_sessions          — Scan Claude Code session logs
 *   extract_data           — Run deterministic Phase 1 extraction
 *   save_domain_results    — Save domain analysis results
 *   classify_developer_type — Classify developer type from scores
 *   generate_report        — Generate HTML report + start localhost server
 *   sync_to_team           — Sync results to team server (optional)
 *
 * === Server-Backed Tools (backward compatible) ===
 *   get_developer_profile  — AI collaboration type, scores, personality
 *   get_growth_areas       — Top growth areas with recommendations
 *   get_recent_insights    — Strengths, anti-patterns, or KPT summary
 *
 * Data flow: local tools work entirely offline. Server tools use
 * local SQLite cache → server API (refresh if stale).
 */
export {};
