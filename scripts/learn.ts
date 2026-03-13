#!/usr/bin/env npx tsx
/**
 * Learn CLI Script
 *
 * Gathers and organizes AI engineering knowledge from provided search results.
 *
 * Usage:
 *   npx tsx scripts/learn.ts <json-results-file>
 *   npx tsx scripts/learn.ts --mock  # Use mock data for testing
 */

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { learn, getKnowledgeStats, type WebSearchItem } from '../src/search-agent/index.js';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message: string) {
  console.log(message);
}

function logHeader(title: string) {
  log(`\n${colors.bold}${colors.blue}═══ ${title} ═══${colors.reset}\n`);
}

function logSuccess(message: string) {
  log(`${colors.green}✓${colors.reset} ${message}`);
}

function logWarning(message: string) {
  log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

function logError(message: string) {
  log(`${colors.red}✗${colors.reset} ${message}`);
}

/**
 * Mock search results for testing
 */
const MOCK_RESULTS: WebSearchItem[] = [
  {
    url: 'https://www.anthropic.com/engineering/claude-code-best-practices',
    title: 'Claude Code: Best practices for agentic coding',
    content: `
Claude Code is a powerful agentic coding tool. Here are best practices:

1. **Use CLAUDE.md files** - Create a CLAUDE.md file in your project root to provide persistent context.
   The file should contain project structure, coding conventions, and important patterns.

2. **Context Engineering** - Be deliberate about what context you provide. Use just-in-time retrieval
   instead of dumping everything upfront.

3. **Feedback Loops** - Give Claude a way to verify its work. If Claude can run tests or type checks,
   it will 2-3x the quality of the final result.

4. **Subagents** - Use subagents for isolated tasks to keep the main context clean.
    `,
    publishedAt: '2025-12-01T00:00:00Z',
  },
  {
    url: 'https://example.com/context-engineering-guide',
    title: 'The Complete Guide to Context Engineering',
    content: `
Context engineering is the practice of carefully managing what information
goes into an LLM's context window.

Key techniques:
- Deterministic vs probabilistic context
- File system as memory
- Just-in-time retrieval
- Context compaction

The goal is to maximize signal-to-noise ratio in the context window.
    `,
  },
];

async function main() {
  const args = process.argv.slice(2);

  logHeader('BetterPrompt Learning Pipeline');

  let searchResults: WebSearchItem[];

  if (args.includes('--mock')) {
    log(`${colors.dim}Using mock data for testing${colors.reset}\n`);
    searchResults = MOCK_RESULTS;
  } else if (args[0]) {
    // Load results from file
    try {
      const fileContent = await readFile(args[0], 'utf-8');
      searchResults = JSON.parse(fileContent);
      log(`Loaded ${searchResults.length} results from ${args[0]}\n`);
    } catch (error) {
      logError(`Failed to load results file: ${error}`);
      process.exit(1);
    }
  } else {
    log(`${colors.dim}Usage: npx tsx scripts/learn.ts <json-file> | --mock${colors.reset}`);
    log(`\nNo input provided. Use --mock for testing or provide a JSON file.\n`);
    process.exit(0);
  }

  try {
    log(`${colors.cyan}Starting learning pipeline...${colors.reset}\n`);

    const result = await learn(searchResults, {
      includeForReview: false,
    });

    // Display results
    logHeader('Pipeline Results');

    log(`${colors.bold}Gathering:${colors.reset}`);
    logSuccess(`Gathered ${result.summary.totalGathered} items`);
    log(`  Platform breakdown: ${JSON.stringify(result.gathered.execution.stats.platformBreakdown)}`);

    log(`\n${colors.bold}Judging:${colors.reset}`);
    logSuccess(`Judged ${result.summary.totalJudged} items`);
    log(`  Accepted: ${result.judged.accepted.length}`);
    log(`  For review: ${result.judged.forReview.length}`);
    log(`  Rejected: ${result.judged.rejected.length}`);
    log(`  Average score: ${result.judged.stats.avgScore.toFixed(2)}`);

    log(`\n${colors.bold}Organizing:${colors.reset}`);
    logSuccess(`Organized ${result.summary.totalOrganized} items`);
    if (result.summary.duplicatesSkipped > 0) {
      logWarning(`Skipped ${result.summary.duplicatesSkipped} duplicates`);
    }
    if (result.summary.errors > 0) {
      logWarning(`${result.summary.errors} errors occurred`);
      result.organized.errors.forEach((e) => {
        log(`  - ${e.url}: ${e.error}`);
      });
    }

    // Show organized items
    if (result.organized.items.length > 0) {
      log(`\n${colors.bold}New Knowledge Items:${colors.reset}`);
      result.organized.items.forEach((item, i) => {
        log(`\n  ${i + 1}. ${colors.cyan}${item.title}${colors.reset}`);
        log(`     Category: ${item.category}`);
        log(`     Tags: ${item.tags.join(', ')}`);
        log(`     Score: ${item.relevance.score.toFixed(2)}`);
      });
    }

    // Show knowledge base stats
    logHeader('Knowledge Base Stats');
    const stats = await getKnowledgeStats();
    log(`Total items: ${stats.totalItems}`);
    log(`By category: ${JSON.stringify(stats.byCategory, null, 2)}`);
    log(`By status: ${JSON.stringify(stats.byStatus, null, 2)}`);

    log(`\n${colors.green}${colors.bold}Learning pipeline completed successfully!${colors.reset}\n`);
  } catch (error) {
    logError(`Pipeline failed: ${error}`);
    process.exit(1);
  }
}

main().catch(console.error);
