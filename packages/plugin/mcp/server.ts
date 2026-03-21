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
 *   get_domain_results     — Read saved domain analysis results
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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { closeCache, getSummaryWithCache } from '../lib/cache.js';
import { verifyAuth } from '../lib/api-client.js';
import { closeResultsDb } from '../lib/results-db.js';
import { closeStageDb } from '../lib/stage-db.js';
import { recoverStaleAnalysisState } from '../lib/debounce.js';
import { debug, info, error as logError } from '../lib/logger.js';

// Legacy server-backed tools
import {
  definition as profileDef,
  formatResult as formatProfile,
} from './tools/get-developer-profile.js';
import {
  definition as growthDef,
  formatResult as formatGrowth,
} from './tools/get-growth-areas.js';
import {
  definition as insightsDef,
  formatResult as formatInsights,
} from './tools/get-recent-insights.js';

// New local-first tools
import {
  definition as scanDef,
  execute as executeScan,
} from './tools/scan-sessions.js';
import {
  definition as extractDef,
  execute as executeExtract,
} from './tools/extract-data.js';
import {
  definition as saveDomainDef,
  execute as executeSaveDomain,
  DomainResultInputSchema,
} from './tools/save-domain-results.js';
import {
  definition as getDomainResultsDef,
  execute as executeGetDomainResults,
  GetDomainResultsInputSchema,
} from './tools/get-domain-results.js';
import {
  definition as classifyDef,
  execute as executeClassify,
} from './tools/classify-developer-type.js';
import {
  definition as reportDef,
  execute as executeReport,
} from './tools/generate-report.js';
import {
  definition as syncDef,
  execute as executeSync,
} from './tools/sync-to-team.js';
import {
  definition as stageDef,
  execute as executeStage,
  StageOutputInputSchema,
} from './tools/save-stage-output.js';
import {
  definition as getStageOutputDef,
  execute as executeGetStageOutput,
} from './tools/get-stage-output.js';
import {
  definition as getPromptContextDef,
  execute as executeGetPromptContext,
  GetPromptContextInputSchema,
} from './tools/get-prompt-context.js';

// Resolve user ID once at startup (for server-backed tools)
let resolvedUserId: string | null = null;

async function getUserId(): Promise<string> {
  if (resolvedUserId) return resolvedUserId;

  const user = await verifyAuth();
  if (!user) {
    throw new Error(
      'Could not reach the BetterPrompt server. ' +
      'Check the plugin serverUrl setting and confirm the dashboard server is running.',
    );
  }

  resolvedUserId = user.id;
  return resolvedUserId;
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'betterprompt',
  version: '0.2.0',
});

/** Wrap a tool handler with consistent error formatting and debug logging */
function wrapToolExecution<T>(
  toolName: string,
  fn: (args: T) => Promise<string>,
): (args: T) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  return async (args: T) => {
    const start = Date.now();
    const argRecord = args as Record<string, unknown>;
    debug('tool', `${toolName} called`, Object.keys(argRecord).length > 0 ? argRecord : undefined);
    try {
      const result = await fn(args);
      debug('tool', `${toolName} completed`, { durationMs: Date.now() - start });
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      logError('tool', `${toolName} failed`, { durationMs: Date.now() - start, error: errorMsg });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error: errorMsg }) }],
        isError: true,
      };
    }
  };
}

// =========================================================================
// LOCAL-FIRST TOOLS (no server needed)
// =========================================================================

server.tool(scanDef.name, scanDef.description, {
  includeProjects: z.array(z.string()).optional().describe('Filter results to only these project names'),
}, wrapToolExecution(scanDef.name, executeScan));

server.tool(extractDef.name, extractDef.description, {
  maxSessions: z.number().optional().describe('Maximum number of recent sessions to analyze (default: 50)'),
  includeProjects: z.array(z.string()).optional().describe('Filter to only these project names before applying maxSessions limit'),
}, wrapToolExecution(extractDef.name, executeExtract));

server.tool(saveDomainDef.name, saveDomainDef.description, DomainResultInputSchema.shape,
  wrapToolExecution(saveDomainDef.name, executeSaveDomain));

server.tool(getDomainResultsDef.name, getDomainResultsDef.description, GetDomainResultsInputSchema.shape,
  wrapToolExecution(getDomainResultsDef.name, executeGetDomainResults));

server.tool(classifyDef.name, classifyDef.description, {},
  wrapToolExecution(classifyDef.name, () => executeClassify({})));

server.tool(reportDef.name, reportDef.description, {
  port: z.number().optional().describe('Port for the report server (default: 3456)'),
  openBrowser: z.boolean().optional().describe('Auto-open report in browser (default: true)'),
  allowIncomplete: z.boolean().optional().describe('Override required-stage gating and generate a report anyway'),
}, wrapToolExecution(reportDef.name, executeReport));

server.tool(syncDef.name, syncDef.description, {
  serverUrl: z.string().optional().describe('Override the configured BetterPrompt server URL for this sync call'),
}, wrapToolExecution(syncDef.name, executeSync));

server.tool(stageDef.name, stageDef.description, StageOutputInputSchema.shape,
  wrapToolExecution(stageDef.name, executeStage));

server.tool(getStageOutputDef.name, getStageOutputDef.description, {
  stage: z.string().optional().describe('Stage name to retrieve (omit for all stages)'),
}, wrapToolExecution(getStageOutputDef.name, executeGetStageOutput));

server.tool(getPromptContextDef.name, getPromptContextDef.description, GetPromptContextInputSchema.shape,
  wrapToolExecution(getPromptContextDef.name, executeGetPromptContext));

// =========================================================================
// SERVER-BACKED TOOLS (backward compatible)
// =========================================================================

server.tool(profileDef.name, profileDef.description, {},
  wrapToolExecution(profileDef.name, async () => {
    const userId = await getUserId();
    const summary = await getSummaryWithCache(userId);
    return formatProfile(summary);
  }));

server.tool(growthDef.name, growthDef.description, {
  domain: z.enum(['thinkingQuality', 'communicationPatterns', 'learningBehavior', 'contextEfficiency', 'sessionOutcome'])
    .optional()
    .describe('Filter by domain key'),
}, wrapToolExecution(growthDef.name, async (args) => {
  const userId = await getUserId();
  const summary = await getSummaryWithCache(userId);
  return formatGrowth(summary, args);
}));

server.tool(insightsDef.name, insightsDef.description, {
  category: z.enum(['strengths', 'anti_patterns', 'kpt']).optional().default('kpt')
    .describe('Category of insights: "strengths", "anti_patterns", or "kpt" (default)'),
}, wrapToolExecution(insightsDef.name, async (args) => {
  const userId = await getUserId();
  const summary = await getSummaryWithCache(userId);
  return formatInsights(summary, args);
}));

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  info('server', 'starting');
  recoverStaleAnalysisState({
    force: true,
    reason: 'Recovered stale running state on MCP server startup.',
  });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  info('server', 'connected');
}

main().catch((err) => {
  logError('server', 'failed to start', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});

// Clean up on shutdown
function cleanup() {
  info('server', 'shutting down');
  closeCache();
  closeResultsDb();
  closeStageDb();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
