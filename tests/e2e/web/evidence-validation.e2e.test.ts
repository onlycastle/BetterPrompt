/**
 * E2E Tests for Evidence Validation
 *
 * Validates that every evidence quote in the generated report
 * maps to a real user utterance from the JSONL session files.
 *
 * Prerequisites:
 * - A completed `bp analyze` run with report at ~/.betterprompt/reports/latest.html
 * - The server running at localhost:3000 with analysis data synced
 */

import { test, expect } from '@playwright/test';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

// ---------------------------------------------------------------------------
// Similarity scoring (mirrors packages/plugin/cli/commands/verify-evidence.ts)
// ---------------------------------------------------------------------------

function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(' ')
    .filter((t) => t.length > 1);
}

function bigrams(text: string): string[] {
  const n = normalizeText(text).replace(/\s+/g, ' ');
  if (n.length < 2) return n ? [n] : [];
  const grams: string[] = [];
  for (let i = 0; i < n.length - 1; i++) grams.push(n.slice(i, i + 2));
  return grams;
}

function diceCoefficient(left: string, right: string): number {
  const lb = bigrams(left);
  const rb = bigrams(right);
  if (!lb.length || !rb.length) return 0;
  const rc = new Map<string, number>();
  for (const g of rb) rc.set(g, (rc.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of lb) {
    const c = rc.get(g) ?? 0;
    if (c > 0) {
      hit++;
      rc.set(g, c - 1);
    }
  }
  return (2 * hit) / (lb.length + rb.length);
}

function scoreEvidence(quote: string, utterance: string): number {
  const nq = normalizeText(quote);
  const nu = normalizeText(utterance);
  if (!nq || !nu) return 0;
  if (nu.includes(nq) || nq.includes(nu)) return 100;

  const qt = tokenize(quote);
  const ut = new Set(tokenize(utterance));
  if (!qt.length) return 0;

  const shared = qt.filter((t) => ut.has(t)).length;
  const coverage = shared / qt.length;
  const dice = diceCoefficient(nq, nu);

  if (coverage >= 0.85 || dice >= 0.82) return 85;
  if (coverage >= 0.6 || dice >= 0.65) return 65;
  if (coverage >= 0.4 || dice >= 0.5) return 45;
  return 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ReportEvidence {
  quote: string;
  utteranceId: string;
  domain: string;
}

const REPORT_PATH = join(homedir(), '.betterprompt', 'reports', 'latest.html');
const SESSIONS_BASE = join(homedir(), '.claude', 'projects');

function collectJsonlFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      files.push(...collectJsonlFiles(full));
    } else if (entry.endsWith('.jsonl')) {
      files.push(full);
    }
  }
  return files;
}

function parseUtterancesFromJSONL(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  const jsonlFiles = collectJsonlFiles(dir);

  for (const file of jsonlFiles) {
    const content = readFileSync(file, 'utf-8');
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.type !== 'user') continue;

        const id = entry.uuid ?? entry.id ?? '';
        let text = '';
        if (typeof entry.message?.content === 'string') {
          text = entry.message.content;
        } else if (Array.isArray(entry.message?.content)) {
          text = entry.message.content
            .filter((b: { type: string }) => b.type === 'text')
            .map((b: { text: string }) => b.text)
            .join(' ');
        }

        if (id && text) map.set(id, text);
      } catch {
        // skip malformed lines
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Evidence Quality Validation', () => {
  let reportHtml: string;
  let reportExists: boolean;
  let evidenceItems: ReportEvidence[];
  let utterances: Map<string, string>;

  test.beforeAll(() => {
    reportExists = existsSync(REPORT_PATH);
    if (!reportExists) return;

    reportHtml = readFileSync(REPORT_PATH, 'utf-8');
    utterances = parseUtterancesFromJSONL(SESSIONS_BASE);

    // Parse evidence from HTML using regex (no DOM needed for static HTML)
    evidenceItems = [];
    // Match domain sections: data-domain="aiPartnership" etc.
    const domainPattern = /data-domain="([^"]+)"/g;
    const domains: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = domainPattern.exec(reportHtml)) !== null) {
      domains.push(match[1]);
    }

    // Extract evidence items from <details> sections
    // Pattern: evidence-quote contains the quote text, evidence-meta contains utteranceId
    const evidenceBlockPattern =
      /<li class="evidence-item">\s*<div class="evidence-quote">"([^"]*)"<\/div>(?:\s*<div class="evidence-context">[^<]*<\/div>)?\s*<div class="evidence-meta"><code>([^<]*)<\/code><\/div>/g;

    // Split by domain sections and extract
    const domainSectionPattern = /data-domain="([^"]+)"[\s\S]*?(?=data-domain="|$)/g;
    let sectionMatch: RegExpExecArray | null;
    while ((sectionMatch = domainSectionPattern.exec(reportHtml)) !== null) {
      const domain = sectionMatch[1];
      const sectionHtml = sectionMatch[0];
      let evidenceMatch: RegExpExecArray | null;
      const localPattern = new RegExp(evidenceBlockPattern.source, 'g');
      while ((evidenceMatch = localPattern.exec(sectionHtml)) !== null) {
        evidenceItems.push({
          quote: evidenceMatch[1],
          utteranceId: evidenceMatch[2],
          domain,
        });
      }
    }
  });

  test('report file exists at ~/.betterprompt/reports/latest.html', () => {
    expect(reportExists).toBe(true);
  });

  test('report contains evidence items', () => {
    test.skip(!reportExists, 'No report file found');
    expect(evidenceItems.length).toBeGreaterThan(0);
  });

  test('session utterances are available for cross-reference', () => {
    test.skip(!reportExists, 'No report file found');
    expect(utterances.size).toBeGreaterThan(0);
  });

  test('every evidence quote maps to a real user utterance', () => {
    test.skip(!reportExists, 'No report file found');
    test.skip(evidenceItems.length === 0, 'No evidence items found');

    const unmatchedItems: Array<{ quote: string; utteranceId: string; domain: string; bestScore: number }> = [];
    const THRESHOLD = 50;

    for (const item of evidenceItems) {
      // First try direct utteranceId lookup
      const directMatch = utterances.get(item.utteranceId);
      if (directMatch) {
        const score = scoreEvidence(item.quote, directMatch);
        if (score >= THRESHOLD) continue;
      }

      // Fall back to best match across all utterances
      let bestScore = 0;
      for (const [, text] of utterances) {
        const score = scoreEvidence(item.quote, text);
        if (score > bestScore) bestScore = score;
        if (score >= THRESHOLD) break;
      }

      if (bestScore < THRESHOLD) {
        unmatchedItems.push({
          quote: item.quote.slice(0, 100),
          utteranceId: item.utteranceId,
          domain: item.domain,
          bestScore,
        });
      }
    }

    if (unmatchedItems.length > 0) {
      console.log(
        `Unmatched evidence (${unmatchedItems.length}/${evidenceItems.length}):`,
        JSON.stringify(unmatchedItems, null, 2),
      );
    }

    expect(unmatchedItems.length).toBe(0);
  });

  test('no duplicate evidence quotes across domains', () => {
    test.skip(!reportExists, 'No report file found');
    test.skip(evidenceItems.length === 0, 'No evidence items found');

    const seen = new Map<string, string>(); // normalized quote → domain
    const duplicates: Array<{ quote: string; domain1: string; domain2: string }> = [];

    for (const item of evidenceItems) {
      const normalized = normalizeText(item.quote);
      if (!normalized) continue;

      const existing = seen.get(normalized);
      if (existing && existing !== item.domain) {
        duplicates.push({
          quote: item.quote.slice(0, 80),
          domain1: existing,
          domain2: item.domain,
        });
      } else {
        seen.set(normalized, item.domain);
      }
    }

    // Also check near-duplicates using Dice coefficient (>85% similarity)
    const quotes = evidenceItems.map((e) => ({ text: normalizeText(e.quote), domain: e.domain, original: e.quote }));
    for (let i = 0; i < quotes.length; i++) {
      for (let j = i + 1; j < quotes.length; j++) {
        if (quotes[i].domain === quotes[j].domain) continue;
        const dice = diceCoefficient(quotes[i].text, quotes[j].text);
        if (dice > 0.85) {
          duplicates.push({
            quote: `${quotes[i].original.slice(0, 40)}... ≈ ${quotes[j].original.slice(0, 40)}...`,
            domain1: quotes[i].domain,
            domain2: quotes[j].domain,
          });
        }
      }
    }

    if (duplicates.length > 0) {
      console.log('Cross-domain duplicates:', JSON.stringify(duplicates, null, 2));
    }

    expect(duplicates.length).toBe(0);
  });

  test('each domain has at least 2 evidence items', () => {
    test.skip(!reportExists, 'No report file found');
    test.skip(evidenceItems.length === 0, 'No evidence items found');

    const domainCounts = new Map<string, number>();
    for (const item of evidenceItems) {
      domainCounts.set(item.domain, (domainCounts.get(item.domain) ?? 0) + 1);
    }

    const underserved: Array<{ domain: string; count: number }> = [];
    for (const [domain, count] of domainCounts) {
      if (count < 2) {
        underserved.push({ domain, count });
      }
    }

    if (underserved.length > 0) {
      console.log('Domains with insufficient evidence:', underserved);
    }

    expect(underserved.length).toBe(0);
  });

  test('evidence quotes are not excessively short', () => {
    test.skip(!reportExists, 'No report file found');
    test.skip(evidenceItems.length === 0, 'No evidence items found');

    const MIN_QUOTE_LENGTH = 15;
    const tooShort = evidenceItems.filter((e) => e.quote.length < MIN_QUOTE_LENGTH);

    if (tooShort.length > 0) {
      console.log(
        `Short quotes (< ${MIN_QUOTE_LENGTH} chars):`,
        tooShort.map((e) => ({ quote: e.quote, domain: e.domain })),
      );
    }

    // Allow at most 10% of evidence to be short
    expect(tooShort.length).toBeLessThan(Math.max(1, Math.ceil(evidenceItems.length * 0.1)));
  });

  test('evidence spans multiple sessions', () => {
    test.skip(!reportExists, 'No report file found');
    test.skip(evidenceItems.length === 0, 'No evidence items found');

    const uniqueUtteranceIds = new Set(evidenceItems.map((e) => e.utteranceId));

    // We want evidence drawn from at least 2 different utterances
    // (indicating diversity, not all from one session)
    expect(uniqueUtteranceIds.size).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Evidence in Browser Report', () => {
  const reportPath = join(homedir(), '.betterprompt', 'reports', 'latest.html');

  test.beforeEach(async ({ page }) => {
    test.skip(!existsSync(reportPath), 'No report file found');
    // Serve the static HTML report
    await page.goto(`file://${reportPath}`);
    await page.waitForLoadState('domcontentloaded');
  });

  test('evidence details sections are collapsible', async ({ page }) => {
    const details = page.locator('details');
    const count = await details.count();
    test.skip(count === 0, 'No details elements found');

    // Check first details element toggles open/close
    const first = details.first();
    const summary = first.locator('summary');
    await expect(summary).toBeVisible();

    // Click to open
    await summary.click();
    await expect(first).toHaveAttribute('open', '');

    // Click to close
    await summary.click();
    // After closing, the 'open' attribute should be removed
    await expect(first).not.toHaveAttribute('open', '');
  });

  test('evidence quotes are rendered in the DOM', async ({ page }) => {
    const quotes = page.locator('.evidence-quote');
    const count = await quotes.count();

    // Should have evidence quotes in the report
    expect(count).toBeGreaterThan(0);
  });

  test('evidence meta shows utterance IDs', async ({ page }) => {
    const metas = page.locator('.evidence-meta code');
    const count = await metas.count();

    expect(count).toBeGreaterThan(0);

    // Check first meta is not empty
    const firstText = await metas.first().textContent();
    expect(firstText?.trim().length).toBeGreaterThan(0);
  });

  test('each domain section contains evidence', async ({ page }) => {
    const domainSections = page.locator('[data-domain]');
    const domainCount = await domainSections.count();
    test.skip(domainCount === 0, 'No domain sections found');

    for (let i = 0; i < domainCount; i++) {
      const section = domainSections.nth(i);
      const domain = await section.getAttribute('data-domain');
      const evidence = section.locator('.evidence-item');
      const evidenceCount = await evidence.count();

      // Each domain should have at least 1 evidence item
      expect(
        evidenceCount,
        `Domain "${domain}" should have at least 1 evidence item`,
      ).toBeGreaterThanOrEqual(1);
    }
  });
});
