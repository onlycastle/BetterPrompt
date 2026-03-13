import { describe, expect, it } from 'vitest';
import {
  ContentGateway,
  TIER_POLICY,
  createContentGateway,
  type PremiumPreview,
} from '../../../src/lib/analyzer/content-gateway.js';
import type { VerboseEvaluation } from '../../../src/lib/models/verbose-evaluation.js';
import type { QuickFixResult } from '../../../src/lib/models/quick-fix-data.js';

describe('ContentGateway', () => {
  const gateway = createContentGateway();

  it('creates a gateway instance', () => {
    expect(gateway).toBeInstanceOf(ContentGateway);
  });

  it('passes verbose evaluations through unchanged for every legacy tier label', () => {
    const evaluation = { personalitySummary: 'Full access report' } as VerboseEvaluation;

    expect(gateway.filter(evaluation, 'free')).toBe(evaluation);
    expect(gateway.filter(evaluation, 'one_time')).toBe(evaluation);
    expect(gateway.filter(evaluation, 'pro')).toBe(evaluation);
    expect(gateway.filter(evaluation, 'enterprise')).toBe(evaluation);
  });

  it('returns an empty premium preview placeholder', () => {
    const preview = gateway.createPremiumPreview({} as VerboseEvaluation);

    expect(preview).toEqual({} satisfies PremiumPreview);
  });

  it('passes quick-fix results through unchanged', () => {
    const result = {
      resultId: 'result-1',
      projectName: 'demo',
      projectPath: '/tmp/demo',
      sessionsAnalyzed: 3,
      analyzedAt: '2026-03-12T00:00:00.000Z',
      overallHealthScore: 82,
      summary: 'Use clearer prompts before retrying.',
      bottlenecks: [],
    } satisfies QuickFixResult;

    expect(gateway.filterQuickFixResult(result, 'free')).toBe(result);
  });
});

describe('TIER_POLICY', () => {
  it('documents full-access OSS mode', () => {
    expect(TIER_POLICY).toEqual({ accessMode: 'full-access' });
  });
});
