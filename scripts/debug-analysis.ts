/**
 * Debug script to run analysis locally and see DEBUG logs
 *
 * Usage:
 *   npx tsx scripts/debug-analysis.ts
 *
 * Or with BETTERPROMPT_DEBUG for extra verbose output:
 *   BETTERPROMPT_DEBUG=1 npx tsx scripts/debug-analysis.ts
 *
 * Reads GOOGLE_GEMINI_API_KEY from .env file automatically.
 */

import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SessionParser } from '../src/lib/parser';
import { createVerboseAnalyzer } from '../src/lib/analyzer/verbose-analyzer';

async function main() {
  // Find Claude Code sessions
  const claudeDir = join(homedir(), '.claude', 'projects');

  console.log('[DEBUG:Script] Looking for sessions in:', claudeDir);

  // Get first project directory
  const projects = readdirSync(claudeDir).filter(f => !f.startsWith('.'));
  if (projects.length === 0) {
    console.error('No projects found in', claudeDir);
    process.exit(1);
  }

  const projectDir = join(claudeDir, projects[0]);
  console.log('[DEBUG:Script] Using project:', projectDir);

  // Find JSONL files
  const files = readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
  if (files.length === 0) {
    console.error('No JSONL files found in', projectDir);
    process.exit(1);
  }

  // Parse sessions (limit to first 3 for testing)
  const parser = new SessionParser();
  const sessions = [];

  for (const file of files.slice(0, 3)) {
    const sessionFile = join(projectDir, file);
    console.log('[DEBUG:Script] Parsing session:', sessionFile);
    try {
      const session = await parser.parseSessionFile(sessionFile);
      sessions.push(session);
    } catch (error) {
      console.log('[DEBUG:Script] Skipping session (error):', file);
    }
  }

  console.log('[DEBUG:Script] Parsed sessions:', sessions.length);
  console.log('[DEBUG:Script] Total messages:', sessions.reduce((sum, s) => sum + s.messages.length, 0));

  // Create analyzer
  const analyzer = createVerboseAnalyzer({
    debug: true,
  });

  // Calculate metrics
  const metrics = {
    totalSessions: sessions.length,
    totalMessages: sessions.reduce((sum, s) => sum + s.messages.length, 0),
    totalTokens: 0,
    dateRange: {
      start: sessions[0]?.startTime?.toISOString() ?? new Date().toISOString(),
      end: sessions[sessions.length - 1]?.endTime?.toISOString() ?? new Date().toISOString(),
    },
  };

  console.log('[DEBUG:Script] Starting analysis...');
  console.log('─'.repeat(60));

  try {
    const result = await analyzer.analyzeVerbose(sessions, metrics, {
      onProgress: (phase, message) => {
        console.log(`[Progress] Phase ${phase}: ${message}`);
      },
    });

    console.log('─'.repeat(60));
    console.log('[DEBUG:Script] Analysis complete!');
    console.log('[DEBUG:Script] Result type:', result.evaluation.primaryType);

  } catch (error) {
    console.error('[DEBUG:Script] Analysis failed:', error);
    process.exit(1);
  }
}

main();
