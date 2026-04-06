/**
 * Low-Confidence Flagging Tests (AC 6)
 *
 * Validates the complete low-confidence pipeline:
 * 1. getLowConfidenceDetail() — structured reason generation
 * 2. shouldFlagLowConfidence() — boolean convenience wrapper
 * 3. aggregateGrowthAreas() — hasLowConfidenceContributors propagation
 *
 * AC 6: Growth areas with insufficient evidence are flagged as
 * low-confidence emerging pattern needing more sessions to confirm.
 *
 * @module tests/unit/low-confidence-flagging
 */

import { describe, expect, it } from 'vitest';
import {
  getLowConfidenceDetail,
  shouldFlagLowConfidence,
  type LowConfidenceDetail,
} from '../../packages/shared/src/schemas/growth-area-pea.js';
import { aggregateGrowthAreas } from '../../src/lib/enterprise/aggregation';
import type { TeamMemberAnalysis, MemberGrowthArea } from '../../src/types/enterprise';

// ============================================================================
// Test Helpers
// ============================================================================

function makeMoments(
  config: Array<{ sessionId: string; utteranceId: string }>,
): Array<{ utteranceId: string; sessionId: string }> {
  return config;
}

function makeTeamMember(
  name: string,
  growthAreas: MemberGrowthArea[],
): TeamMemberAnalysis {
  return {
    id: `member-${name}`,
    name,
    email: `${name}@test.com`,
    teamId: 'team-1',
    teamName: 'Test Team',
    primaryType: 'architect',
    controlLevel: 'collaborator',
    overallScore: 75,
    dimensions: {
      thinkingQuality: 70,
      communicationPatterns: 75,
      learningBehavior: 80,
      contextEfficiency: 65,
      sessionOutcome: 72,
    },
    history: [],
    tokenUsage: { dates: [], inputTokens: [], outputTokens: [] },
    antiPatterns: [],
    projects: [],
    strengthSummaries: [],
    growth: { currentScore: 75, previousScore: 70, trend: 'improving' },
    growthAreas,
    kpt: { keep: [], problem: [], tryNext: [] },
    lastAnalyzedAt: new Date().toISOString(),
    analysisCount: 3,
  };
}

// ============================================================================
// getLowConfidenceDetail() — structured reason generation
// ============================================================================

describe('getLowConfidenceDetail', () => {
  describe('returns null for sufficient evidence', () => {
    it('returns null when 3+ moments from 2+ sessions', () => {
      const moments = makeMoments([
        { sessionId: 'sess_a', utteranceId: 'sess_a_1' },
        { sessionId: 'sess_b', utteranceId: 'sess_b_2' },
        { sessionId: 'sess_c', utteranceId: 'sess_c_3' },
      ]);
      const result = getLowConfidenceDetail(moments);
      expect(result).toBeNull();
    });

    it('returns null when 4 moments from 3 sessions', () => {
      const moments = makeMoments([
        { sessionId: 'sess_a', utteranceId: 'sess_a_1' },
        { sessionId: 'sess_a', utteranceId: 'sess_a_5' },
        { sessionId: 'sess_b', utteranceId: 'sess_b_2' },
        { sessionId: 'sess_c', utteranceId: 'sess_c_3' },
      ]);
      const result = getLowConfidenceDetail(moments);
      expect(result).toBeNull();
    });
  });

  describe('flags single-session minimal evidence', () => {
    it('returns single_session_minimal for 2 moments from 1 session', () => {
      const moments = makeMoments([
        { sessionId: 'sess_a', utteranceId: 'sess_a_1' },
        { sessionId: 'sess_a', utteranceId: 'sess_a_5' },
      ]);
      const result = getLowConfidenceDetail(moments);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('single_session_minimal');
      expect(result!.label).toBe('Emerging Pattern');
      expect(result!.message).toContain('1 session');
      expect(result!.message).toContain('more sessions needed');
      expect(result!.distinctSessions).toBe(1);
      expect(result!.distinctMoments).toBe(2);
    });
  });

  describe('flags single-session evidence (3+ moments)', () => {
    it('returns single_session for 3 moments from 1 session', () => {
      const moments = makeMoments([
        { sessionId: 'sess_a', utteranceId: 'sess_a_1' },
        { sessionId: 'sess_a', utteranceId: 'sess_a_5' },
        { sessionId: 'sess_a', utteranceId: 'sess_a_10' },
      ]);
      const result = getLowConfidenceDetail(moments);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('single_session');
      expect(result!.label).toBe('Emerging Pattern');
      expect(result!.message).toContain('same session');
      expect(result!.distinctSessions).toBe(1);
    });
  });

  describe('flags minimal evidence (2 moments from 2 sessions)', () => {
    it('returns minimal_evidence for exactly 2 moments from different sessions', () => {
      const moments = makeMoments([
        { sessionId: 'sess_a', utteranceId: 'sess_a_1' },
        { sessionId: 'sess_b', utteranceId: 'sess_b_2' },
      ]);
      const result = getLowConfidenceDetail(moments);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('minimal_evidence');
      expect(result!.label).toBe('Emerging Pattern');
      expect(result!.message).toContain('only 2 moments');
      expect(result!.distinctSessions).toBe(2);
      expect(result!.distinctMoments).toBe(2);
    });
  });

  describe('respects LLM-flagged low confidence', () => {
    it('returns llm_flagged when LLM flags but evidence looks adequate', () => {
      const moments = makeMoments([
        { sessionId: 'sess_a', utteranceId: 'sess_a_1' },
        { sessionId: 'sess_b', utteranceId: 'sess_b_2' },
        { sessionId: 'sess_c', utteranceId: 'sess_c_3' },
      ]);
      // LLM flagged but evidence has 3+ moments from 3 sessions
      const result = getLowConfidenceDetail(moments, true);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('llm_flagged');
      expect(result!.label).toBe('Emerging Pattern');
    });

    it('does not override null when LLM does not flag', () => {
      const moments = makeMoments([
        { sessionId: 'sess_a', utteranceId: 'sess_a_1' },
        { sessionId: 'sess_b', utteranceId: 'sess_b_2' },
        { sessionId: 'sess_c', utteranceId: 'sess_c_3' },
      ]);
      const result = getLowConfidenceDetail(moments, false);
      expect(result).toBeNull();
    });
  });

  describe('all detail objects have consistent structure', () => {
    it('every non-null result has label "Emerging Pattern"', () => {
      const testCases: Array<{ moments: Array<{ utteranceId: string; sessionId: string }>; llmFlag?: boolean }> = [
        { moments: makeMoments([{ sessionId: 'a', utteranceId: 'a_1' }, { sessionId: 'a', utteranceId: 'a_2' }]) },
        { moments: makeMoments([{ sessionId: 'a', utteranceId: 'a_1' }, { sessionId: 'a', utteranceId: 'a_2' }, { sessionId: 'a', utteranceId: 'a_3' }]) },
        { moments: makeMoments([{ sessionId: 'a', utteranceId: 'a_1' }, { sessionId: 'b', utteranceId: 'b_1' }]) },
        { moments: makeMoments([{ sessionId: 'a', utteranceId: 'a_1' }, { sessionId: 'b', utteranceId: 'b_1' }, { sessionId: 'c', utteranceId: 'c_1' }]), llmFlag: true },
      ];

      for (const { moments, llmFlag } of testCases) {
        const result = getLowConfidenceDetail(moments, llmFlag);
        expect(result).not.toBeNull();
        expect(result!.label).toBe('Emerging Pattern');
        expect(result!.message.length).toBeGreaterThan(0);
        expect(result!.distinctSessions).toBeGreaterThanOrEqual(1);
        expect(result!.distinctMoments).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

// ============================================================================
// shouldFlagLowConfidence() — boolean convenience wrapper
// ============================================================================

describe('shouldFlagLowConfidence', () => {
  it('returns true for single-session evidence', () => {
    const moments = makeMoments([
      { sessionId: 'sess_a', utteranceId: 'sess_a_1' },
      { sessionId: 'sess_a', utteranceId: 'sess_a_5' },
    ]);
    expect(shouldFlagLowConfidence(moments)).toBe(true);
  });

  it('returns true for minimal evidence (exactly 2 moments)', () => {
    const moments = makeMoments([
      { sessionId: 'sess_a', utteranceId: 'sess_a_1' },
      { sessionId: 'sess_b', utteranceId: 'sess_b_2' },
    ]);
    expect(shouldFlagLowConfidence(moments)).toBe(true);
  });

  it('returns false for sufficient evidence (3+ moments, 2+ sessions)', () => {
    const moments = makeMoments([
      { sessionId: 'sess_a', utteranceId: 'sess_a_1' },
      { sessionId: 'sess_b', utteranceId: 'sess_b_2' },
      { sessionId: 'sess_c', utteranceId: 'sess_c_3' },
    ]);
    expect(shouldFlagLowConfidence(moments)).toBe(false);
  });

  it('returns true when LLM flags even with sufficient evidence', () => {
    const moments = makeMoments([
      { sessionId: 'sess_a', utteranceId: 'sess_a_1' },
      { sessionId: 'sess_b', utteranceId: 'sess_b_2' },
      { sessionId: 'sess_c', utteranceId: 'sess_c_3' },
    ]);
    expect(shouldFlagLowConfidence(moments, true)).toBe(true);
  });
});

// ============================================================================
// aggregateGrowthAreas() — hasLowConfidenceContributors propagation
// ============================================================================

describe('aggregateGrowthAreas — lowConfidence propagation', () => {
  const sharedGrowthArea: MemberGrowthArea = {
    title: 'Skipping vitest After Prisma Schema Changes',
    domain: 'thinkingQuality',
    severity: 'high',
    recommendation: 'Run vitest after every Prisma schema change to catch migration issues early',
  };

  it('does not set hasLowConfidenceContributors when no members have lowConfidence', () => {
    const members = [
      makeTeamMember('Alice', [{ ...sharedGrowthArea }]),
      makeTeamMember('Bob', [{ ...sharedGrowthArea }]),
    ];
    const result = aggregateGrowthAreas(members);
    expect(result.length).toBe(1);
    expect(result[0].hasLowConfidenceContributors).toBeUndefined();
  });

  it('sets hasLowConfidenceContributors when one member has lowConfidence', () => {
    const members = [
      makeTeamMember('Alice', [{ ...sharedGrowthArea, lowConfidence: true }]),
      makeTeamMember('Bob', [{ ...sharedGrowthArea }]),
    ];
    const result = aggregateGrowthAreas(members);
    expect(result.length).toBe(1);
    expect(result[0].hasLowConfidenceContributors).toBe(true);
  });

  it('sets hasLowConfidenceContributors when all members have lowConfidence', () => {
    const members = [
      makeTeamMember('Alice', [{ ...sharedGrowthArea, lowConfidence: true }]),
      makeTeamMember('Bob', [{ ...sharedGrowthArea, lowConfidence: true }]),
    ];
    const result = aggregateGrowthAreas(members);
    expect(result.length).toBe(1);
    expect(result[0].hasLowConfidenceContributors).toBe(true);
  });

  it('does not set hasLowConfidenceContributors when lowConfidence is explicitly false', () => {
    const members = [
      makeTeamMember('Alice', [{ ...sharedGrowthArea, lowConfidence: false }]),
      makeTeamMember('Bob', [{ ...sharedGrowthArea, lowConfidence: false }]),
    ];
    const result = aggregateGrowthAreas(members);
    expect(result.length).toBe(1);
    expect(result[0].hasLowConfidenceContributors).toBeUndefined();
  });

  it('collects representative evidence moments from members', () => {
    const members = [
      makeTeamMember('Alice', [{
        ...sharedGrowthArea,
        evidenceMoments: [
          { sessionId: 'sess_alice_1', quote: 'Let me skip the tests for now', behaviorDescription: 'Skipped vitest after schema change' },
        ],
      }]),
      makeTeamMember('Bob', [{
        ...sharedGrowthArea,
        evidenceMoments: [
          { sessionId: 'sess_bob_1', quote: 'Tests can wait until the feature is done', behaviorDescription: 'Deferred testing after Prisma migration' },
        ],
      }]),
    ];
    const result = aggregateGrowthAreas(members);
    expect(result.length).toBe(1);
    expect(result[0].representativeEvidence).toBeDefined();
    expect(result[0].representativeEvidence!.length).toBe(2);
    expect(result[0].representativeEvidence![0].memberName).toBe('Alice');
    expect(result[0].representativeEvidence![1].memberName).toBe('Bob');
  });

  it('limits representative evidence to 3 moments max', () => {
    const members = [
      makeTeamMember('Alice', [{ ...sharedGrowthArea, evidenceMoments: [{ sessionId: 's1', quote: 'q1', behaviorDescription: 'b1' }] }]),
      makeTeamMember('Bob', [{ ...sharedGrowthArea, evidenceMoments: [{ sessionId: 's2', quote: 'q2', behaviorDescription: 'b2' }] }]),
      makeTeamMember('Carol', [{ ...sharedGrowthArea, evidenceMoments: [{ sessionId: 's3', quote: 'q3', behaviorDescription: 'b3' }] }]),
      makeTeamMember('Dave', [{ ...sharedGrowthArea, evidenceMoments: [{ sessionId: 's4', quote: 'q4', behaviorDescription: 'b4' }] }]),
    ];
    const result = aggregateGrowthAreas(members);
    expect(result.length).toBe(1);
    expect(result[0].representativeEvidence!.length).toBe(3);
  });

  it('handles areas without evidence moments gracefully', () => {
    const members = [
      makeTeamMember('Alice', [{ ...sharedGrowthArea }]),
      makeTeamMember('Bob', [{ ...sharedGrowthArea }]),
    ];
    const result = aggregateGrowthAreas(members);
    expect(result.length).toBe(1);
    expect(result[0].representativeEvidence).toBeUndefined();
  });
});
