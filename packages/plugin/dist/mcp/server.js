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
// Legacy server-backed tools
import { definition as profileDef, formatResult as formatProfile, } from './tools/get-developer-profile.js';
import { definition as growthDef, formatResult as formatGrowth, } from './tools/get-growth-areas.js';
import { definition as insightsDef, formatResult as formatInsights, } from './tools/get-recent-insights.js';
// New local-first tools
import { definition as scanDef, execute as executeScan, } from './tools/scan-sessions.js';
import { definition as extractDef, execute as executeExtract, } from './tools/extract-data.js';
import { definition as saveDomainDef, execute as executeSaveDomain, DomainResultInputSchema, } from './tools/save-domain-results.js';
import { definition as getDomainResultsDef, execute as executeGetDomainResults, GetDomainResultsInputSchema, } from './tools/get-domain-results.js';
import { definition as classifyDef, execute as executeClassify, } from './tools/classify-developer-type.js';
import { definition as reportDef, execute as executeReport, } from './tools/generate-report.js';
import { definition as syncDef, execute as executeSync, } from './tools/sync-to-team.js';
import { definition as stageDef, execute as executeStage, StageOutputInputSchema, } from './tools/save-stage-output.js';
import { definition as getStageOutputDef, execute as executeGetStageOutput, } from './tools/get-stage-output.js';
import { definition as getPromptContextDef, execute as executeGetPromptContext, GetPromptContextInputSchema, } from './tools/get-prompt-context.js';
// Resolve user ID once at startup (for server-backed tools)
let resolvedUserId = null;
async function getUserId() {
    if (resolvedUserId)
        return resolvedUserId;
    const user = await verifyAuth();
    if (!user) {
        throw new Error('Could not authenticate with BetterPrompt server. ' +
            'Check your BETTERPROMPT_AUTH_TOKEN and BETTERPROMPT_SERVER_URL.');
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
/** Wrap a tool handler with consistent error formatting */
function wrapToolExecution(fn) {
    return async (args) => {
        try {
            const result = await fn(args);
            return { content: [{ type: 'text', text: result }] };
        }
        catch (error) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
                    }],
                isError: true,
            };
        }
    };
}
// =========================================================================
// LOCAL-FIRST TOOLS (no server needed)
// =========================================================================
server.tool(scanDef.name, scanDef.description, {}, wrapToolExecution(() => executeScan({})));
server.tool(extractDef.name, extractDef.description, {
    maxSessions: z.number().optional().describe('Maximum number of recent sessions to analyze (default: 50)'),
}, wrapToolExecution(executeExtract));
server.tool(saveDomainDef.name, saveDomainDef.description, DomainResultInputSchema.shape, wrapToolExecution(executeSaveDomain));
server.tool(getDomainResultsDef.name, getDomainResultsDef.description, GetDomainResultsInputSchema.shape, wrapToolExecution(executeGetDomainResults));
server.tool(classifyDef.name, classifyDef.description, {}, wrapToolExecution(() => executeClassify({})));
server.tool(reportDef.name, reportDef.description, {
    port: z.number().optional().describe('Port for the report server (default: 3456)'),
    openBrowser: z.boolean().optional().describe('Auto-open report in browser (default: true)'),
    allowIncomplete: z.boolean().optional().describe('Override required-stage gating and generate a report anyway'),
}, wrapToolExecution(executeReport));
server.tool(syncDef.name, syncDef.description, {
    serverUrl: z.string().optional().describe('Override server URL (defaults to BETTERPROMPT_SERVER_URL)'),
}, wrapToolExecution(executeSync));
server.tool(stageDef.name, stageDef.description, StageOutputInputSchema.shape, wrapToolExecution(executeStage));
server.tool(getStageOutputDef.name, getStageOutputDef.description, {
    stage: z.string().optional().describe('Stage name to retrieve (omit for all stages)'),
}, wrapToolExecution(executeGetStageOutput));
server.tool(getPromptContextDef.name, getPromptContextDef.description, GetPromptContextInputSchema.shape, wrapToolExecution(executeGetPromptContext));
// =========================================================================
// SERVER-BACKED TOOLS (backward compatible)
// =========================================================================
server.tool(profileDef.name, profileDef.description, {}, wrapToolExecution(async () => {
    const userId = await getUserId();
    const summary = await getSummaryWithCache(userId);
    return formatProfile(summary);
}));
server.tool(growthDef.name, growthDef.description, {
    domain: z.enum(['thinkingQuality', 'communicationPatterns', 'learningBehavior', 'contextEfficiency', 'sessionOutcome'])
        .optional()
        .describe('Filter by domain key'),
}, wrapToolExecution(async (args) => {
    const userId = await getUserId();
    const summary = await getSummaryWithCache(userId);
    return formatGrowth(summary, args);
}));
server.tool(insightsDef.name, insightsDef.description, {
    category: z.enum(['strengths', 'anti_patterns', 'kpt']).optional().default('kpt')
        .describe('Category of insights: "strengths", "anti_patterns", or "kpt" (default)'),
}, wrapToolExecution(async (args) => {
    const userId = await getUserId();
    const summary = await getSummaryWithCache(userId);
    return formatInsights(summary, args);
}));
// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function main() {
    recoverStaleAnalysisState({
        force: true,
        reason: 'Recovered stale running state on MCP server startup.',
    });
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
    closeStageDb();
    process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
//# sourceMappingURL=server.js.map