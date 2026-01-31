/**
 * Analyze utterances over 1000 chars
 */

import * as fs from 'fs';
import * as readline from 'readline';

const JSONL_PATH = '/Users/sungmancho/.claude/projects/-Users-sungmancho-projects-alfredworks/7fdbb780-a673-43b1-92f6-1f69c9b729f0.jsonl';

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

function detectType(text: string): string {
  const trimmed = text.trim();
  if (/^Base directory for this skill:/i.test(trimmed)) return 'SKILL_DOC';
  if (/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD) \/\S+.*\d{3}/m.test(trimmed)) return 'SERVER_LOG';
  if (/^(Error:|ERROR:|Exception:|Traceback|at \w+\.\w+\s*\()/im.test(trimmed)) return 'ERROR_STACK';
  if (/^\*\*|^##|^\d+\.|^- /.test(trimmed)) return 'MARKDOWN';
  if (/[가-힣]/.test(trimmed.slice(0, 50))) return 'KOREAN_TEXT';
  return 'OTHER';
}

async function main() {
  const fileStream = fs.createReadStream(JSONL_PATH);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const over1000: { len: number; type: string; preview: string }[] = [];

  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      const raw = extractUserContent(entry);
      if (!raw) continue;
      const cleaned = stripSystemTags(raw);
      if (cleaned.length >= 1000) {
        over1000.push({
          len: cleaned.length,
          type: detectType(cleaned),
          preview: cleaned.slice(0, 120),
        });
      }
    } catch {}
  }

  console.log('=== 1000자 이상 Utterances ===');
  console.log('Total:', over1000.length);
  console.log('');

  const byType: Record<string, number> = {};
  over1000.forEach((u) => {
    byType[u.type] = (byType[u.type] || 0) + 1;
  });

  console.log('By Type:');
  Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const pct = ((count / over1000.length) * 100).toFixed(0);
      console.log(`  ${type}: ${count} (${pct}%)`);
    });

  console.log('');
  console.log('=== Samples ===');
  over1000.forEach((u, i) => {
    console.log(`${i + 1}. [${u.len}자] ${u.type}`);
    console.log(`   "${u.preview}..."`);
  });
}

main().catch(console.error);
