/**
 * Test Insight pattern filtering
 */

import * as fs from 'fs';
import * as readline from 'readline';

const JSONL_PATH = process.argv[2] || '/Users/sungmancho/.claude/projects/-Users-sungmancho-projects-alfredworks/927ecd0c-058b-4e0a-bf14-b1b044c72ec3.jsonl';

function stripSystemTags(text: string): string {
  const patterns = [
    /<system-reminder>[\s\S]*?<\/system-reminder>/g,
    /<command-name>[\s\S]*?<\/command-name>/g,
    /<task-notification>[\s\S]*?<\/task-notification>/g,
  ];
  let cleaned = text;
  for (const p of patterns) cleaned = cleaned.replace(p, '');
  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

function isKnownSystemMetadata(text: string): boolean {
  const patterns = [
    /^Base directory for this skill:/i,
    /★ Insight/,
    /`★ Insight/,
    /^─{10,}/,
  ];
  return patterns.some(p => p.test(text.trim()));
}

function extractUserContent(msg: any): string {
  if (!msg || msg.type !== 'user') return '';
  const content = msg.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text || '')
      .join('');
  }
  return '';
}

async function main() {
  console.log('=== Insight Filter Test ===');
  console.log('File:', JSONL_PATH.split('/').pop());
  console.log('');

  const stream = fs.createReadStream(JSONL_PATH);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let idx = 0;
  let filtered = 0;
  let passed = 0;

  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      const raw = extractUserContent(entry);
      if (!raw) continue;

      idx++;
      const cleaned = stripSystemTags(raw);
      if (cleaned.length === 0) continue;

      const isFiltered = isKnownSystemMetadata(cleaned);

      if (isFiltered) {
        filtered++;
        const matchedPattern =
          cleaned.includes('★ Insight') ? '★ Insight' :
          cleaned.includes('Base directory') ? 'Base directory' :
          '─────';
        console.log(`#${idx} ⛔ FILTERED [${cleaned.length}자]`);
        console.log(`   Pattern: ${matchedPattern}`);
        console.log(`   Preview: "${cleaned.slice(0, 80)}..."`);
        console.log('');
      } else {
        passed++;
      }
    } catch {}
  }

  console.log('=== Summary ===');
  console.log(`Total: ${idx}`);
  console.log(`Passed: ${passed}`);
  console.log(`Filtered: ${filtered}`);
}

main().catch(console.error);
