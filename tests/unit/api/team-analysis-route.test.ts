/**
 * Tests for GET /api/teams/[teamId]/analysis
 *
 * Verifies that the endpoint:
 * 1. Produces patterns from aggregateGrowthAreasPEA()
 * 2. Wires LLM recommendations when ANTHROPIC_API_KEY is set
 * 3. Falls back to deterministic when API key absent
 * 4. Co-locates patterns + recommendations in TeamAnalysisOutput
 * 5. Enforces auth and org-ownership
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — installed before dynamic imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/local/auth', () => ({
  getCurrentUserFromRequest: vi.fn(),
  findUserById: vi.fn(),
}));

vi.mock('@/lib/local/team-store', () => ({
  getTeam: vi.fn(),
  getUserOrganization: vi.fn(),
  listMembersForTeam: vi.fn(),
}));

vi.mock('@/lib/local/analysis-store', () => ({
  listAnalysesForUser: vi.fn(),
}));

vi.mock('@/lib/local/evaluation-to-team', () => ({
  mapUserToTeamMember: vi.fn(),
}));

vi.mock('@/lib/enterprise/aggregation', () => ({
  aggregateGrowthAreasPEA: vi.fn(),
  generateTeamActionItems: vi.fn(),
}));

vi.mock('@/lib/enterprise/team-recommendations-prompt', () => ({
  generateLLMTeamRecommendations: vi.fn(),
  generateLLMTeamPatternAnalysis: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Dynamic imports after mocks
// ---------------------------------------------------------------------------

import { getCurrentUserFromRequest, findUserById } from '@/lib/local/auth';
import * as teamStore from '@/lib/local/team-store';
import { listAnalysesForUser } from '@/lib/local/analysis-store';
import { mapUserToTeamMember } from '@/lib/local/evaluation-to-team';
import { aggregateGrowthAreasPEA, generateTeamActionItems } from '@/lib/enterprise/aggregation';
import { generateLLMTeamRecommendations, generateLLMTeamPatternAnalysis } from '@/lib/enterprise/team-recommendations-prompt';

let analysisGet: typeof import('../../../app/api/teams/[teamId]/analysis/route').GET;

beforeAll(async () => {
  const route = await import('../../../app/api/teams/[teamId]/analysis/route');
  analysisGet = route.GET;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-1',
  email: 'admin@test.com',
  role: 'admin',
  createdAt: '2026-01-01',
  organizationId: 'org-1',
};

const mockOrg = {
  id: 'org-1',
  name: 'Test Org',
  slug: 'test-org',
  ownerId: 'user-1',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const mockTeam = {
  id: 'team-1',
  organizationId: 'org-1',
  name: 'Engineering',
  description: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  memberCount: 2,
};

const mockStoredMember = {
  id: 'member-1',
  userId: 'user-2',
  teamId: 'team-1',
  organizationId: 'org-1',
  role: 'member',
  invitedBy: null,
  joinedAt: '2026-01-01',
  email: 'dev@test.com',
};

const mockLocalUser = {
  id: 'user-2',
  email: 'dev@test.com',
  role: 'member',
  createdAt: '2026-01-01',
  organizationId: 'org-1',
};

const mockTeamMemberAnalysis = {
  id: 'user-2',
  name: 'dev',
  email: 'dev@test.com',
  role: 'member',
  department: 'Engineering',
  primaryType: 'analyst' as const,
  controlLevel: 'navigator' as const,
  overallScore: 72,
  dimensions: { aiCollaboration: 72, contextEngineering: 68, burnoutRisk: 25, aiControl: 70, skillResilience: 65 },
  history: [],
  tokenUsage: { totalSessions: 3, totalMessages: 20, avgContextFillPercent: 0, maxContextFillPercent: 0, contextFillExceeded90Count: 0, weeklyTokenTrend: [] },
  antiPatterns: [],
  projects: [],
  strengthSummaries: [],
  growth: { currentScore: 72, previousWeekScore: 70, previousMonthScore: 65, weekOverWeekDelta: 2, monthOverMonthDelta: 7, trend: 'improving' as const },
  growthAreas: [
    {
      title: 'Late Error Handling',
      domain: 'thinkingQuality',
      severity: 'high' as const,
      recommendation: 'Add error handling earlier.',
      categoryTags: ['error-handling', 'typescript'],
    },
  ],
  kpt: { keep: [], problem: [], tryNext: [] },
  lastAnalyzedAt: '2026-03-22T00:00:00Z',
  analysisCount: 3,
};

const mockPEAPatterns = [
  {
    title: 'Late Error Handling',
    domain: 'thinkingQuality',
    domainLabel: 'Thinking Quality',
    memberCount: 2,
    totalDevs: 2,
    affectedMembers: ['dev', 'alice'],
    predominantSeverity: 'high' as const,
    sampleRecommendation: 'Add error handling earlier.',
    categoryTags: ['error-handling', 'typescript'],
    teamRecommendation: 'Schedule error handling workshop.',
    memberSeverities: [{ memberName: 'dev', severity: 'high' as const }],
  },
];

const mockDeterministicItems = [
  {
    priority: 1,
    urgency: 'this-sprint' as const,
    action: 'Schedule a weekly code review workshop.',
    rationale: '2 of 2 developers (100%) exhibit "Late Error Handling" — high severity.',
    pattern: 'Late Error Handling',
    domain: 'thinkingQuality',
    domainLabel: 'Thinking Quality',
    affectedMembers: ['dev', 'alice'],
    severity: 'high' as const,
  },
];

const mockLLMItems = [
  {
    priority: 1,
    urgency: 'this-sprint' as const,
    action: 'Run a 90-minute TypeScript error boundary workshop for the team.',
    rationale: '2 of 2 developers (100%) exhibit "Late Error Handling" — high severity in thinkingQuality.',
    pattern: 'Late Error Handling',
    domain: 'thinkingQuality',
    domainLabel: 'Thinking Quality',
    affectedMembers: ['dev', 'alice'],
    severity: 'high' as const,
  },
];

// Mock result for generateLLMTeamPatternAnalysis (combined tags + recommendations)
const mockLLMPatternAnalysis = {
  patternCategoryTags: {
    'Late Error Handling': ['backend-error-resilience', 'typescript-error-patterns', 'missing-validation'],
  },
  recommendations: mockLLMItems,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(teamId: string) {
  return new NextRequest(`http://localhost/api/teams/${teamId}/analysis`);
}

function makeParams(teamId: string) {
  return { params: Promise.resolve({ teamId }) };
}

function setupValidAuth() {
  vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
  vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
  vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
  vi.mocked(teamStore.listMembersForTeam).mockReturnValue([mockStoredMember] as never);
  vi.mocked(findUserById).mockReturnValue(mockLocalUser as never);
  vi.mocked(listAnalysesForUser).mockReturnValue([] as never);
  vi.mocked(mapUserToTeamMember).mockReturnValue(mockTeamMemberAnalysis as never);
  vi.mocked(aggregateGrowthAreasPEA).mockReturnValue(mockPEAPatterns as never);
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no API key (deterministic path)
  delete process.env.ANTHROPIC_API_KEY;
});

// ===========================================================================
// Authorization tests
// ===========================================================================

describe('GET /api/teams/[teamId]/analysis — authorization', () => {
  it('returns 404 when team not found', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getTeam).mockReturnValue(null as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('not_found');
  });

  it('returns 404 when user has no organization', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(null as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('not_found');
  });

  it('returns 403 when team belongs to a different org', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getTeam).mockReturnValue({ ...mockTeam, organizationId: 'org-other' } as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('forbidden');
  });
});

// ===========================================================================
// Pipeline wiring — deterministic path (no ANTHROPIC_API_KEY)
// ===========================================================================

describe('GET /api/teams/[teamId]/analysis — deterministic recommendation path', () => {
  it('returns TeamAnalysisOutput with patterns and recommendations co-located', async () => {
    setupValidAuth();
    vi.mocked(generateTeamActionItems).mockReturnValue(mockDeterministicItems as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(200);

    // Patterns and recommendations must be present in the same response
    expect(body.patterns).toBeDefined();
    expect(body.recommendations).toBeDefined();
    expect(Array.isArray(body.patterns)).toBe(true);
    expect(Array.isArray(body.recommendations)).toBe(true);
  });

  it('sets recommendationSource to "deterministic" when no API key', async () => {
    setupValidAuth();
    vi.mocked(generateTeamActionItems).mockReturnValue(mockDeterministicItems as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    expect(body.recommendationSource).toBe('deterministic');
  });

  it('calls generateTeamActionItems (not LLM) when no API key', async () => {
    setupValidAuth();
    vi.mocked(generateTeamActionItems).mockReturnValue(mockDeterministicItems as never);

    await analysisGet(makeRequest('team-1'), makeParams('team-1'));

    expect(generateTeamActionItems).toHaveBeenCalledWith(mockPEAPatterns, 1);
    expect(generateLLMTeamRecommendations).not.toHaveBeenCalled();
  });

  it('calls aggregateGrowthAreasPEA with the properly transformed members', async () => {
    setupValidAuth();
    vi.mocked(generateTeamActionItems).mockReturnValue([] as never);

    await analysisGet(makeRequest('team-1'), makeParams('team-1'));

    // aggregateGrowthAreasPEA must receive TeamMemberAnalysis[], not StoredTeamMember[]
    expect(aggregateGrowthAreasPEA).toHaveBeenCalledWith([mockTeamMemberAnalysis]);
  });

  it('includes teamId, teamName, generatedAt, and totalMembers in output', async () => {
    setupValidAuth();
    vi.mocked(generateTeamActionItems).mockReturnValue(mockDeterministicItems as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    expect(body.teamId).toBe('team-1');
    expect(body.teamName).toBe('Engineering');
    expect(body.totalMembers).toBe(1);
    expect(typeof body.generatedAt).toBe('string');
    // generatedAt should be a valid ISO timestamp
    expect(() => new Date(body.generatedAt)).not.toThrow();
  });

  it('returns empty patterns and empty recommendations for a team with no members', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    vi.mocked(teamStore.listMembersForTeam).mockReturnValue([] as never);
    vi.mocked(aggregateGrowthAreasPEA).mockReturnValue([] as never);
    vi.mocked(generateTeamActionItems).mockReturnValue([] as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.patterns).toEqual([]);
    expect(body.recommendations).toEqual([]);
    expect(body.totalMembers).toBe(0);
  });

  it('skips members whose user record is not found', async () => {
    vi.mocked(getCurrentUserFromRequest).mockReturnValue(mockUser as never);
    vi.mocked(teamStore.getUserOrganization).mockReturnValue(mockOrg as never);
    vi.mocked(teamStore.getTeam).mockReturnValue(mockTeam as never);
    // Two membership records, but findUserById returns null for both
    vi.mocked(teamStore.listMembersForTeam).mockReturnValue([mockStoredMember, { ...mockStoredMember, userId: 'user-ghost' }] as never);
    vi.mocked(findUserById).mockReturnValue(null as never);
    vi.mocked(aggregateGrowthAreasPEA).mockReturnValue([] as never);
    vi.mocked(generateTeamActionItems).mockReturnValue([] as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    // No members were successfully mapped — aggregation receives []
    expect(res.status).toBe(200);
    expect(aggregateGrowthAreasPEA).toHaveBeenCalledWith([]);
    expect(body.totalMembers).toBe(0);
  });
});

// ===========================================================================
// Pipeline wiring — LLM path (ANTHROPIC_API_KEY present)
// ===========================================================================

describe('GET /api/teams/[teamId]/analysis — LLM recommendation path', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
  });

  it('sets recommendationSource to "llm" when API key is configured', async () => {
    setupValidAuth();
    vi.mocked(generateLLMTeamPatternAnalysis).mockResolvedValue(mockLLMPatternAnalysis as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    expect(body.recommendationSource).toBe('llm');
  });

  it('calls generateLLMTeamPatternAnalysis with patterns and member count', async () => {
    setupValidAuth();
    vi.mocked(generateLLMTeamPatternAnalysis).mockResolvedValue(mockLLMPatternAnalysis as never);

    await analysisGet(makeRequest('team-1'), makeParams('team-1'));

    expect(generateLLMTeamPatternAnalysis).toHaveBeenCalledWith(mockPEAPatterns, 1);
    expect(generateTeamActionItems).not.toHaveBeenCalled();
    expect(generateLLMTeamRecommendations).not.toHaveBeenCalled();
  });

  it('returns LLM-generated recommendations in the output', async () => {
    setupValidAuth();
    vi.mocked(generateLLMTeamPatternAnalysis).mockResolvedValue(mockLLMPatternAnalysis as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    expect(body.recommendations).toHaveLength(1);
    expect(body.recommendations[0].action).toBe(
      'Run a 90-minute TypeScript error boundary workshop for the team.',
    );
  });

  it('applies LLM-generated team-level category tags to pattern output', async () => {
    setupValidAuth();
    vi.mocked(generateLLMTeamPatternAnalysis).mockResolvedValue(mockLLMPatternAnalysis as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    // The pattern's categoryTags should be replaced with the LLM-generated team tags
    const lateErrorPattern = body.patterns.find(
      (p: { title: string }) => p.title === 'Late Error Handling',
    );
    expect(lateErrorPattern).toBeDefined();
    expect(lateErrorPattern.categoryTags).toContain('backend-error-resilience');
    expect(lateErrorPattern.categoryTags).toContain('typescript-error-patterns');
  });

  it('falls back to aggregated tags for patterns not in LLM output', async () => {
    setupValidAuth();
    // LLM returns empty patternCategoryTags
    vi.mocked(generateLLMTeamPatternAnalysis).mockResolvedValue({
      patternCategoryTags: {},
      recommendations: mockLLMItems,
    } as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    // Pattern should retain its original aggregated tags
    const lateErrorPattern = body.patterns.find(
      (p: { title: string }) => p.title === 'Late Error Handling',
    );
    expect(lateErrorPattern).toBeDefined();
    // Falls back to the aggregated individual tags
    expect(Array.isArray(lateErrorPattern.categoryTags)).toBe(true);
  });

  it('propagates LLM errors (No Fallback Policy)', async () => {
    setupValidAuth();
    vi.mocked(generateLLMTeamPatternAnalysis).mockRejectedValue(
      new Error('Anthropic API timeout'),
    );

    // The route should NOT silently fall back — it must propagate the error
    await expect(
      analysisGet(makeRequest('team-1'), makeParams('team-1')),
    ).rejects.toThrow('Anthropic API timeout');
  });

  it('uses deterministic path when patterns list is empty (no patterns to send to LLM)', async () => {
    setupValidAuth();
    // Override: aggregation returns no patterns
    vi.mocked(aggregateGrowthAreasPEA).mockReturnValue([] as never);
    vi.mocked(generateTeamActionItems).mockReturnValue([] as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    // API key is set but patterns is empty → deterministic (no LLM call needed)
    expect(generateLLMTeamPatternAnalysis).not.toHaveBeenCalled();
    expect(generateLLMTeamRecommendations).not.toHaveBeenCalled();
    expect(body.recommendationSource).toBe('deterministic');
    expect(body.recommendations).toEqual([]);
  });
});

// ===========================================================================
// TeamAnalysisOutput schema validation
// ===========================================================================

describe('TeamAnalysisOutput schema', () => {
  it('patterns and recommendations are always co-located — never recommendations without patterns', async () => {
    setupValidAuth();
    vi.mocked(generateTeamActionItems).mockReturnValue(mockDeterministicItems as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    // Both must always be present (even when empty)
    expect('patterns' in body).toBe(true);
    expect('recommendations' in body).toBe(true);
    expect('recommendationSource' in body).toBe(true);
    expect('generatedAt' in body).toBe(true);
    expect('totalMembers' in body).toBe(true);
  });

  it('recommendations reference pattern titles from the same response', async () => {
    setupValidAuth();
    vi.mocked(generateTeamActionItems).mockReturnValue(mockDeterministicItems as never);

    const res = await analysisGet(makeRequest('team-1'), makeParams('team-1'));
    const body = await res.json();

    if (body.recommendations.length > 0 && body.patterns.length > 0) {
      const patternTitles = new Set(body.patterns.map((p: { title: string }) => p.title));
      for (const rec of body.recommendations) {
        // Each recommendation must reference an existing pattern
        expect(patternTitles.has(rec.pattern)).toBe(true);
      }
    }
  });
});
