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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { closeCache, getSummaryWithCache } from '../lib/cache.js';
import { verifyAuth } from '../lib/api-client.js';
import { closeResultsDb } from '../lib/results-db.js';

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
} from './tools/save-domain-results.js';
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

// Resolve user ID once at startup (for server-backed tools)
let resolvedUserId: string | null = null;

async function getUserId(): Promise<string> {
  if (resolvedUserId) return resolvedUserId;

  const user = await verifyAuth();
  if (!user) {
    throw new Error(
      'Could not authenticate with BetterPrompt server. ' +
      'Check your BETTERPROMPT_AUTH_TOKEN and BETTERPROMPT_SERVER_URL.',
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

// =========================================================================
// LOCAL-FIRST TOOLS (no server needed)
// =========================================================================

// Tool: scan_sessions
server.tool(
  scanDef.name,
  scanDef.description,
  {},
  async () => {
    try {
      const result = await executeScan({});
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        }],
        isError: true,
      };
    }
  },
);

// Tool: extract_data
server.tool(
  extractDef.name,
  extractDef.description,
  {
    maxSessions: z
      .number()
      .optional()
      .describe('Maximum number of recent sessions to analyze (default: 50)'),
  },
  async (args) => {
    try {
      const result = await executeExtract(args);
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        }],
        isError: true,
      };
    }
  },
);

// Tool: save_domain_results
server.tool(
  saveDomainDef.name,
  saveDomainDef.description,
  {
    domain: z
      .enum([
        'thinkingQuality',
        'communicationPatterns',
        'learningBehavior',
        'contextEfficiency',
        'sessionOutcome',
        'content',
      ])
      .describe('Domain name for this analysis result'),
    overallScore: z
      .number()
      .min(0)
      .max(100)
      .describe('Overall domain score (0-100)'),
    confidenceScore: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Confidence in the analysis (0.0-1.0)'),
    strengths: z
      .array(z.object({
        title: z.string(),
        description: z.string(),
        evidence: z.array(z.object({
          utteranceId: z.string(),
          quote: z.string(),
          context: z.string().optional(),
        })),
      }))
      .describe('Strength findings with evidence'),
    growthAreas: z
      .array(z.object({
        title: z.string(),
        description: z.string(),
        severity: z.enum(['low', 'medium', 'high']),
        recommendation: z.string(),
        evidence: z.array(z.object({
          utteranceId: z.string(),
          quote: z.string(),
          context: z.string().optional(),
        })),
      }))
      .describe('Growth area findings with evidence'),
    data: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Domain-specific extra data'),
  },
  async (args) => {
    try {
      const result = await executeSaveDomain(args);
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        }],
        isError: true,
      };
    }
  },
);

// Tool: classify_developer_type
server.tool(
  classifyDef.name,
  classifyDef.description,
  {},
  async () => {
    try {
      const result = await executeClassify({});
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        }],
        isError: true,
      };
    }
  },
);

// Tool: generate_report
server.tool(
  reportDef.name,
  reportDef.description,
  {
    port: z
      .number()
      .optional()
      .describe('Port for the report server (default: 3456)'),
    openBrowser: z
      .boolean()
      .optional()
      .describe('Auto-open report in browser (default: true)'),
  },
  async (args) => {
    try {
      const result = await executeReport(args);
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        }],
        isError: true,
      };
    }
  },
);

// Tool: sync_to_team
server.tool(
  syncDef.name,
  syncDef.description,
  {
    serverUrl: z
      .string()
      .optional()
      .describe('Override server URL (defaults to BETTERPROMPT_SERVER_URL)'),
  },
  async (args) => {
    try {
      const result = await executeSync(args);
      return { content: [{ type: 'text' as const, text: result }] };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
        }],
        isError: true,
      };
    }
  },
);

// =========================================================================
// SERVER-BACKED TOOLS (backward compatible)
// =========================================================================

// Tool: get_developer_profile
server.tool(
  profileDef.name,
  profileDef.description,
  {},
  async () => {
    try {
      const userId = await getUserId();
      const summary = await getSummaryWithCache(userId);
      return {
        content: [{ type: 'text' as const, text: formatProfile(summary) }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        }],
        isError: true,
      };
    }
  },
);

// Tool: get_growth_areas
server.tool(
  growthDef.name,
  growthDef.description,
  {
    domain: z
      .enum([
        'thinkingQuality',
        'communicationPatterns',
        'learningBehavior',
        'contextEfficiency',
        'sessionOutcome',
      ])
      .optional()
      .describe(
        'Filter by domain key. One of: thinkingQuality, communicationPatterns, ' +
        'learningBehavior, contextEfficiency, sessionOutcome',
      ),
  },
  async (args) => {
    try {
      const userId = await getUserId();
      const summary = await getSummaryWithCache(userId);
      return {
        content: [{ type: 'text' as const, text: formatGrowth(summary, args) }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        }],
        isError: true,
      };
    }
  },
);

// Tool: get_recent_insights
server.tool(
  insightsDef.name,
  insightsDef.description,
  {
    category: z
      .enum(['strengths', 'anti_patterns', 'kpt'])
      .optional()
      .default('kpt')
      .describe(
        'Category of insights: "strengths", "anti_patterns", or "kpt" (default)',
      ),
  },
  async (args) => {
    try {
      const userId = await getUserId();
      const summary = await getSummaryWithCache(userId);
      return {
        content: [
          { type: 'text' as const, text: formatInsights(summary, args) },
        ],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('MCP server failed to start:', error);
  process.exit(1);
});

// Clean up on shutdown
function cleanup() {
  closeCache();
  closeResultsDb();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
