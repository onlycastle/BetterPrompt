/**
 * Debug script to analyze a specific session file
 */

import 'dotenv/config';
import { SessionParser } from '../src/lib/parser';
import { createVerboseAnalyzer } from '../src/lib/analyzer/verbose-analyzer';

const SESSION_PATH = '/Users/sungmancho/.claude/projects/-Users-sungmancho-projects-weddingletter-invitation/128cad25-b36c-44f5-8efc-ba3aaabfdd25.jsonl';

async function main() {
  console.log('[DEBUG] Analyzing session:', SESSION_PATH);

  const parser = new SessionParser();
  const session = await parser.parseSessionFile(SESSION_PATH);

  console.log('[DEBUG] Session ID:', session.sessionId);
  console.log('[DEBUG] Total messages:', session.messages.length);

  // Count user messages
  const userMessages = session.messages.filter(m => m.role === 'user');
  console.log('[DEBUG] User messages:', userMessages.length);

  // Show first few user messages to see what we're dealing with
  console.log('\n[DEBUG] First 5 user messages (truncated to 200 chars):');
  userMessages.slice(0, 5).forEach((m, i) => {
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    console.log(`  ${i + 1}. "${content.slice(0, 200)}..."`);
  });

  // Check for system metadata patterns
  console.log('\n[DEBUG] Checking for system metadata patterns:');
  const patterns = [
    { name: 'Base directory for this skill', regex: /Base directory for this skill/i },
    { name: 'This session is being continued', regex: /This session is being continued/i },
    { name: 'Implement the following plan', regex: /Implement the following plan/i },
    { name: 'IMPORTANT: this context', regex: /IMPORTANT: this context may or may not/i },
  ];

  for (const { name, regex } of patterns) {
    const count = userMessages.filter(m => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return regex.test(content);
    }).length;
    console.log(`  - "${name}": ${count} occurrences`);
  }

  // Create analyzer and run
  const analyzer = createVerboseAnalyzer({ debug: true });

  const metrics = {
    totalSessions: 1,
    totalMessages: session.messages.length,
    totalTokens: 0,
    dateRange: {
      start: session.startTime?.toISOString() ?? new Date().toISOString(),
      end: session.endTime?.toISOString() ?? new Date().toISOString(),
    },
  };

  console.log('\n[DEBUG] Starting analysis pipeline...');
  console.log('─'.repeat(60));

  try {
    const result = await analyzer.analyzeVerbose([session], metrics, {
      onProgress: (phase, message) => {
        console.log(`[Progress] Phase ${phase}: ${message}`);
      },
    });

    console.log('─'.repeat(60));
    console.log('\n[DEBUG] Analysis complete!');
    console.log('[DEBUG] Developer type:', result.evaluation.primaryType);

    // Check the promptPatterns examples
    console.log('\n[DEBUG] Checking promptPatterns examples for system metadata:');
    if (result.evaluation.promptPatterns) {
      for (const pattern of result.evaluation.promptPatterns) {
        console.log(`\n  Pattern: ${pattern.patternName}`);
        if (pattern.examples && pattern.examples.length > 0) {
          for (const example of pattern.examples) {
            const quote = example.quote || example.quotedExample || '';
            console.log(`    Example quote (first 100 chars): "${quote.slice(0, 100)}..."`);
            if (/Base directory for this skill/i.test(quote) ||
                /This session is being continued/i.test(quote)) {
              console.log(`    ⚠️ FOUND SYSTEM METADATA IN EXAMPLE!`);
            }
          }
        }
      }
    }

    // Check if there are examples with system metadata
    console.log('\n[DEBUG] Checking behavioral patterns for system metadata leakage:');

    if (result.evaluation.behavioralPatterns) {
      for (const pattern of result.evaluation.behavioralPatterns) {
        console.log(`\n  Pattern: ${pattern.title}`);
        if (pattern.examples && pattern.examples.length > 0) {
          for (const example of pattern.examples) {
            const quote = example.quotedExample || '';
            if (/Base directory for this skill/i.test(quote) ||
                /This session is being continued/i.test(quote)) {
              console.log(`    ⚠️ FOUND SYSTEM METADATA IN EXAMPLE: "${quote.slice(0, 100)}..."`);
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('[DEBUG] Analysis failed:', error);
    process.exit(1);
  }
}

main();
