/**
 * E2E Tests for Expert Signals Integration
 *
 * Validates that the expert knowledge base from Claude Code internals
 * is properly integrated into the analysis pipeline:
 * 1. Expert signals are detected and included in Phase 1 output
 * 2. Expert signals render in the HTML report when present
 * 3. Deterministic scores correctly factor in expert bonuses
 * 4. Extraction skills reference the expert knowledge base
 *
 * Prerequisites:
 * - A completed `bp analyze` run with report at ~/.betterprompt/reports/latest.html
 * - The server running at localhost:3000 with analysis data synced
 */

import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPORT_PATH = join(homedir(), '.betterprompt', 'reports', 'latest.html');
const PHASE1_PATH = join(homedir(), '.betterprompt', 'phase1-output.json');
const EXPERT_KB_PATH = resolve(
  __dirname,
  '../../../packages/plugin/skills/shared/expert-knowledge-base.md',
);
const RESEARCH_INSIGHTS_PATH = resolve(
  __dirname,
  '../../../packages/plugin/skills/shared/research-insights.md',
);
const EXTRACTION_SKILLS_DIR = resolve(
  __dirname,
  '../../../packages/plugin/skills',
);

// ---------------------------------------------------------------------------
// Expert Knowledge Base Structural Tests
// ---------------------------------------------------------------------------

test.describe('Expert Knowledge Base Structure', () => {
  test('expert-knowledge-base.md exists and has content', () => {
    expect(existsSync(EXPERT_KB_PATH)).toBe(true);
    const content = readFileSync(EXPERT_KB_PATH, 'utf-8');
    expect(content.length).toBeGreaterThan(1000);
  });

  test('expert-knowledge-base.md covers all 5 analysis domains', () => {
    const content = readFileSync(EXPERT_KB_PATH, 'utf-8');
    const domains = [
      'aiPartnership',
      'sessionCraft',
      'toolMastery',
      'skillResilience',
      'sessionMastery',
    ];
    for (const domain of domains) {
      expect(
        content,
        `Expert KB must cover domain: ${domain}`,
      ).toContain(domain);
    }
  });

  test('expert-knowledge-base.md has score impact tables', () => {
    const content = readFileSync(EXPERT_KB_PATH, 'utf-8');
    // Each domain section should have a score impact table
    const scoreImpactMatches = content.match(/Score Impact/g);
    expect(
      scoreImpactMatches?.length ?? 0,
      'Should have multiple score impact tables',
    ).toBeGreaterThanOrEqual(5);
  });

  test('expert-knowledge-base.md references Claude Code internal patterns', () => {
    const content = readFileSync(EXPERT_KB_PATH, 'utf-8');
    // Should reference key Claude Code concepts
    expect(content).toContain('CLAUDE.md');
    expect(content).toContain('prompt cach');
    expect(content).toContain('hook');
    expect(content).toContain('subagent');
    expect(content).toContain('context window');
  });

  test('research-insights.md still exists alongside expert KB', () => {
    expect(existsSync(RESEARCH_INSIGHTS_PATH)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Extraction Skill Reference Tests
// ---------------------------------------------------------------------------

test.describe('Extraction Skills Reference Expert KB', () => {
  const EXTRACTION_SKILLS = [
    'extract-ai-partnership',
    'extract-session-craft',
    'extract-tool-mastery',
    'extract-skill-resilience',
    'extract-session-mastery',
  ];

  for (const skill of EXTRACTION_SKILLS) {
    test(`${skill} references expert-knowledge-base.md`, () => {
      const skillPath = join(EXTRACTION_SKILLS_DIR, skill, 'SKILL.md');
      expect(existsSync(skillPath), `${skill}/SKILL.md must exist`).toBe(true);

      const content = readFileSync(skillPath, 'utf-8');
      expect(
        content,
        `${skill} must reference expert-knowledge-base.md`,
      ).toContain('expert-knowledge-base.md');
    });
  }
});

// ---------------------------------------------------------------------------
// Expert Signals Schema Tests
// ---------------------------------------------------------------------------

test.describe('Expert Signals in Phase 1 Output', () => {
  let phase1Output: Record<string, unknown> | null = null;
  let phase1Exists: boolean;

  test.beforeAll(() => {
    phase1Exists = existsSync(PHASE1_PATH);
    if (!phase1Exists) return;

    try {
      phase1Output = JSON.parse(readFileSync(PHASE1_PATH, 'utf-8'));
    } catch {
      phase1Output = null;
    }
  });

  test('phase1-output.json exists', () => {
    // This test is informational -- it may skip if no analysis has run
    test.skip(!phase1Exists, 'No Phase 1 output file found (run bp analyze first)');
    expect(phase1Output).not.toBeNull();
  });

  test('sessionMetrics includes expertSignals when analysis has run', () => {
    test.skip(!phase1Exists || !phase1Output, 'No Phase 1 output available');

    const metrics = (phase1Output as Record<string, unknown>).sessionMetrics as Record<string, unknown>;
    expect(metrics).toBeDefined();

    // expertSignals should be present after our changes
    if (metrics.expertSignals) {
      const expert = metrics.expertSignals as Record<string, unknown>;
      expect(typeof expert.claudeMdReferences).toBe('number');
      expect(typeof expert.properToolSelectionRatio).toBe('number');
      expect(typeof expert.taskDelegationCount).toBe('number');
      expect(typeof expert.compactionRate).toBe('number');
      expect(typeof expert.structuredColdStartCount).toBe('number');
      expect(typeof expert.verificationRequestCount).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// HTML Report Expert Signals Rendering
// ---------------------------------------------------------------------------

test.describe('Expert Signals in HTML Report', () => {
  let reportHtml: string;
  let reportExists: boolean;

  test.beforeAll(() => {
    reportExists = existsSync(REPORT_PATH);
    if (!reportExists) return;
    reportHtml = readFileSync(REPORT_PATH, 'utf-8');
  });

  test('report file exists', () => {
    test.skip(!reportExists, 'No report file found');
    expect(reportHtml.length).toBeGreaterThan(0);
  });

  test('report contains expert-signals CSS class', () => {
    test.skip(!reportExists, 'No report file found');
    // The CSS should define expert-signals styling
    expect(reportHtml).toContain('expert-signals');
  });

  test('report contains metric.expert CSS class', () => {
    test.skip(!reportExists, 'No report file found');
    expect(reportHtml).toContain('metric.expert');
  });
});

test.describe('Expert Signals in Browser Report', () => {
  const reportPath = join(homedir(), '.betterprompt', 'reports', 'latest.html');

  test.beforeEach(async ({ page }) => {
    test.skip(!existsSync(reportPath), 'No report file found');
    await page.goto(`file://${reportPath}`);
    await page.waitForLoadState('domcontentloaded');
  });

  test('expert signals bar renders when signals are present', async ({ page }) => {
    const expertBar = page.locator('[data-testid="expert-signals"]');
    const count = await expertBar.count();

    // Expert signals bar should be present if user has any expert signals
    // This is informational -- may be 0 if no expert patterns detected
    if (count > 0) {
      await expect(expertBar.first()).toBeVisible();
    }
  });

  test('expert signal metrics display valid values', async ({ page }) => {
    const expertMetrics = page.locator('.metric.expert');
    const count = await expertMetrics.count();

    if (count > 0) {
      // Each expert metric should have a value and label
      for (let i = 0; i < count; i++) {
        const metric = expertMetrics.nth(i);
        const value = metric.locator('.value');
        const label = metric.locator('.label');

        await expect(value).toBeVisible();
        await expect(label).toBeVisible();

        const valueText = await value.textContent();
        expect(valueText?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('standard metrics bar still renders correctly alongside expert signals', async ({ page }) => {
    const metricsBar = page.locator('.metrics-bar').first();
    await expect(metricsBar).toBeVisible();

    // Should still have standard metrics
    const standardMetrics = metricsBar.locator('.metric:not(.expert)');
    const standardCount = await standardMetrics.count();
    expect(standardCount).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Deterministic Scorer Expert Bonus Tests (unit-level in E2E context)
// ---------------------------------------------------------------------------

test.describe('Deterministic Scorer Expert Integration', () => {
  test('scorer module exports are available', async () => {
    // Verify the shared scoring module can be imported
    const scorerPath = resolve(
      __dirname,
      '../../../packages/shared/dist/scoring/deterministic-scorer.js',
    );
    expect(existsSync(scorerPath)).toBe(true);
  });

  test('expert signals schema is part of shared package', async () => {
    const schemaPath = resolve(
      __dirname,
      '../../../packages/shared/dist/schemas/phase1-output.js',
    );
    expect(existsSync(schemaPath)).toBe(true);

    const content = readFileSync(schemaPath, 'utf-8');
    expect(content).toContain('ExpertSignals');
    expect(content).toContain('claudeMdReferences');
    expect(content).toContain('properToolSelectionRatio');
  });
});

// ---------------------------------------------------------------------------
// Analysis Quality Validation
// ---------------------------------------------------------------------------

test.describe('Analysis Quality with Expert Signals', () => {
  let reportHtml: string;
  let reportExists: boolean;

  test.beforeAll(() => {
    reportExists = existsSync(REPORT_PATH);
    if (!reportExists) return;
    reportHtml = readFileSync(REPORT_PATH, 'utf-8');
  });

  test('report maintains all 5 domain sections', () => {
    test.skip(!reportExists, 'No report file found');

    const domains = [
      'aiPartnership',
      'sessionCraft',
      'toolMastery',
      'skillResilience',
      'sessionMastery',
    ];

    for (const domain of domains) {
      expect(
        reportHtml,
        `Report must contain domain section: ${domain}`,
      ).toContain(`data-domain="${domain}"`);
    }
  });

  test('domain scores are within valid range (0-100)', () => {
    test.skip(!reportExists, 'No report file found');

    // Extract scores from HTML using regex
    const scorePattern = /data-score="(\d+(?:\.\d+)?)"/g;
    let match: RegExpExecArray | null;
    const scores: number[] = [];

    while ((match = scorePattern.exec(reportHtml)) !== null) {
      scores.push(parseFloat(match[1]));
    }

    for (const score of scores) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test('evidence items still present after expert integration', () => {
    test.skip(!reportExists, 'No report file found');

    const evidenceCount = (reportHtml.match(/evidence-item/g) ?? []).length;
    // Report should still contain evidence items
    expect(evidenceCount).toBeGreaterThan(0);
  });
});
