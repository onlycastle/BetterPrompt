/**
 * Team Test Helpers
 *
 * Factories and utilities for testing team/enterprise dashboard features.
 */

import { randomUUID } from 'node:crypto';
import { getDatabase, resetDatabaseForTests } from '../../src/lib/local/database';
import {
  createOrganization,
  createTeam,
  addTeamMember,
} from '../../src/lib/local/team-store';
import type { StoredOrganization, StoredTeam, StoredTeamMember } from '../../src/lib/local/team-store';
import type { StoredAnalysisResult } from '../../src/lib/local/analysis-store';
import type { TeamMemberAnalysis, DimensionScores } from '../../src/types/enterprise';
import type { LocalUser } from '../../src/lib/local/auth';

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

/**
 * Insert a user row directly into SQLite.
 * Required because team_members has FK to users.
 */
export function createTestUser(overrides: Partial<{ id: string; email: string; role: string }> = {}): LocalUser {
  const db = getDatabase();
  const now = new Date().toISOString();
  const id = overrides.id ?? randomUUID();
  const email = overrides.email ?? `user-${id.slice(0, 8)}@test.com`;
  const role = overrides.role ?? 'member';

  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, created_at, updated_at)
    VALUES (?, ?, '', ?, ?, ?)
  `).run(id, email, role, now, now);

  return { id, email, role, createdAt: now, organizationId: null };
}

/**
 * Create an organization via the real team-store function.
 */
export function createTestOrganization(
  ownerId: string,
  overrides: Partial<{ name: string; slug: string }> = {},
): StoredOrganization {
  const name = overrides.name ?? `Test Org ${randomUUID().slice(0, 6)}`;
  const slug = overrides.slug ?? `test-org-${randomUUID().slice(0, 6)}`;
  return createOrganization(name, slug, ownerId);
}

/**
 * Convenience: create a team and add members to it.
 */
export function createTestTeamWithMembers(
  orgId: string,
  memberUserIds: string[],
  overrides: Partial<{ name: string; description: string }> = {},
): { team: StoredTeam; members: StoredTeamMember[] } {
  const team = createTeam(orgId, overrides.name ?? 'Test Team', overrides.description);
  const members = memberUserIds.map((userId) =>
    addTeamMember(team.id, userId, orgId, 'member'),
  );
  return { team, members };
}

/**
 * Close the database singleton so each test file starts fresh.
 */
export { resetDatabaseForTests as cleanupTestDatabase };

// ---------------------------------------------------------------------------
// Mock data factories (no DB needed)
// ---------------------------------------------------------------------------

const DEFAULT_DIMENSIONS: DimensionScores = {
  aiCollaboration: 72,
  contextEngineering: 68,
  burnoutRisk: 25,
  aiControl: 70,
  skillResilience: 65,
};

/**
 * Create a TeamMemberAnalysis with sensible defaults.
 * Used for aggregation tests.
 */
export function createMockTeamMemberAnalysis(
  overrides: Partial<TeamMemberAnalysis> = {},
): TeamMemberAnalysis {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    name: overrides.name ?? `user-${id.slice(0, 6)}`,
    email: `user-${id.slice(0, 6)}@test.com`,
    role: 'member',
    department: 'Engineering',
    primaryType: 'architect',
    controlLevel: 'navigator',
    overallScore: 70,
    dimensions: { ...DEFAULT_DIMENSIONS },
    history: [
      { date: '2026-03-22T00:00:00Z', overallScore: 70, dimensions: { ...DEFAULT_DIMENSIONS } },
    ],
    tokenUsage: {
      totalSessions: 5,
      totalMessages: 40,
      avgContextFillPercent: 0,
      maxContextFillPercent: 0,
      contextFillExceeded90Count: 0,
      weeklyTokenTrend: [{ weekStart: '2026-03-17', totalTokens: 20000, sessions: 5 }],
    },
    antiPatterns: [],
    projects: [{ projectName: 'test-project', sessionCount: 3, lastActiveDate: '2026-03-22', summaryLines: ['Worked on tests'] }],
    strengthSummaries: [],
    growth: {
      currentScore: 70,
      previousWeekScore: 68,
      previousMonthScore: 65,
      weekOverWeekDelta: 2,
      monthOverMonthDelta: 5,
      trend: 'improving',
    },
    growthAreas: [],
    kpt: { keep: [], problem: [], tryNext: [] },
    lastAnalyzedAt: '2026-03-22T00:00:00Z',
    analysisCount: 1,
    ...overrides,
  };
}

/**
 * Create a StoredAnalysisResult with workerInsights populated.
 * Used for evaluation-to-team tests.
 */
export function createMockStoredAnalysisResult(
  overrides: Partial<StoredAnalysisResult> & { claimedAt?: string } = {},
): StoredAnalysisResult {
  const now = overrides.claimedAt ?? new Date().toISOString();
  return {
    resultId: randomUUID(),
    userId: 'test-user',
    evaluation: {
      sessionId: 'test-session',
      analyzedAt: now,
      sessionsAnalyzed: 1,
      primaryType: 'architect',
      controlLevel: 'navigator',
      distribution: { architect: 40, analyst: 25, conductor: 15, speedrunner: 10, trendsetter: 10 },
      personalitySummary: 'A strategic architect.',
      promptPatterns: [],
      workerInsights: {
        thinkingQuality: {
          strengths: [{ title: 'Strategic Planning', description: 'Plans well.', evidence: ['evidence-1'] }],
          growthAreas: [{ title: 'Tool Exploration', description: 'Could use more tools.', evidence: ['evidence-2'], recommendation: 'Try Task tool.' }],
          domainScore: 75,
        },
        communicationPatterns: {
          strengths: [{ title: 'Clear Requests', description: 'Communicates clearly.', evidence: ['evidence-3'] }],
          growthAreas: [{ title: 'Context Provision', description: 'Could provide more context.', evidence: ['evidence-4'], recommendation: 'Add file references.' }],
          domainScore: 70,
        },
        learningBehavior: {
          strengths: [{ title: 'Quick Learner', description: 'Learns fast.', evidence: ['evidence-5'] }],
          growthAreas: [],
          domainScore: 65,
        },
        contextEfficiency: {
          strengths: [{ title: 'Efficient Context', description: 'Manages context well.', evidence: ['evidence-6'] }],
          growthAreas: [],
          domainScore: 72,
        },
        sessionOutcome: {
          strengths: [{ title: 'Good Outcomes', description: 'Achieves goals.', evidence: ['evidence-7'] }],
          growthAreas: [],
          domainScore: 80,
        },
      },
      pipelineTokenUsage: {
        stages: [],
        totals: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
      },
      ...overrides.evaluation,
    },
    phase1Output: null,
    canonicalRun: null,
    activitySessions: overrides.activitySessions ?? [
      {
        sessionId: 'session-1',
        projectName: 'test-project',
        startTime: now,
        durationMinutes: 15,
        messageCount: 10,
        summary: 'Worked on feature X.',
      },
    ],
    createdAt: now,
    claimedAt: now,
    updatedAt: now,
    viewCount: 0,
    shareCount: 0,
    ...overrides,
  };
}
