#!/usr/bin/env npx tsx
/**
 * Browse Knowledge Base
 *
 * Browse and filter knowledge items by various criteria.
 *
 * Usage:
 *   npx tsx scripts/browse-knowledge.ts
 *   npx tsx scripts/browse-knowledge.ts --platform youtube
 *   npx tsx scripts/browse-knowledge.ts --category prompt-engineering
 *   npx tsx scripts/browse-knowledge.ts --author "Andrej Karpathy"
 *   npx tsx scripts/browse-knowledge.ts --min-score 0.8
 */

import 'dotenv/config';
import {
  knowledgeDb,
  type SourcePlatform,
  type TopicCategory,
} from '../src/search-agent/index.js';

interface BrowseOptions {
  platform?: SourcePlatform;
  category?: TopicCategory;
  author?: string;
  minScore?: number;
  query?: string;
  limit: number;
  sortBy: 'relevance' | 'date' | 'score';
  showStats: boolean;
  showMetrics: boolean;
  json: boolean;
}

function showHelp() {
  console.log(`
Browse Knowledge Base

Usage:
  npx tsx scripts/browse-knowledge.ts [options]

Options:
  --platform <p>      Filter by platform: reddit, twitter, youtube, linkedin, web
  --category <c>      Filter by category: context-engineering, prompt-engineering, etc.
  --author <name>     Filter by author name or handle
  --min-score <n>     Minimum relevance score (0-1)
  --query <text>      Text search query
  --limit <n>         Maximum results (default: 20)
  --sort <field>      Sort by: relevance, date, score (default: score)
  --stats             Show knowledge base statistics
  --metrics           Show quality metrics
  --json              Output as JSON

Examples:
  npx tsx scripts/browse-knowledge.ts --stats
  npx tsx scripts/browse-knowledge.ts --platform youtube --limit 10
  npx tsx scripts/browse-knowledge.ts --category prompt-engineering --min-score 0.7
  npx tsx scripts/browse-knowledge.ts --author "Simon Willison"
  npx tsx scripts/browse-knowledge.ts --query "context engineering" --sort date
`);
}

function parseArgs(): BrowseOptions {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const options: BrowseOptions = {
    limit: 20,
    sortBy: 'score',
    showStats: false,
    showMetrics: false,
    json: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--platform':
        options.platform = value as SourcePlatform;
        i++;
        break;
      case '--category':
        options.category = value as TopicCategory;
        i++;
        break;
      case '--author':
        options.author = value;
        i++;
        break;
      case '--min-score':
        options.minScore = parseFloat(value);
        i++;
        break;
      case '--query':
        options.query = value;
        i++;
        break;
      case '--limit':
        options.limit = parseInt(value, 10);
        i++;
        break;
      case '--sort':
        options.sortBy = value as 'relevance' | 'date' | 'score';
        i++;
        break;
      case '--stats':
        options.showStats = true;
        break;
      case '--metrics':
        options.showMetrics = true;
        break;
      case '--json':
        options.json = true;
        break;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  // Show stats if requested
  if (options.showStats) {
    const stats = await knowledgeDb.getStats();

    if (options.json) {
      console.log(JSON.stringify(stats, null, 2));
      return;
    }

    console.log('\n📊 Knowledge Base Statistics\n');
    console.log('━'.repeat(40));
    console.log(`Total Items: ${stats.totalItems}`);
    console.log('');
    console.log('By Category:');
    for (const [cat, count] of Object.entries(stats.byCategory)) {
      console.log(`  ${cat}: ${count}`);
    }
    console.log('');
    console.log('By Status:');
    for (const [status, count] of Object.entries(stats.byStatus || {})) {
      console.log(`  ${status}: ${count}`);
    }
    console.log('');
    console.log('By Platform:');
    for (const [platform, count] of Object.entries(stats.byPlatform || {})) {
      console.log(`  ${platform}: ${count}`);
    }
    return;
  }

  // Show metrics if requested
  if (options.showMetrics) {
    const metrics = await knowledgeDb.getQualityMetrics();

    if (options.json) {
      console.log(JSON.stringify(metrics, null, 2));
      return;
    }

    console.log('\n📈 Quality Metrics\n');
    console.log('━'.repeat(40));
    console.log(`Total Items: ${metrics.totalItems}`);
    console.log(`Average Relevance Score: ${(metrics.averageRelevanceScore * 100).toFixed(1)}%`);
    console.log(`High Quality Items (≥70%): ${metrics.highQualityCount}`);
    console.log(`Influencer Content: ${metrics.influencerContentCount}`);
    console.log(`Recent Items (7 days): ${metrics.recentItemsCount}`);
    console.log('');
    console.log('Platform Distribution:');
    for (const [platform, count] of Object.entries(metrics.platformDistribution)) {
      const pct = ((count as number / metrics.totalItems) * 100).toFixed(1);
      console.log(`  ${platform}: ${count} (${pct}%)`);
    }
    console.log('');
    console.log('Category Distribution:');
    for (const [category, count] of Object.entries(metrics.categoryDistribution)) {
      const pct = ((count as number / metrics.totalItems) * 100).toFixed(1);
      console.log(`  ${category}: ${count} (${pct}%)`);
    }
    return;
  }

  // Map sortBy for database compatibility
  const dbSortBy = options.sortBy === 'score' ? 'relevance_score' :
                   options.sortBy === 'date' ? 'created_at' : 'created_at';

  // Search/browse knowledge
  const result = await knowledgeDb.search({
    platform: options.platform,
    category: options.category,
    author: options.author,
    minScore: options.minScore,
    query: options.query,
  }, {
    limit: options.limit,
    sortBy: dbSortBy,
    sortOrder: 'desc',
  });

  const items = result.items;

  if (options.json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }

  // Build filter description
  const filters: string[] = [];
  if (options.platform) filters.push(`platform=${options.platform}`);
  if (options.category) filters.push(`category=${options.category}`);
  if (options.author) filters.push(`author="${options.author}"`);
  if (options.minScore) filters.push(`minScore=${options.minScore}`);
  if (options.query) filters.push(`query="${options.query}"`);

  const filterDesc = filters.length > 0 ? `[${filters.join(', ')}]` : '[all]';

  console.log(`\n📚 Knowledge Base ${filterDesc}\n`);
  console.log(`Found ${items.length} item(s), sorted by ${options.sortBy}\n`);
  console.log('━'.repeat(70));

  if (items.length === 0) {
    console.log('No items found matching your criteria.');
    return;
  }

  for (const item of items) {
    const score = (item.relevance.score * 100).toFixed(0);
    const platform = item.source.platform;
    const date = new Date(item.createdAt).toLocaleDateString();

    const tierBadge = item.source.credibilityTier
      ? ` [${item.source.credibilityTier}]`
      : '';

    console.log(`\n📄 ${item.title.slice(0, 60)}${item.title.length > 60 ? '...' : ''}`);
    console.log(`   Score: ${score}% | Platform: ${platform}${tierBadge} | Date: ${date}`);
    console.log(`   Category: ${item.category} | Status: ${item.status}`);

    if (item.source.author || item.source.authorHandle) {
      console.log(`   Author: ${item.source.author || item.source.authorHandle}`);
    }

    console.log(`   Tags: ${item.tags.slice(0, 5).join(', ')}`);
    console.log(`   ${item.summary.slice(0, 150)}${item.summary.length > 150 ? '...' : ''}`);
    console.log(`   🔗 ${item.source.url}`);
  }

  console.log('\n' + '━'.repeat(70));
  console.log(`Showing ${items.length} of ${options.limit} max results`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
