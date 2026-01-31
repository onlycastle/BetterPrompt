/**
 * Phase 1 Step-by-Step Demo
 *
 * Usage: npx tsx scripts/phase1-steps-demo.ts
 */

import * as fs from 'fs';
import * as readline from 'readline';

const JSONL_PATH = '/Users/sungmancho/.claude/projects/-Users-sungmancho-projects-alfredworks/7fdbb780-a673-43b1-92f6-1f69c9b729f0.jsonl';

// STEP 1: stripSystemTags (XML 태그 제거)
function stripSystemTags(text: string): string {
  const systemTagPatterns = [
    /<system-reminder>[\s\S]*?<\/system-reminder>/g,
    /<command-name>[\s\S]*?<\/command-name>/g,
    /<command-message>[\s\S]*?<\/command-message>/g,
    /<command-args>[\s\S]*?<\/command-args>/g,
    /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
    /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
    /<local-command-stderr>[\s\S]*?<\/local-command-stderr>/g,
    /<task-notification>[\s\S]*?<\/task-notification>/g,
    /<task-id>[\s\S]*?<\/task-id>/g,
    /<status>[\s\S]*?<\/status>/g,
    /<summary>[\s\S]*?<\/summary>/g,
    /<result>[\s\S]*?<\/result>/g,
    /<output-file>[\s\S]*?<\/output-file>/g,
  ];
  let cleaned = text;
  for (const pattern of systemTagPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

// STEP 2a: isKnownSystemMetadata (regex fast path)
function isKnownSystemMetadata(text: string): boolean {
  const knownPatterns = [
    /^Base directory for this skill:/i,
    /^This skill is located at:/i,
    /^This session is being continued from a previous conversation/i,
    /^Continuing from previous session/i,
    /^IMPORTANT: this context may or may not be relevant/i,
    /^The following skills are available/i,
    /^Implement the following plan:/i,
    // Claude-generated Insight blocks (injected via session context)
    /★ Insight/,
    /`★ Insight/,
    /^─{10,}/,  // Lines starting with long dashes
  ];
  return knownPatterns.some(pattern => pattern.test(text.trim()));
}

function extractUserContent(msg: any): string {
  if (!msg || msg.type !== 'user') return '';
  const content = msg.message?.content;
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((c: any) => c.type === 'text').map((c: any) => c.text || '').join('\n');
  }
  return '';
}

async function main() {
  const fileStream = fs.createReadStream(JSONL_PATH);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let index = 0;

  console.log('='.repeat(80));
  console.log('Phase 1 Step-by-Step Demo');
  console.log('File:', JSONL_PATH.split('/').pop());
  console.log('='.repeat(80));

  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      const raw = extractUserContent(entry);
      if (!raw) continue;

      index++;
      const rawLen = raw.length;

      // STEP 1
      const step1 = stripSystemTags(raw);
      const step1Len = step1.length;
      const removedByStep1 = rawLen - step1Len;

      // STEP 2a
      const isKnown = isKnownSystemMetadata(step1);

      // Skip empty
      if (step1Len === 0) continue;

      console.log('\n' + '-'.repeat(80));
      console.log(`#${index} | Raw: ${rawLen}자 → Step1: ${step1Len}자 (${removedByStep1}자 제거)`);
      console.log('-'.repeat(80));

      // Show preview
      const preview = step1.slice(0, 200);
      console.log(`Preview: "${preview}${step1Len > 200 ? '...' : ''}"`);

      // Step 2a result
      if (isKnown) {
        console.log('\n⛔ STEP 2a: isKnownSystemMetadata() → FILTERED');
        console.log('   이 utterance는 시스템 메타데이터로 판정되어 제거됨');
      } else {
        const willUseLLM = step1Len >= 10;
        console.log(`\n✅ STEP 2a: isKnownSystemMetadata() → PASS`);
        console.log(`   STEP 2b: ${willUseLLM ? 'LLM 분류 진행 예정' : 'LLM SKIP (< 10자)'}`);
      }
    } catch {}
  }

  console.log('\n' + '='.repeat(80));
  console.log('Demo Complete');
  console.log('='.repeat(80));
}

main().catch(console.error);
