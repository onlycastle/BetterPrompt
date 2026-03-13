#!/usr/bin/env node

/**
 * BetterPrompt MCP Server
 *
 * Stdio-based MCP server that exposes developer analysis insights
 * as tools for Claude Code to call proactively.
 *
 * Tools:
 *   get_developer_profile  — AI collaboration type, scores, personality
 *   get_growth_areas       — Top growth areas with recommendations
 *   get_recent_insights    — Strengths, anti-patterns, or KPT summary
 *
 * Data flow: local SQLite cache → server API (refresh if stale)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getSummaryWithCache, closeCache } from '../lib/cache.js';
import { verifyAuth } from '../lib/api-client.js';

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

// Resolve user ID once at startup
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
  version: '0.1.0',
});

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
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
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
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
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
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
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
process.on('SIGINT', () => {
  closeCache();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeCache();
  process.exit(0);
});
