#!/usr/bin/env npx tsx
/**
 * Search Knowledge CLI Script
 *
 * Search the local knowledge base for AI engineering information.
 *
 * Usage:
 *   npx tsx scripts/search-knowledge.ts <query>
 *   npx tsx scripts/search-knowledge.ts "context engineering" --limit 5
 */

import { searchKnowledge, getTopKnowledge, type KnowledgeItem } from '../src/search-agent/index.js';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string) {
  console.log(message);
}

function formatItem(item: KnowledgeItem, index: number) {
  const scoreColor =
    item.relevance.score >= 0.7
      ? colors.green
      : item.relevance.score >= 0.4
        ? colors.yellow
        : colors.dim;

  log(`\n${colors.bold}${index + 1}. ${item.title}${colors.reset}`);
  log(`   ${colors.dim}${item.source.url}${colors.reset}`);
  log(`   Category: ${colors.cyan}${item.category}${colors.reset}`);
  log(`   Type: ${item.contentType}`);
  log(`   Tags: ${item.tags.join(', ')}`);
  log(`   Score: ${scoreColor}${item.relevance.score.toFixed(2)}${colors.reset}`);
  log(`   Status: ${item.status}`);
  log(`\n   ${colors.dim}Summary:${colors.reset}`);
  log(`   ${item.summary.slice(0, 200)}${item.summary.length > 200 ? '...' : ''}`);
}

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let query = '';
  let limit = 10;
  let showTop = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--top') {
      showTop = true;
    } else if (!args[i].startsWith('--')) {
      query = args[i];
    }
  }

  if (!query && !showTop) {
    log(`${colors.bold}Usage:${colors.reset}`);
    log(`  npx tsx scripts/search-knowledge.ts <query> [--limit N]`);
    log(`  npx tsx scripts/search-knowledge.ts --top [--limit N]`);
    log(`\n${colors.dim}Examples:${colors.reset}`);
    log(`  npx tsx scripts/search-knowledge.ts "context engineering"`);
    log(`  npx tsx scripts/search-knowledge.ts "CLAUDE.md" --limit 5`);
    log(`  npx tsx scripts/search-knowledge.ts --top --limit 10`);
    process.exit(0);
  }

  try {
    let items: KnowledgeItem[];

    if (showTop) {
      log(`\n${colors.bold}${colors.blue}═══ Top Knowledge Items ═══${colors.reset}\n`);
      items = await getTopKnowledge(limit);
    } else {
      log(`\n${colors.bold}${colors.blue}═══ Search Results for "${query}" ═══${colors.reset}\n`);
      items = await searchKnowledge(query, limit);
    }

    if (items.length === 0) {
      log(`${colors.dim}No results found.${colors.reset}`);
      log(`\nTry running the learning pipeline first:`);
      log(`  npx tsx scripts/learn.ts --mock`);
      process.exit(0);
    }

    log(`Found ${items.length} item(s):`);

    items.forEach((item, i) => formatItem(item, i));

    log(`\n${colors.dim}─────────────────────────────────────${colors.reset}\n`);
  } catch (error) {
    log(`${colors.red}Error: ${error}${colors.reset}`);
    process.exit(1);
  }
}

main().catch(console.error);
