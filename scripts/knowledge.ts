#!/usr/bin/env npx tsx
/**
 * Knowledge Management CLI Script
 *
 * Browse and manage the knowledge base.
 *
 * Usage:
 *   npx tsx scripts/knowledge.ts list [--category <cat>]
 *   npx tsx scripts/knowledge.ts show <id>
 *   npx tsx scripts/knowledge.ts stats
 *   npx tsx scripts/knowledge.ts export [--format md|json]
 */

import {
  knowledgeStore,
  getKnowledgeStats,
  type KnowledgeItem,
  type TopicCategory,
  TOPIC_DISPLAY_NAMES,
} from '../src/search-agent/index.js';

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

async function listItems(category?: TopicCategory) {
  await knowledgeStore.initialize();

  let items: KnowledgeItem[];
  if (category) {
    items = await knowledgeStore.listByCategory(category);
    logHeader(`Knowledge Items: ${TOPIC_DISPLAY_NAMES[category]}`);
  } else {
    items = await knowledgeStore.listItems();
    logHeader('All Knowledge Items');
  }

  if (items.length === 0) {
    log(`${colors.dim}No items found.${colors.reset}`);
    log(`\nRun the learning pipeline to gather knowledge:`);
    log(`  npx tsx scripts/learn.ts --mock`);
    return;
  }

  // Sort by score descending
  items.sort((a, b) => b.relevance.score - a.relevance.score);

  log(`Total: ${items.length} item(s)\n`);

  // Table header
  log(
    `${colors.dim}${'ID'.padEnd(8)} ${'Title'.padEnd(50)} ${'Category'.padEnd(20)} ${'Score'.padEnd(6)} Status${colors.reset}`
  );
  log(`${colors.dim}${'─'.repeat(100)}${colors.reset}`);

  items.forEach((item) => {
    const id = item.id.slice(0, 8);
    const title = item.title.length > 48 ? item.title.slice(0, 45) + '...' : item.title;
    const category = item.category.padEnd(20);
    const score = item.relevance.score.toFixed(2);
    const status = item.status;

    log(`${id} ${title.padEnd(50)} ${category} ${score.padEnd(6)} ${status}`);
  });
}

async function showItem(id: string) {
  await knowledgeStore.initialize();

  // Find item by partial ID match
  const items = await knowledgeStore.listItems();
  const item = items.find((i) => i.id.startsWith(id) || i.id === id);

  if (!item) {
    log(`${colors.red}Item not found: ${id}${colors.reset}`);
    return;
  }

  logHeader('Knowledge Item Details');

  log(`${colors.bold}ID:${colors.reset} ${item.id}`);
  log(`${colors.bold}Title:${colors.reset} ${item.title}`);
  log(`${colors.bold}Category:${colors.reset} ${TOPIC_DISPLAY_NAMES[item.category]}`);
  log(`${colors.bold}Type:${colors.reset} ${item.contentType}`);
  log(`${colors.bold}Tags:${colors.reset} ${item.tags.join(', ')}`);
  log(`${colors.bold}Status:${colors.reset} ${item.status}`);
  log(`${colors.bold}Score:${colors.reset} ${item.relevance.score.toFixed(2)} (confidence: ${item.relevance.confidence.toFixed(2)})`);

  log(`\n${colors.bold}Source:${colors.reset}`);
  log(`  Platform: ${item.source.platform}`);
  log(`  URL: ${item.source.url}`);
  log(`  Fetched: ${item.source.fetchedAt}`);

  log(`\n${colors.bold}Summary:${colors.reset}`);
  log(`${item.summary}`);

  log(`\n${colors.bold}Content:${colors.reset}`);
  log(`${item.content}`);

  log(`\n${colors.bold}Relevance Reasoning:${colors.reset}`);
  log(`${item.relevance.reasoning}`);

  log(`\n${colors.dim}Created: ${item.createdAt}${colors.reset}`);
  log(`${colors.dim}Updated: ${item.updatedAt}${colors.reset}`);
}

async function showStats() {
  logHeader('Knowledge Base Statistics');

  const stats = await getKnowledgeStats();

  log(`${colors.bold}Total Items:${colors.reset} ${stats.totalItems}`);

  log(`\n${colors.bold}By Category:${colors.reset}`);
  Object.entries(stats.byCategory).forEach(([cat, count]) => {
    const displayName = TOPIC_DISPLAY_NAMES[cat as TopicCategory] || cat;
    const bar = '█'.repeat(Math.min(count, 20));
    log(`  ${displayName.padEnd(25)} ${bar} ${count}`);
  });

  log(`\n${colors.bold}By Status:${colors.reset}`);
  Object.entries(stats.byStatus).forEach(([status, count]) => {
    log(`  ${status.padEnd(15)} ${count}`);
  });
}

async function exportKnowledge(format: 'md' | 'json') {
  await knowledgeStore.initialize();
  const items = await knowledgeStore.listItems();

  if (format === 'json') {
    console.log(JSON.stringify(items, null, 2));
  } else {
    // Markdown format
    log(`# BetterPrompt Knowledge Base\n`);
    log(`Total items: ${items.length}\n`);
    log(`Exported: ${new Date().toISOString()}\n`);

    // Group by category
    const byCategory = new Map<TopicCategory, KnowledgeItem[]>();
    items.forEach((item) => {
      const list = byCategory.get(item.category) || [];
      list.push(item);
      byCategory.set(item.category, list);
    });

    byCategory.forEach((categoryItems, category) => {
      log(`\n## ${TOPIC_DISPLAY_NAMES[category]}\n`);
      categoryItems.forEach((item) => {
        log(`### ${item.title}\n`);
        log(`- **Score:** ${item.relevance.score.toFixed(2)}`);
        log(`- **Type:** ${item.contentType}`);
        log(`- **Tags:** ${item.tags.join(', ')}`);
        log(`- **Source:** [${item.source.platform}](${item.source.url})\n`);
        log(`${item.summary}\n`);
      });
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';

  try {
    switch (command) {
      case 'list': {
        const catIdx = args.indexOf('--category');
        const category = catIdx !== -1 ? (args[catIdx + 1] as TopicCategory) : undefined;
        await listItems(category);
        break;
      }
      case 'show': {
        const id = args[1];
        if (!id) {
          log(`${colors.red}Usage: knowledge.ts show <id>${colors.reset}`);
          process.exit(1);
        }
        await showItem(id);
        break;
      }
      case 'stats': {
        await showStats();
        break;
      }
      case 'export': {
        const formatIdx = args.indexOf('--format');
        const format = formatIdx !== -1 ? (args[formatIdx + 1] as 'md' | 'json') : 'md';
        await exportKnowledge(format);
        break;
      }
      default: {
        log(`${colors.bold}Knowledge Base Management${colors.reset}\n`);
        log(`Usage: npx tsx scripts/knowledge.ts <command> [options]\n`);
        log(`Commands:`);
        log(`  list [--category <cat>]  List knowledge items`);
        log(`  show <id>                Show item details`);
        log(`  stats                    Show statistics`);
        log(`  export [--format md|json] Export knowledge base`);
        log(`\nCategories:`);
        Object.entries(TOPIC_DISPLAY_NAMES).forEach(([key, name]) => {
          log(`  ${key.padEnd(25)} ${name}`);
        });
      }
    }
  } catch (error) {
    log(`${colors.red}Error: ${error}${colors.reset}`);
    process.exit(1);
  }
}

main().catch(console.error);
