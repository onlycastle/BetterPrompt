/**
 * Analyze Insight/Summary patterns in assistant messages
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';

const PROJECTS_DIR = '/Users/sungmancho/.claude/projects';

interface PatternMatch {
  pattern: string;
  count: number;
  samples: string[];
}

const patterns: Record<string, PatternMatch> = {
  'insight_star': { pattern: '★ Insight', count: 0, samples: [] },
  'insight_backtick': { pattern: '`★ Insight', count: 0, samples: [] },
  'separator_line': { pattern: '─────', count: 0, samples: [] },
  'summary_korean': { pattern: '요약', count: 0, samples: [] },
  'summary_english': { pattern: 'Summary', count: 0, samples: [] },
  'implementation_complete': { pattern: '구현 완료', count: 0, samples: [] },
  'files_created': { pattern: '생성된 파일', count: 0, samples: [] },
  'key_points': { pattern: '핵심 포인트', count: 0, samples: [] },
  'important': { pattern: '**중요', count: 0, samples: [] },
  'tip': { pattern: '**Tip', count: 0, samples: [] },
};

function extractContext(content: string, pattern: string, chars: number = 200): string {
  const idx = content.indexOf(pattern);
  if (idx === -1) return '';
  const start = Math.max(0, idx - 20);
  const end = Math.min(content.length, idx + chars);
  return content.slice(start, end).replace(/\n/g, '\\n');
}

function extractContent(rawContent: any): string {
  if (typeof rawContent === 'string') return rawContent;
  if (Array.isArray(rawContent)) {
    return rawContent
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text || '')
      .join('\n');
  }
  return '';
}

async function analyzeFile(filePath: string): Promise<void> {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'assistant') continue;

      const content = extractContent(entry.message?.content);
      if (!content) continue;

      for (const [key, match] of Object.entries(patterns)) {
        if (content.includes(match.pattern)) {
          match.count++;
          if (match.samples.length < 3) {
            match.samples.push(extractContext(content, match.pattern));
          }
        }
      }
    } catch {}
  }
}

async function main() {
  console.log('=== Insight/Summary 패턴 분석 ===\n');

  // Get project directories
  const projectDirs = fs.readdirSync(PROJECTS_DIR)
    .filter(d => d.startsWith('-Users'))
    .slice(0, 5); // Top 5 projects

  let totalFiles = 0;

  for (const projectDir of projectDirs) {
    const projectPath = path.join(PROJECTS_DIR, projectDir);
    const jsonlFiles = fs.readdirSync(projectPath)
      .filter(f => f.endsWith('.jsonl'))
      .slice(0, 30); // Max 30 files per project

    for (const jsonlFile of jsonlFiles) {
      await analyzeFile(path.join(projectPath, jsonlFile));
      totalFiles++;
    }
  }

  console.log(`Analyzed ${totalFiles} files from ${projectDirs.length} projects\n`);

  console.log('=== Pattern Frequency ===\n');

  const sorted = Object.entries(patterns)
    .sort((a, b) => b[1].count - a[1].count);

  for (const [key, match] of sorted) {
    if (match.count === 0) continue;
    console.log(`${match.pattern}: ${match.count}회`);
    if (match.samples.length > 0) {
      console.log(`  Sample: "${match.samples[0].slice(0, 150)}..."`);
    }
    console.log('');
  }

  // Now analyze user messages for leaked assistant content
  console.log('\n=== User 메시지에 포함된 Assistant 패턴 ===\n');

  const userPatterns: Record<string, number> = {};

  for (const projectDir of projectDirs) {
    const projectPath = path.join(PROJECTS_DIR, projectDir);
    const jsonlFiles = fs.readdirSync(projectPath)
      .filter(f => f.endsWith('.jsonl'))
      .slice(0, 30);

    for (const jsonlFile of jsonlFiles) {
      const stream = fs.createReadStream(path.join(projectPath, jsonlFile));
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

      for await (const line of rl) {
        try {
          const entry = JSON.parse(line);
          if (entry.type !== 'user') continue;

          const content = entry.message?.content;
          if (typeof content !== 'string') continue;

          for (const [key, match] of Object.entries(patterns)) {
            if (content.includes(match.pattern)) {
              userPatterns[key] = (userPatterns[key] || 0) + 1;
            }
          }
        } catch {}
      }
    }
  }

  const userSorted = Object.entries(userPatterns)
    .sort((a, b) => b[1] - a[1]);

  if (userSorted.length === 0) {
    console.log('No assistant patterns found in user messages.');
  } else {
    for (const [key, count] of userSorted) {
      const pattern = patterns[key]?.pattern || key;
      console.log(`${pattern}: ${count}회 (user 메시지에서 발견)`);
    }
  }
}

main().catch(console.error);
