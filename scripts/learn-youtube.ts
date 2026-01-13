#!/usr/bin/env npx tsx
/**
 * Learn from YouTube Videos
 *
 * Fetches and analyzes YouTube video transcripts for AI engineering insights.
 *
 * Usage:
 *   npx tsx scripts/learn-youtube.ts <video-url>
 *   npx tsx scripts/learn-youtube.ts <playlist-url> --playlist
 *   npx tsx scripts/learn-youtube.ts <video-url> --save
 *
 * Options:
 *   --playlist     Process all videos in a playlist
 *   --max <n>      Maximum videos to process from playlist (default: 10)
 *   --save         Save results to knowledge base
 *   --json         Output as JSON
 */

import 'dotenv/config';
import {
  learnFromYouTube,
  isYouTubeUrl,
  parseYouTubeVideoId,
  parseYouTubePlaylistId,
  knowledgeDb,
  KnowledgeItem,
} from '../src/search-agent/index.js';
import { randomUUID } from 'node:crypto';

interface Args {
  url: string;
  playlist: boolean;
  max: number;
  save: boolean;
  json: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Learn from YouTube Videos

Usage:
  npx tsx scripts/learn-youtube.ts <video-url>
  npx tsx scripts/learn-youtube.ts <playlist-url> --playlist

Options:
  --playlist     Process all videos in a playlist
  --max <n>      Maximum videos to process (default: 10)
  --save         Save results to knowledge base
  --json         Output as JSON

Examples:
  npx tsx scripts/learn-youtube.ts https://youtube.com/watch?v=VIDEO_ID
  npx tsx scripts/learn-youtube.ts https://youtube.com/playlist?list=PLAYLIST_ID --playlist --max 5
  npx tsx scripts/learn-youtube.ts https://youtube.com/watch?v=VIDEO_ID --save
`);
    process.exit(0);
  }

  const url = args[0];
  const playlist = args.includes('--playlist');
  const json = args.includes('--json');
  const save = args.includes('--save');

  let max = 10;
  const maxIndex = args.indexOf('--max');
  if (maxIndex !== -1 && args[maxIndex + 1]) {
    max = parseInt(args[maxIndex + 1], 10);
  }

  return { url, playlist, max, save, json };
}

async function main() {
  const args = parseArgs();

  // Validate URL
  if (!isYouTubeUrl(args.url)) {
    console.error('Error: Invalid YouTube URL');
    process.exit(1);
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  const videoId = parseYouTubeVideoId(args.url);
  const playlistId = parseYouTubePlaylistId(args.url);

  if (args.playlist && !playlistId) {
    console.error('Error: --playlist flag requires a playlist URL');
    process.exit(1);
  }

  console.log('🎬 Learning from YouTube...\n');

  if (videoId && !args.playlist) {
    console.log(`📺 Video ID: ${videoId}`);
  } else if (playlistId) {
    console.log(`📋 Playlist ID: ${playlistId}`);
    console.log(`   Max videos: ${args.max}`);
  }

  console.log('');

  try {
    const result = await learnFromYouTube(args.url, {
      processPlaylist: args.playlist,
      maxPlaylistVideos: args.max,
    });

    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // Display results
    console.log(`✅ Processed ${result.stats.videosProcessed} video(s)`);
    if (result.stats.videosFailed > 0) {
      console.log(`⚠️  Failed: ${result.stats.videosFailed} video(s)`);
    }
    console.log('');

    for (const { transcript, analysis } of result.results) {
      console.log('━'.repeat(60));
      console.log(`📺 ${transcript.video.title}`);
      console.log(`   Channel: ${transcript.video.channelName}`);
      console.log(`   URL: ${transcript.video.url}`);
      console.log('');

      console.log('📝 Summary:');
      console.log(`   ${analysis.summary}`);
      console.log('');

      console.log(`🎯 Relevance Score: ${(analysis.relevanceToAICoding * 100).toFixed(0)}%`);
      console.log('');

      console.log('💡 Key Insights:');
      for (const insight of analysis.keyInsights) {
        console.log(`   • ${insight}`);
      }
      console.log('');

      console.log('🏷️  Topics:', analysis.topics.join(', '));

      if (analysis.codeExamples.length > 0) {
        console.log('');
        console.log('💻 Code Examples Found:', analysis.codeExamples.length);
      }

      if (analysis.timestamps && analysis.timestamps.length > 0) {
        console.log('');
        console.log('⏱️  Key Timestamps:');
        for (const ts of analysis.timestamps.slice(0, 5)) {
          console.log(`   ${ts.timeFormatted} - ${ts.topic}`);
        }
      }
      console.log('');
    }

    // Save to knowledge base if requested
    if (args.save) {
      console.log('💾 Saving to knowledge base...');

      let saved = 0;
      for (const { transcript, analysis } of result.results) {
        // Skip low-relevance content
        if (analysis.relevanceToAICoding < 0.3) {
          console.log(`   ⏭️  Skipping "${transcript.video.title}" (low relevance)`);
          continue;
        }

        const item: KnowledgeItem = {
          id: randomUUID(),
          version: '1.0.0',
          title: transcript.video.title.slice(0, 200),
          summary: analysis.summary.slice(0, 1000),
          content: analysis.keyInsights.join('\n\n').slice(0, 10000),
          category: 'best-practices',
          contentType: 'insight',
          tags: [...analysis.topics.slice(0, 8), 'youtube', 'video-transcript'],
          source: {
            platform: 'youtube',
            url: transcript.video.url,
            author: transcript.video.channelName,
            authorHandle: transcript.video.channelName,
            fetchedAt: transcript.fetchedAt,
          },
          relevance: {
            score: analysis.relevanceToAICoding,
            confidence: 0.8,
            reasoning: `YouTube video analysis with ${analysis.keyInsights.length} key insights identified`,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: analysis.relevanceToAICoding >= 0.7 ? 'approved' : 'reviewed',
        };

        await knowledgeDb.save(item);
        saved++;
        console.log(`   ✅ Saved: ${transcript.video.title.slice(0, 50)}...`);
      }

      console.log(`\n💾 Saved ${saved} item(s) to knowledge base`);
    }

    // Show errors if any
    if (result.errors.length > 0) {
      console.log('\n⚠️  Errors:');
      for (const err of result.errors) {
        console.log(`   ${err.url}: ${err.error}`);
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
