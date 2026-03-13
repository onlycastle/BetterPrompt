/**
 * Analyze utterance length distribution in a JSONL session file
 *
 * Usage: npx tsx scripts/analyze-utterance-lengths.ts <jsonl-path>
 */

import * as fs from 'fs';
import * as readline from 'readline';

const JSONL_PATH = process.argv[2] || process.env.BETTERPROMPT_TEST_JSONL_PATH || '';

// Same logic as DataExtractorWorker.stripSystemTags
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

function extractUserContent(message: any): string {
  if (!message || message.type !== 'user') return '';

  const content = message.message?.content;
  if (!content) return '';

  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text || '')
      .join('\n');
  }
  return '';
}

interface UtteranceInfo {
  index: number;
  rawLength: number;
  cleanedLength: number;
  preview: string;
  classification: 'empty' | 'under_min' | 'over_min';
}

const MIN_LENGTH_FOR_LLM = 10;

async function analyzeFile(filePath: string): Promise<UtteranceInfo[]> {
  const results: UtteranceInfo[] = [];

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let index = 0;
  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      const rawContent = extractUserContent(entry);
      if (!rawContent) continue;

      const cleaned = stripSystemTags(rawContent);

      let classification: 'empty' | 'under_min' | 'over_min';
      if (cleaned.length === 0) {
        classification = 'empty';
      } else if (cleaned.length < MIN_LENGTH_FOR_LLM) {
        classification = 'under_min';
      } else {
        classification = 'over_min';
      }

      results.push({
        index: index++,
        rawLength: rawContent.length,
        cleanedLength: cleaned.length,
        preview: cleaned.slice(0, 100),
        classification,
      });
    } catch {}
  }

  return results;
}

async function main() {
  console.log('=== Utterance Length Analysis ===');
  if (!JSONL_PATH) {
    throw new Error('Provide a JSONL path as the first argument or set BETTERPROMPT_TEST_JSONL_PATH.');
  }
  console.log(`File: ${JSONL_PATH}\n`);

  const results = await analyzeFile(JSONL_PATH);

  const empty = results.filter(r => r.classification === 'empty');
  const underMin = results.filter(r => r.classification === 'under_min');
  const overMin = results.filter(r => r.classification === 'over_min');

  console.log('=== Summary ===');
  console.log(`Total utterances: ${results.length}`);
  console.log(`  Empty (system tags only): ${empty.length} (${(empty.length / results.length * 100).toFixed(1)}%)`);
  console.log(`  < ${MIN_LENGTH_FOR_LLM} chars (LLM skip):   ${underMin.length} (${(underMin.length / results.length * 100).toFixed(1)}%)`);
  console.log(`  >= ${MIN_LENGTH_FOR_LLM} chars (LLM filter): ${overMin.length} (${(overMin.length / results.length * 100).toFixed(1)}%)`);

  console.log(`\n=== Under ${MIN_LENGTH_FOR_LLM} chars samples (LLM skipped) ===`);
  underMin.slice(0, 15).forEach((u, i) => {
    console.log(`${i + 1}. [${u.cleanedLength}자] "${u.preview}${u.preview.length < u.cleanedLength ? '...' : ''}"`);
  });

  console.log('\n=== Empty samples (removed) ===');
  empty.slice(0, 5).forEach((u, i) => {
    console.log(`${i + 1}. Raw length: ${u.rawLength} → Cleaned: 0 (all system tags)`);
  });

  console.log('\n=== Length distribution ===');
  const buckets = [
    { label: '0', count: empty.length },
    { label: '1-50', count: results.filter(r => r.cleanedLength > 0 && r.cleanedLength <= 50).length },
    { label: '51-99', count: results.filter(r => r.cleanedLength > 50 && r.cleanedLength < 100).length },
    { label: '100-200', count: results.filter(r => r.cleanedLength >= 100 && r.cleanedLength <= 200).length },
    { label: '201-500', count: results.filter(r => r.cleanedLength > 200 && r.cleanedLength <= 500).length },
    { label: '501-1000', count: results.filter(r => r.cleanedLength > 500 && r.cleanedLength <= 1000).length },
    { label: '1000+', count: results.filter(r => r.cleanedLength > 1000).length },
  ];

  const maxCount = Math.max(...buckets.map(b => b.count));
  buckets.forEach(b => {
    const bar = '█'.repeat(Math.round(b.count / maxCount * 30));
    const pct = (b.count / results.length * 100).toFixed(1);
    console.log(`  ${b.label.padEnd(10)} ${b.count.toString().padStart(3)} (${pct.padStart(5)}%) ${bar}`);
  });
}

main().catch(console.error);
