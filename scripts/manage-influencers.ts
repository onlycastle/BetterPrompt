#!/usr/bin/env npx tsx
/**
 * Manage Influencer Registry
 *
 * Add, remove, list, and manage tracked influencers.
 *
 * Usage:
 *   npx tsx scripts/manage-influencers.ts list
 *   npx tsx scripts/manage-influencers.ts stats
 *   npx tsx scripts/manage-influencers.ts add --name "Name" --twitter "@handle"
 *   npx tsx scripts/manage-influencers.ts remove <id>
 *   npx tsx scripts/manage-influencers.ts search <query>
 */

import {
  getInfluencerRegistry,
  type Influencer,
  type CredibilityTier,
  type InfluencerPlatform,
} from '../src/search-agent/index.js';

type Command = 'list' | 'stats' | 'add' | 'remove' | 'search' | 'reset' | 'export';

interface AddOptions {
  name: string;
  description?: string;
  tier: CredibilityTier;
  twitter?: string;
  youtube?: string;
  linkedin?: string;
  github?: string;
  topics: string[];
  affiliation?: string;
}

function showHelp() {
  console.log(`
Manage Influencer Registry

Usage:
  npx tsx scripts/manage-influencers.ts <command> [options]

Commands:
  list              List all tracked influencers
  stats             Show influencer statistics
  add               Add a new influencer
  remove <id>       Remove an influencer by ID
  search <query>    Search influencers by name or topic
  reset             Reset to default influencers
  export            Export registry as JSON

Add Options:
  --name <name>         Influencer name (required)
  --description <desc>  Description
  --tier <tier>         Credibility tier: high, medium, standard (default: standard)
  --twitter <handle>    Twitter/X handle
  --youtube <channel>   YouTube channel name
  --linkedin <profile>  LinkedIn profile
  --github <username>   GitHub username
  --topics <t1,t2,...>  Comma-separated expertise topics
  --affiliation <org>   Organization affiliation

Examples:
  npx tsx scripts/manage-influencers.ts list
  npx tsx scripts/manage-influencers.ts add --name "John Doe" --twitter "johndoe" --tier medium --topics "AI,coding"
  npx tsx scripts/manage-influencers.ts search "prompt engineering"
`);
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

function parseAddOptions(args: string[]): AddOptions {
  const options: AddOptions = {
    name: '',
    tier: 'standard',
    topics: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = args[i + 1];

    switch (arg) {
      case '--name':
        options.name = value;
        i++;
        break;
      case '--description':
        options.description = value;
        i++;
        break;
      case '--tier':
        options.tier = value as CredibilityTier;
        i++;
        break;
      case '--twitter':
        options.twitter = value.replace('@', '');
        i++;
        break;
      case '--youtube':
        options.youtube = value;
        i++;
        break;
      case '--linkedin':
        options.linkedin = value;
        i++;
        break;
      case '--github':
        options.github = value;
        i++;
        break;
      case '--topics':
        options.topics = value.split(',').map((t) => t.trim());
        i++;
        break;
      case '--affiliation':
        options.affiliation = value;
        i++;
        break;
    }
  }

  return options;
}

function formatInfluencer(inf: Influencer): string {
  const platforms = inf.identifiers
    .map((id) => `${id.platform}:@${id.handle}`)
    .join(', ');

  return `
  ID: ${inf.id}
  Name: ${inf.name}
  Tier: ${inf.credibilityTier}
  Platforms: ${platforms}
  Topics: ${inf.expertiseTopics.join(', ')}
  Affiliation: ${inf.affiliation || 'Independent'}
  Content Count: ${inf.contentCount}
  Status: ${inf.isActive ? '✅ Active' : '❌ Inactive'}
`;
}

async function main() {
  const { command, args } = parseArgs();
  const registry = getInfluencerRegistry();

  switch (command) {
    case 'list': {
      const influencers = registry.getAll();
      console.log(`\n📋 Tracked Influencers (${influencers.length} total)\n`);
      console.log('━'.repeat(60));

      for (const inf of influencers) {
        const tierIcon = {
          high: '🌟',
          medium: '⭐',
          standard: '✦',
        }[inf.credibilityTier];

        console.log(`${tierIcon} ${inf.name} (${inf.credibilityTier})`);
        const handles = inf.identifiers.map((id) => `@${id.handle}`).join(', ');
        console.log(`   ${handles}`);
        console.log(`   Topics: ${inf.expertiseTopics.slice(0, 4).join(', ')}`);
        if (!inf.isActive) console.log('   ❌ Inactive');
        console.log('');
      }
      break;
    }

    case 'stats': {
      const stats = registry.getStats();
      console.log('\n📊 Influencer Registry Statistics\n');
      console.log('━'.repeat(40));
      console.log(`Total Influencers: ${stats.total}`);
      console.log(`Active: ${stats.active}`);
      console.log('');
      console.log('By Tier:');
      console.log(`  🌟 High: ${stats.byTier.high}`);
      console.log(`  ⭐ Medium: ${stats.byTier.medium}`);
      console.log(`  ✦ Standard: ${stats.byTier.standard}`);
      console.log('');
      console.log(`Total Content Tracked: ${stats.totalContent}`);
      break;
    }

    case 'add': {
      const options = parseAddOptions(args);

      if (!options.name) {
        console.error('Error: --name is required');
        process.exit(1);
      }

      if (options.topics.length === 0) {
        console.error('Error: At least one topic is required (--topics)');
        process.exit(1);
      }

      const identifiers: { platform: InfluencerPlatform; handle: string }[] = [];
      if (options.twitter) identifiers.push({ platform: 'twitter', handle: options.twitter });
      if (options.youtube) identifiers.push({ platform: 'youtube', handle: options.youtube });
      if (options.linkedin) identifiers.push({ platform: 'linkedin', handle: options.linkedin });
      if (options.github) identifiers.push({ platform: 'github', handle: options.github });

      if (identifiers.length === 0) {
        console.error('Error: At least one platform identifier is required');
        process.exit(1);
      }

      const newInfluencer = registry.add({
        name: options.name,
        description: options.description || `${options.name} - AI engineering influencer`,
        credibilityTier: options.tier,
        identifiers,
        expertiseTopics: options.topics,
        affiliation: options.affiliation,
        isActive: true,
      });

      console.log('\n✅ Added influencer:');
      console.log(formatInfluencer(newInfluencer));
      break;
    }

    case 'remove': {
      const id = args[0];
      if (!id) {
        console.error('Error: Influencer ID is required');
        process.exit(1);
      }

      const influencer = registry.getById(id);
      if (!influencer) {
        console.error(`Error: Influencer not found: ${id}`);
        process.exit(1);
      }

      registry.remove(id);
      console.log(`\n✅ Removed influencer: ${influencer.name}`);
      break;
    }

    case 'search': {
      const query = args.join(' ').toLowerCase();
      if (!query) {
        console.error('Error: Search query is required');
        process.exit(1);
      }

      const all = registry.getAll();
      const matches = all.filter((inf) =>
        inf.name.toLowerCase().includes(query) ||
        inf.expertiseTopics.some((t) => t.toLowerCase().includes(query)) ||
        inf.identifiers.some((id) => id.handle.toLowerCase().includes(query))
      );

      console.log(`\n🔍 Search Results for "${query}" (${matches.length} found)\n`);

      if (matches.length === 0) {
        console.log('No matches found.');
      } else {
        for (const inf of matches) {
          console.log(formatInfluencer(inf));
          console.log('━'.repeat(40));
        }
      }
      break;
    }

    case 'reset': {
      console.log('\n⚠️  This will reset the registry to default influencers.');
      console.log('Press Ctrl+C to cancel or wait 3 seconds to continue...\n');

      await new Promise((resolve) => setTimeout(resolve, 3000));

      registry.resetToDefaults();
      console.log('✅ Registry reset to defaults');
      break;
    }

    case 'export': {
      const json = registry.export();
      console.log(json);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
