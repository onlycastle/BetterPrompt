/**
 * Test script to analyze multiple session files and check for system metadata leakage
 */

import 'dotenv/config';
import { SessionParser } from '../src/lib/parser';
import { createVerboseAnalyzer } from '../src/lib/analyzer/verbose-analyzer';

const SESSION_PATHS = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : (process.env.NOSLOP_TEST_SESSION_PATHS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

const SYSTEM_METADATA_PATTERNS = [
  { name: 'Base directory for this skill', regex: /Base directory for this skill/i },
  { name: 'This session is being continued', regex: /This session is being continued/i },
  { name: 'Implement the following plan', regex: /Implement the following plan/i },
  { name: 'IMPORTANT: this context', regex: /IMPORTANT: this context may or may not/i },
  { name: 'The following skills are available', regex: /The following skills are available/i },
];

function checkForSystemMetadata(text: string): string[] {
  const matches: string[] = [];
  for (const { name, regex } of SYSTEM_METADATA_PATTERNS) {
    if (regex.test(text)) {
      matches.push(name);
    }
  }
  return matches;
}

async function analyzeSession(sessionPath: string): Promise<{
  success: boolean;
  sessionId: string;
  userMessages: number;
  filteredPatterns: Record<string, number>;
  leakedPatterns: { pattern: string; quote: string }[];
  error?: string;
}> {
  const parser = new SessionParser();

  try {
    const session = await parser.parseSessionFile(sessionPath);

    // Count system metadata in raw user messages
    const userMessages = session.messages.filter(m => m.role === 'user');
    const filteredPatterns: Record<string, number> = {};

    for (const msg of userMessages) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const matches = checkForSystemMetadata(content);
      for (const match of matches) {
        filteredPatterns[match] = (filteredPatterns[match] || 0) + 1;
      }
    }

    // Run analysis
    const analyzer = createVerboseAnalyzer({ debug: false });
    const metrics = {
      totalSessions: 1,
      totalMessages: session.messages.length,
      totalTokens: 0,
      dateRange: {
        start: session.startTime?.toISOString() ?? new Date().toISOString(),
        end: session.endTime?.toISOString() ?? new Date().toISOString(),
      },
    };

    const result = await analyzer.analyzeVerbose([session], metrics);

    // Check for leaked system metadata in promptPatterns examples
    const leakedPatterns: { pattern: string; quote: string }[] = [];

    if (result.evaluation.promptPatterns) {
      for (const pattern of result.evaluation.promptPatterns) {
        if (pattern.examples) {
          for (const example of pattern.examples) {
            const quote = example.quote || example.quotedExample || '';
            const matches = checkForSystemMetadata(quote);
            if (matches.length > 0) {
              leakedPatterns.push({
                pattern: pattern.patternName,
                quote: quote.slice(0, 100) + '...',
              });
            }
          }
        }
      }
    }

    // Also check behavioral patterns
    if (result.evaluation.behavioralPatterns) {
      for (const pattern of result.evaluation.behavioralPatterns) {
        if (pattern.examples) {
          for (const example of pattern.examples) {
            const quote = example.quotedExample || '';
            const matches = checkForSystemMetadata(quote);
            if (matches.length > 0) {
              leakedPatterns.push({
                pattern: pattern.title,
                quote: quote.slice(0, 100) + '...',
              });
            }
          }
        }
      }
    }

    return {
      success: true,
      sessionId: session.sessionId,
      userMessages: userMessages.length,
      filteredPatterns,
      leakedPatterns,
    };
  } catch (error) {
    return {
      success: false,
      sessionId: sessionPath.split('/').pop()?.replace('.jsonl', '') || 'unknown',
      userMessages: 0,
      filteredPatterns: {},
      leakedPatterns: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  if (SESSION_PATHS.length === 0) {
    throw new Error(
      'Provide one or more JSONL paths as arguments or set NOSLOP_TEST_SESSION_PATHS.'
    );
  }

  console.log('='.repeat(80));
  console.log('Testing System Metadata Filtering Across Multiple Sessions');
  console.log('='.repeat(80));

  let totalSessions = 0;
  let successfulSessions = 0;
  let totalLeaks = 0;

  for (const sessionPath of SESSION_PATHS) {
    totalSessions++;
    const shortPath = sessionPath.split('/').slice(-2).join('/');
    console.log(`\n[${totalSessions}/${SESSION_PATHS.length}] Analyzing: ${shortPath}`);
    console.log('─'.repeat(60));

    const result = await analyzeSession(sessionPath);

    if (!result.success) {
      console.log(`  ❌ ERROR: ${result.error}`);
      continue;
    }

    successfulSessions++;
    console.log(`  Session ID: ${result.sessionId.slice(0, 8)}...`);
    console.log(`  User messages: ${result.userMessages}`);

    // Show filtered patterns
    const patternCount = Object.values(result.filteredPatterns).reduce((a, b) => a + b, 0);
    if (patternCount > 0) {
      console.log(`  System metadata in raw input: ${patternCount}`);
      for (const [name, count] of Object.entries(result.filteredPatterns)) {
        console.log(`    - ${name}: ${count}`);
      }
    } else {
      console.log(`  System metadata in raw input: 0 (clean session)`);
    }

    // Show leaks
    if (result.leakedPatterns.length > 0) {
      totalLeaks += result.leakedPatterns.length;
      console.log(`  ⚠️  LEAKS FOUND: ${result.leakedPatterns.length}`);
      for (const leak of result.leakedPatterns) {
        console.log(`    Pattern: ${leak.pattern}`);
        console.log(`    Quote: "${leak.quote}"`);
      }
    } else {
      console.log(`  ✅ No leaks - filtering working correctly`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total sessions tested: ${totalSessions}`);
  console.log(`Successful analyses: ${successfulSessions}`);
  console.log(`Total leaks found: ${totalLeaks}`);

  if (totalLeaks === 0) {
    console.log('\n✅ ALL SESSIONS PASSED - No system metadata leaked to output');
  } else {
    console.log(`\n⚠️  ${totalLeaks} LEAKS DETECTED - Review filtering patterns`);
    process.exit(1);
  }
}

main();
