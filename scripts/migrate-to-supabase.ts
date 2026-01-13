#!/usr/bin/env npx tsx
/**
 * Supabase Migration Script
 *
 * Migrates existing JSON-based data to Supabase PostgreSQL.
 * Run this script once after setting up the Supabase schema.
 *
 * Usage:
 *   npx tsx scripts/migrate-to-supabase.ts
 *
 * Prerequisites:
 *   1. Supabase project created
 *   2. Schema created (run supabase/schema.sql)
 *   3. Environment variables set (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 */

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Paths to existing data
const KNOWLEDGE_PATH = join(homedir(), '.nomoreaislop', 'knowledge', 'items');
const INFLUENCER_PATH = join(homedir(), '.nomoreaislop', 'influencers.json');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('Please set these environment variables in .env or .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface MigrationStats {
  knowledgeMigrated: number;
  knowledgeErrors: number;
  influencersMigrated: number;
  influencersErrors: number;
}

const stats: MigrationStats = {
  knowledgeMigrated: 0,
  knowledgeErrors: 0,
  influencersMigrated: 0,
  influencersErrors: 0,
};

/**
 * Migrate knowledge items from JSON files to Supabase
 */
async function migrateKnowledge(): Promise<void> {
  console.log('\n📚 Migrating knowledge items...\n');

  if (!existsSync(KNOWLEDGE_PATH)) {
    console.log('  No knowledge items directory found. Skipping.');
    return;
  }

  const files = await readdir(KNOWLEDGE_PATH);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));

  console.log(`  Found ${jsonFiles.length} knowledge items to migrate.\n`);

  for (const file of jsonFiles) {
    try {
      const content = await readFile(join(KNOWLEDGE_PATH, file), 'utf-8');
      const item = JSON.parse(content);

      const { error } = await supabase.from('knowledge_items').upsert({
        id: item.id,
        version: item.version || '1.0.0',
        title: item.title,
        summary: item.summary,
        content: item.content,
        category: item.category,
        content_type: item.contentType,
        tags: item.tags || [],
        source: item.source,
        relevance: item.relevance,
        status: item.status || 'draft',
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        related_items: item.relatedItems || [],
        supersedes: item.supersedes,
      });

      if (error) {
        console.error(`  ❌ Failed to migrate ${file}: ${error.message}`);
        stats.knowledgeErrors++;
      } else {
        console.log(`  ✅ Migrated: ${item.title.substring(0, 50)}...`);
        stats.knowledgeMigrated++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Error processing ${file}: ${message}`);
      stats.knowledgeErrors++;
    }
  }
}

/**
 * Migrate influencers from JSON file to Supabase
 */
async function migrateInfluencers(): Promise<void> {
  console.log('\n👤 Migrating influencers...\n');

  if (!existsSync(INFLUENCER_PATH)) {
    console.log('  No influencers file found. Skipping.');
    return;
  }

  try {
    const content = await readFile(INFLUENCER_PATH, 'utf-8');
    const registry = JSON.parse(content);

    if (!registry.influencers || !Array.isArray(registry.influencers)) {
      console.log('  No influencers array found in registry. Skipping.');
      return;
    }

    console.log(`  Found ${registry.influencers.length} influencers to migrate.\n`);

    for (const inf of registry.influencers) {
      try {
        // Insert influencer
        const { data: infData, error: infError } = await supabase
          .from('influencers')
          .upsert({
            id: inf.id,
            name: inf.name,
            description: inf.description,
            credibility_tier: inf.credibilityTier,
            expertise_topics: inf.expertiseTopics || [],
            affiliation: inf.affiliation,
            content_count: inf.contentCount || 0,
            is_active: inf.isActive ?? true,
            added_at: inf.addedAt,
            updated_at: inf.updatedAt,
            last_content_at: inf.lastContentAt,
          })
          .select()
          .single();

        if (infError) {
          console.error(`  ❌ Failed to migrate influencer ${inf.name}: ${infError.message}`);
          stats.influencersErrors++;
          continue;
        }

        // Insert identifiers
        if (inf.identifiers && Array.isArray(inf.identifiers) && inf.identifiers.length > 0) {
          for (const id of inf.identifiers) {
            const { error: idError } = await supabase.from('influencer_identifiers').upsert(
              {
                influencer_id: infData.id,
                platform: id.platform,
                handle: id.handle,
                profile_url: id.profileUrl,
              },
              {
                onConflict: 'influencer_id,platform,handle',
              }
            );

            if (idError) {
              console.warn(
                `    ⚠️ Failed to add identifier ${id.platform}:${id.handle}: ${idError.message}`
              );
            }
          }
        }

        console.log(`  ✅ Migrated: ${inf.name}`);
        stats.influencersMigrated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  ❌ Error migrating influencer ${inf.name}: ${message}`);
        stats.influencersErrors++;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ❌ Error reading influencers file: ${message}`);
  }
}

/**
 * Print migration summary
 */
function printSummary(): void {
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary');
  console.log('='.repeat(50));
  console.log(`\n📚 Knowledge Items:`);
  console.log(`   ✅ Migrated: ${stats.knowledgeMigrated}`);
  console.log(`   ❌ Errors: ${stats.knowledgeErrors}`);
  console.log(`\n👤 Influencers:`);
  console.log(`   ✅ Migrated: ${stats.influencersMigrated}`);
  console.log(`   ❌ Errors: ${stats.influencersErrors}`);

  const totalMigrated = stats.knowledgeMigrated + stats.influencersMigrated;
  const totalErrors = stats.knowledgeErrors + stats.influencersErrors;

  console.log('\n' + '-'.repeat(50));
  console.log(`   Total Migrated: ${totalMigrated}`);
  console.log(`   Total Errors: ${totalErrors}`);
  console.log('='.repeat(50) + '\n');

  if (totalErrors > 0) {
    console.log('⚠️  Some items failed to migrate. Check the errors above.');
  } else if (totalMigrated > 0) {
    console.log('✅ Migration completed successfully!');
  } else {
    console.log('ℹ️  No data found to migrate.');
  }
}

/**
 * Main migration function
 */
async function main(): Promise<void> {
  console.log('='.repeat(50));
  console.log('🚀 Starting Supabase Migration');
  console.log('='.repeat(50));
  console.log(`\n📍 Supabase URL: ${supabaseUrl}`);
  console.log(`📁 Knowledge path: ${KNOWLEDGE_PATH}`);
  console.log(`📁 Influencer path: ${INFLUENCER_PATH}`);

  // Test connection
  console.log('\n🔗 Testing Supabase connection...');
  const { error: testError } = await supabase.from('knowledge_items').select('count').limit(1);

  if (testError) {
    console.error(`\n❌ Failed to connect to Supabase: ${testError.message}`);
    console.error('\nPossible issues:');
    console.error('  1. Schema not created (run supabase/schema.sql first)');
    console.error('  2. Invalid credentials');
    console.error('  3. Network issues');
    process.exit(1);
  }

  console.log('✅ Connection successful!');

  // Run migrations
  await migrateKnowledge();
  await migrateInfluencers();

  // Print summary
  printSummary();
}

// Run
main().catch((err) => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
