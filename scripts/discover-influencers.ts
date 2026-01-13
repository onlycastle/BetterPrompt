#!/usr/bin/env npx tsx
/**
 * Discover Influencers CLI
 *
 * Discovers content and potential influencers from social media platforms.
 *
 * Usage:
 *   npx tsx scripts/discover-influencers.ts search --topic "vibe-coding" --limit 10
 *   npx tsx scripts/discover-influencers.ts analyze --file results.json
 *   npx tsx scripts/discover-influencers.ts candidates
 *   npx tsx scripts/discover-influencers.ts add-candidate <name> --handle @handle
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import {
  createDiscoverySkill,
  aggregateInfluencers,
  generateSearchQueries,
  getTopicQueries,
  type DiscoveredContent,
  type CandidateInfluencer,
  DISCOVERY_TOPICS,
  type DiscoveryTopic,
  calculateEngagementScore,
  getInfluencerRegistry,
} from '../src/search-agent/index.js';

// Discovery storage paths
const DISCOVERY_BASE_PATH = join(homedir(), '.nomoreaislop', 'discovery');
const CONTENT_FILE = join(DISCOVERY_BASE_PATH, 'content.json');
const CANDIDATES_FILE = join(DISCOVERY_BASE_PATH, 'candidates.json');
const SESSIONS_FILE = join(DISCOVERY_BASE_PATH, 'sessions.json');

type Command = 'search' | 'analyze' | 'candidates' | 'add-candidate' | 'queries' | 'help';

interface SearchOptions {
  topic: DiscoveryTopic;
  platform?: string;
  limit: number;
  save: boolean;
}

function showHelp() {
  console.log(`
Discover Influencers CLI

Find and analyze content from AI engineering influencers.

Usage:
  npx tsx scripts/discover-influencers.ts <command> [options]

Commands:
  search           Search for content (requires manual WebSearch results)
  analyze          Analyze previously collected content
  candidates       List discovered candidate influencers
  add-candidate    Add a candidate to the main influencer registry
  queries          Show search queries for a topic
  help             Show this help message

Search Options:
  --topic <topic>  Topic to search: context-engineering, vibe-coding, claude-code, general
  --limit <n>      Maximum results per query (default: 10)
  --save           Save results to discovery storage

Analyze Options:
  --file <path>    Path to JSON file with search results

Add-Candidate Options:
  --name <name>    Candidate name (required)
  --handle <h>     Twitter/X handle
  --tier <tier>    Credibility tier: high, medium, standard (default: standard)

Examples:
  # Show queries for vibe-coding topic
  npx tsx scripts/discover-influencers.ts queries --topic vibe-coding

  # Analyze collected content
  npx tsx scripts/discover-influencers.ts analyze --file my-results.json

  # List candidate influencers
  npx tsx scripts/discover-influencers.ts candidates

  # Add a candidate to the registry
  npx tsx scripts/discover-influencers.ts add-candidate "New Person" --handle newperson --tier medium
`);
}

function ensureStorageDir() {
  if (!existsSync(DISCOVERY_BASE_PATH)) {
    mkdirSync(DISCOVERY_BASE_PATH, { recursive: true });
  }
}

function loadContent(): DiscoveredContent[] {
  if (!existsSync(CONTENT_FILE)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(CONTENT_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveContent(content: DiscoveredContent[]) {
  ensureStorageDir();
  writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2));
}

function loadCandidates(): CandidateInfluencer[] {
  if (!existsSync(CANDIDATES_FILE)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(CANDIDATES_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function saveCandidates(candidates: CandidateInfluencer[]) {
  ensureStorageDir();
  writeFileSync(CANDIDATES_FILE, JSON.stringify(candidates, null, 2));
}

function parseArgs(): { command: Command; args: string[] } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  const command = args[0] as Command;
  return { command, args: args.slice(1) };
}

function parseOptions(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        options[key] = value;
        i++;
      } else {
        options[key] = 'true';
      }
    } else if (!options._positional) {
      options._positional = arg;
    }
  }

  return options;
}

async function showQueries(topic: DiscoveryTopic) {
  console.log(`\n🔍 Search Queries for "${DISCOVERY_TOPICS[topic].displayName}"\n`);
  console.log('━'.repeat(60));

  const queries = getTopicQueries(topic);

  const byPriority = {
    high: queries.filter((q) => q.priority === 'high'),
    medium: queries.filter((q) => q.priority === 'medium'),
    low: queries.filter((q) => q.priority === 'low'),
  };

  console.log('\n🔴 High Priority:');
  for (const q of byPriority.high) {
    console.log(`  • ${q.query}`);
  }

  console.log('\n🟡 Medium Priority:');
  for (const q of byPriority.medium) {
    console.log(`  • ${q.query}`);
  }

  console.log('\n🟢 Low Priority:');
  for (const q of byPriority.low) {
    console.log(`  • ${q.query}`);
  }

  console.log('\n📋 Full Query List (for WebSearch):');
  const allQueries = generateSearchQueries({
    topics: [topic],
    platforms: ['twitter', 'reddit', 'youtube'],
    includeInfluencerQueries: true,
    priorityFilter: ['high', 'medium'],
  });
  console.log(`Total: ${allQueries.length} queries\n`);

  // Output as copyable list
  console.log('Copy these for manual search:');
  console.log('─'.repeat(40));
  for (const query of allQueries.slice(0, 20)) {
    console.log(query);
  }
  if (allQueries.length > 20) {
    console.log(`... and ${allQueries.length - 20} more`);
  }
}

async function analyzeContent(filePath: string) {
  console.log(`\n📊 Analyzing content from: ${filePath}\n`);

  if (!existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const rawData = JSON.parse(readFileSync(filePath, 'utf-8'));

  // Handle different input formats
  let searchResults: Array<{ url: string; title: string; snippet: string }>;

  if (Array.isArray(rawData)) {
    searchResults = rawData;
  } else if (rawData.results) {
    searchResults = rawData.results;
  } else {
    console.error('Error: Invalid file format. Expected array of search results.');
    process.exit(1);
  }

  console.log(`Found ${searchResults.length} results to analyze\n`);

  // Process through discovery skill
  const skill = createDiscoverySkill();
  const result = await skill.execute({
    searchResults: searchResults.map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet || r.title,
    })),
    query: 'manual import',
    topic: 'general',
  });

  if (!result.success || !result.data) {
    console.error(`Analysis failed: ${result.error}`);
    process.exit(1);
  }

  // Save discovered content
  const existingContent = loadContent();
  const newContent = [...existingContent, ...result.data.content];
  saveContent(newContent);

  console.log('━'.repeat(60));
  console.log(`✅ Analysis complete!`);
  console.log(`   Processed: ${result.data.stats.processedResults}`);
  console.log(`   Extracted: ${result.data.stats.contentExtracted}`);
  console.log(`   Passed engagement filter: ${result.data.stats.engagementFiltered}`);
  console.log(`   Errors: ${result.data.stats.errors}`);
  console.log(`\n   Total content in storage: ${newContent.length}`);

  // Aggregate into candidates
  const candidates = aggregateInfluencers(newContent);
  saveCandidates(candidates);

  console.log(`\n📋 Candidate Influencers Found: ${candidates.length}`);
  for (const candidate of candidates.slice(0, 5)) {
    console.log(`\n   ${candidate.name} (@${candidate.handles[0]?.handle})`);
    console.log(`   - Posts: ${candidate.contentCount}, Avg engagement: ${Math.round(candidate.avgEngagement)}`);
    console.log(`   - Tier: ${candidate.suggestedTier}`);
    console.log(`   - Topics: ${candidate.topTopics.slice(0, 3).join(', ')}`);
  }

  if (candidates.length > 5) {
    console.log(`\n   ... and ${candidates.length - 5} more candidates`);
  }
}

async function showCandidates() {
  const candidates = loadCandidates();

  if (candidates.length === 0) {
    console.log('\n📭 No candidate influencers discovered yet.');
    console.log('Run "analyze" command with search results first.\n');
    return;
  }

  console.log(`\n👥 Candidate Influencers (${candidates.length} total)\n`);
  console.log('━'.repeat(70));

  // Group by tier
  const byTier = {
    high: candidates.filter((c) => c.suggestedTier === 'high'),
    medium: candidates.filter((c) => c.suggestedTier === 'medium'),
    standard: candidates.filter((c) => c.suggestedTier === 'standard'),
  };

  const formatCandidate = (c: CandidateInfluencer, index: number) => {
    const handles = c.handles.map((h) => `${h.platform}:@${h.handle}`).join(', ');
    return `
  ${index + 1}. ${c.name}
     Handles: ${handles}
     Content: ${c.contentCount} posts | Avg Engagement: ${Math.round(c.avgEngagement)}
     Topics: ${c.topTopics.slice(0, 5).join(', ')}
     Reason: ${c.tierReasoning}
     Sample: ${c.sampleUrls[0] || 'N/A'}
`;
  };

  if (byTier.high.length > 0) {
    console.log('\n🌟 High Tier Candidates:');
    byTier.high.forEach((c, i) => console.log(formatCandidate(c, i)));
  }

  if (byTier.medium.length > 0) {
    console.log('\n⭐ Medium Tier Candidates:');
    byTier.medium.forEach((c, i) => console.log(formatCandidate(c, i)));
  }

  if (byTier.standard.length > 0) {
    console.log('\n✦ Standard Tier Candidates:');
    byTier.standard.slice(0, 10).forEach((c, i) => console.log(formatCandidate(c, i)));
    if (byTier.standard.length > 10) {
      console.log(`\n   ... and ${byTier.standard.length - 10} more standard tier candidates`);
    }
  }

  // Show comparison with existing registry
  const registry = getInfluencerRegistry();
  const existingHandles = new Set(
    registry.getAll().flatMap((inf) => inf.identifiers.map((id) => id.handle.toLowerCase()))
  );

  const newCandidates = candidates.filter(
    (c) => !c.handles.some((h) => existingHandles.has(h.handle.toLowerCase()))
  );

  console.log('\n📊 Summary:');
  console.log(`   Total candidates: ${candidates.length}`);
  console.log(`   New (not in registry): ${newCandidates.length}`);
  console.log(`   Already tracked: ${candidates.length - newCandidates.length}`);
}

async function addCandidate(options: Record<string, string>) {
  const name = options._positional || options.name;
  const handle = options.handle?.replace('@', '');
  const tier = (options.tier || 'standard') as 'high' | 'medium' | 'standard';

  if (!name) {
    console.error('Error: --name or positional name argument is required');
    process.exit(1);
  }

  if (!handle) {
    console.error('Error: --handle is required');
    process.exit(1);
  }

  const registry = getInfluencerRegistry();

  // Check if already exists
  const existing = registry.getAll().find((inf) =>
    inf.identifiers.some((id) => id.handle.toLowerCase() === handle.toLowerCase())
  );

  if (existing) {
    console.log(`\n⚠️  "${name}" (@${handle}) already exists in registry as "${existing.name}"`);
    return;
  }

  // Find candidate info
  const candidates = loadCandidates();
  const candidate = candidates.find((c) =>
    c.handles.some((h) => h.handle.toLowerCase() === handle.toLowerCase())
  );

  // Add to registry
  const newInfluencer = registry.add({
    name,
    description: candidate?.tierReasoning || `${name} - Discovered via content analysis`,
    credibilityTier: tier,
    identifiers: candidate?.handles || [{ platform: 'twitter', handle }],
    expertiseTopics: candidate?.topTopics || ['AI-engineering'],
    affiliation: candidate?.affiliation,
    isActive: true,
  });

  console.log(`\n✅ Added "${name}" to influencer registry!`);
  console.log(`   ID: ${newInfluencer.id}`);
  console.log(`   Tier: ${tier}`);
  console.log(`   Handle: @${handle}`);
  if (candidate) {
    console.log(`   Based on: ${candidate.contentCount} discovered posts`);
  }
}

async function main() {
  const { command, args } = parseArgs();
  const options = parseOptions(args);

  switch (command) {
    case 'queries': {
      const topic = (options.topic as DiscoveryTopic) || 'vibe-coding';
      if (!DISCOVERY_TOPICS[topic]) {
        console.error(`Invalid topic: ${topic}`);
        console.error(`Valid topics: ${Object.keys(DISCOVERY_TOPICS).join(', ')}`);
        process.exit(1);
      }
      await showQueries(topic);
      break;
    }

    case 'search': {
      console.log('\n📝 Search Command');
      console.log('━'.repeat(60));
      console.log('\nThis command generates queries but requires manual WebSearch execution.');
      console.log('Use Claude Code with WebSearch to run these queries, then use "analyze".\n');

      const topic = (options.topic as DiscoveryTopic) || 'vibe-coding';
      await showQueries(topic);
      break;
    }

    case 'analyze': {
      const file = options.file;
      if (!file) {
        console.error('Error: --file is required');
        console.error('Provide a JSON file with search results to analyze.');
        process.exit(1);
      }
      await analyzeContent(file);
      break;
    }

    case 'candidates': {
      await showCandidates();
      break;
    }

    case 'add-candidate': {
      await addCandidate(options);
      break;
    }

    case 'help':
    default:
      showHelp();
      break;
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
