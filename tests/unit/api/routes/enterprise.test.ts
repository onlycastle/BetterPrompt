import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ok, err } from '../../../../src/lib/result.js';
import { StorageError } from '../../../../src/domain/errors/index.js';

// Create mock repositories using vi.hoisted() to ensure proper hoisting
const { mockTeamRepoInstance, mockTrackingRepoInstance } = vi.hoisted(() => {
  const mockTeamRepoInstance = {
    createTeam: vi.fn(),
    findTeamById: vi.fn(),
    findTeamsByOrg: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    getMembers: vi.fn(),
    getUserTeams: vi.fn(),
    deleteTeam: vi.fn(),
    createOrganization: vi.fn(),
    findOrganizationById: vi.fn(),
    findOrganizationBySlug: vi.fn(),
    updateOrganization: vi.fn(),
  };

  const mockTrackingRepoInstance = {
    saveDailyMetrics: vi.fn(),
    getMetrics: vi.fn(),
    getLatest: vi.fn(),
    getSummary: vi.fn(),
    updateToday: vi.fn(),
  };

  return { mockTeamRepoInstance, mockTrackingRepoInstance };
});

// Mock the Supabase repositories before importing routes
vi.mock('../../../../src/infrastructure/storage/supabase/index.js', () => ({
  createSupabaseTeamRepository: () => mockTeamRepoInstance,
  createSupabaseTrackingRepository: () => mockTrackingRepoInstance,
}));

// Mock the enterprise data
vi.mock('../../../../src/api/data/mockEnterprise.js', () => ({
  MOCK_TEAM_ANALYTICS: {
    teamId: 'team-demo',
    teamName: 'Engineering Team',
    memberCount: 8,
    averageOverallScore: 74,
    averageDimensions: {
      aiCollaboration: 79,
      contextEngineering: 73,
      burnoutRisk: 34,
      toolMastery: 74,
      aiControl: 71,
      skillResilience: 68,
    },
    typeDistribution: {
      architect: 2,
      scientist: 2,
      collaborator: 2,
      speedrunner: 1,
      craftsman: 1,
    },
    controlLevelDistribution: {
      'vibe-coder': 1,
      developing: 3,
      'ai-master': 4,
    },
    skillGaps: [
      {
        dimension: 'skillResilience',
        label: 'Skill Resilience',
        avgScore: 68,
        membersBelowThreshold: 3,
        threshold: 65,
      },
    ],
    weeklyTrend: [
      { date: '2025-12-16', overallScore: 70 },
      { date: '2025-12-23', overallScore: 72 },
      { date: '2025-12-30', overallScore: 73 },
      { date: '2026-01-06', overallScore: 74 },
    ],
    weekOverWeekChange: 1.4,
    monthOverMonthChange: 5.2,
  },
  MOCK_TEAM_MEMBERS: [
    {
      id: 'member-1',
      name: 'Alex Chen',
      email: 'alex.chen@company.com',
      role: 'Senior Engineer',
      department: 'Platform',
      primaryType: 'architect',
      controlLevel: 'ai-master',
      overallScore: 82,
      dimensions: {
        aiCollaboration: 85,
        contextEngineering: 78,
        burnoutRisk: 25,
        toolMastery: 88,
        aiControl: 82,
        skillResilience: 75,
      },
      history: [
        { date: '2025-12-16', overallScore: 78 },
        { date: '2025-12-23', overallScore: 80 },
      ],
      lastAnalyzedAt: '2026-01-13T10:30:00Z',
      analysisCount: 12,
    },
    {
      id: 'member-2',
      name: 'Sarah Kim',
      email: 'sarah.kim@company.com',
      role: 'Staff Engineer',
      department: 'Backend',
      primaryType: 'scientist',
      controlLevel: 'ai-master',
      overallScore: 78,
      dimensions: {
        aiCollaboration: 72,
        contextEngineering: 85,
        burnoutRisk: 30,
        toolMastery: 76,
        aiControl: 88,
        skillResilience: 82,
      },
      history: [
        { date: '2025-12-16', overallScore: 74 },
        { date: '2025-12-23', overallScore: 76 },
      ],
      lastAnalyzedAt: '2026-01-12T15:45:00Z',
      analysisCount: 9,
    },
    {
      id: 'member-3',
      name: 'Mike Park',
      email: 'mike.park@company.com',
      role: 'Frontend Lead',
      department: 'Frontend',
      primaryType: 'collaborator',
      controlLevel: 'developing',
      overallScore: 68,
      dimensions: {
        aiCollaboration: 82,
        contextEngineering: 65,
        burnoutRisk: 45,
        toolMastery: 70,
        aiControl: 55,
        skillResilience: 60,
      },
      history: [
        { date: '2025-12-16', overallScore: 64 },
        { date: '2025-12-23', overallScore: 66 },
      ],
      lastAnalyzedAt: '2026-01-13T09:15:00Z',
      analysisCount: 7,
    },
  ],
}));

import { enterpriseRoutes } from '../../../../src/api/routes/enterprise.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/enterprise', enterpriseRoutes);
  return app;
}

// Mock factory functions
function createMockTeamMember(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-123',
    teamId: 'team-demo',
    role: 'member' as const,
    joinedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createMockTrackingSummary(overrides: Record<string, unknown> = {}) {
  return {
    totalSessions: 15,
    avgScore: 75.5,
    dimensionAverages: {
      aiCollaboration: 80,
      contextEngineering: 70,
      burnoutRisk: 30,
      toolMastery: 75,
      aiControl: 72,
      skillResilience: 68,
    },
    streak: 5,
    ...overrides,
  };
}

function createMockTrackingMetrics(overrides: Record<string, unknown> = {}) {
  return {
    id: 'metric-1',
    userId: 'user-123',
    date: '2026-01-15',
    sessionsAnalyzed: 3,
    averageScore: 75,
    dimensionScores: {
      aiCollaboration: 80,
      contextEngineering: 70,
      burnoutRisk: 30,
      toolMastery: 75,
      aiControl: 72,
      skillResilience: 68,
    },
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('Enterprise API Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/enterprise/team/demo', () => {
    it('should return mock team analytics when no teamId provided', async () => {
      const response = await request(app).get('/api/enterprise/team/demo');

      expect(response.status).toBe(200);
      expect(response.body.teamId).toBe('team-demo');
      expect(response.body.teamName).toBe('Engineering Team');
      expect(response.body.memberCount).toBe(8);
      expect(response.body.averageOverallScore).toBe(74);
      expect(response.body.averageDimensions).toHaveProperty('aiCollaboration', 79);
      expect(response.body.typeDistribution).toHaveProperty('architect', 2);
      expect(response.body.weeklyTrend).toHaveLength(4);
    });

    it('should return mock data when real team has no members', async () => {
      mockTeamRepoInstance.getMembers.mockResolvedValue(ok([]));

      const response = await request(app).get('/api/enterprise/team/demo?teamId=real-team-id');

      expect(response.status).toBe(200);
      expect(response.body.teamId).toBe('team-demo');
      expect(mockTeamRepoInstance.getMembers).toHaveBeenCalledWith('real-team-id');
    });

    it('should return mock data when real team has members (not implemented)', async () => {
      const mockMembers = [createMockTeamMember(), createMockTeamMember({ userId: 'user-456' })];
      mockTeamRepoInstance.getMembers.mockResolvedValue(ok(mockMembers));

      const response = await request(app).get('/api/enterprise/team/demo?teamId=real-team-id');

      expect(response.status).toBe(200);
      expect(response.body.teamId).toBe('team-demo');
      expect(mockTeamRepoInstance.getMembers).toHaveBeenCalledWith('real-team-id');
    });

    it('should fall back to mock data on repository error', async () => {
      mockTeamRepoInstance.getMembers.mockResolvedValue(
        err(StorageError.connectionFailed('Supabase', 'Connection timeout'))
      );

      const response = await request(app).get('/api/enterprise/team/demo?teamId=real-team-id');

      expect(response.status).toBe(200);
      expect(response.body.teamId).toBe('team-demo');
    });

    it('should fall back to mock data on exception', async () => {
      mockTeamRepoInstance.getMembers.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app).get('/api/enterprise/team/demo?teamId=real-team-id');

      expect(response.status).toBe(200);
      expect(response.body.teamId).toBe('team-demo');
    });
  });

  describe('GET /api/enterprise/team/demo/members', () => {
    it('should return all team members without sorting', async () => {
      const response = await request(app).get('/api/enterprise/team/demo/members');

      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(3);
      expect(response.body.members[0].name).toBe('Alex Chen');
      expect(response.body.members[1].name).toBe('Sarah Kim');
      expect(response.body.members[2].name).toBe('Mike Park');
    });

    it('should sort members by name ascending', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/members')
        .query({ sortBy: 'name', sortOrder: 'asc' });

      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(3);
      expect(response.body.members[0].name).toBe('Alex Chen');
      expect(response.body.members[1].name).toBe('Mike Park');
      expect(response.body.members[2].name).toBe('Sarah Kim');
    });

    it('should sort members by name descending', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/members')
        .query({ sortBy: 'name', sortOrder: 'desc' });

      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(3);
      expect(response.body.members[0].name).toBe('Sarah Kim');
      expect(response.body.members[1].name).toBe('Mike Park');
      expect(response.body.members[2].name).toBe('Alex Chen');
    });

    it('should sort members by score ascending', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/members')
        .query({ sortBy: 'score', sortOrder: 'asc' });

      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(3);
      expect(response.body.members[0].overallScore).toBe(68);
      expect(response.body.members[1].overallScore).toBe(78);
      expect(response.body.members[2].overallScore).toBe(82);
    });

    it('should sort members by score descending', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/members')
        .query({ sortBy: 'score', sortOrder: 'desc' });

      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(3);
      expect(response.body.members[0].overallScore).toBe(82);
      expect(response.body.members[1].overallScore).toBe(78);
      expect(response.body.members[2].overallScore).toBe(68);
    });

    it('should sort members by department ascending', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/members')
        .query({ sortBy: 'department', sortOrder: 'asc' });

      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(3);
      expect(response.body.members[0].department).toBe('Backend');
      expect(response.body.members[1].department).toBe('Frontend');
      expect(response.body.members[2].department).toBe('Platform');
    });

    it('should sort members by department descending', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/members')
        .query({ sortBy: 'department', sortOrder: 'desc' });

      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(3);
      expect(response.body.members[0].department).toBe('Platform');
      expect(response.body.members[1].department).toBe('Frontend');
      expect(response.body.members[2].department).toBe('Backend');
    });

    it('should sort members by lastAnalyzed ascending', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/members')
        .query({ sortBy: 'lastAnalyzed', sortOrder: 'asc' });

      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(3);
      expect(response.body.members[0].lastAnalyzedAt).toBe('2026-01-12T15:45:00Z');
      expect(response.body.members[1].lastAnalyzedAt).toBe('2026-01-13T09:15:00Z');
      expect(response.body.members[2].lastAnalyzedAt).toBe('2026-01-13T10:30:00Z');
    });

    it('should sort members by lastAnalyzed descending', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/members')
        .query({ sortBy: 'lastAnalyzed', sortOrder: 'desc' });

      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(3);
      expect(response.body.members[0].lastAnalyzedAt).toBe('2026-01-13T10:30:00Z');
      expect(response.body.members[1].lastAnalyzedAt).toBe('2026-01-13T09:15:00Z');
      expect(response.body.members[2].lastAnalyzedAt).toBe('2026-01-12T15:45:00Z');
    });

    it('should default to ascending when sortOrder not specified', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/members')
        .query({ sortBy: 'score' });

      expect(response.status).toBe(200);
      expect(response.body.members[0].overallScore).toBe(68);
      expect(response.body.members[2].overallScore).toBe(82);
    });

    it('should not sort with invalid sortBy value', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/members')
        .query({ sortBy: 'invalid' });

      expect(response.status).toBe(200);
      expect(response.body.members).toHaveLength(3);
      // Should maintain original order
      expect(response.body.members[0].name).toBe('Alex Chen');
    });
  });

  describe('GET /api/enterprise/team/demo/trends', () => {
    it('should return all trends when period not specified (defaults to 30d)', async () => {
      const response = await request(app).get('/api/enterprise/team/demo/trends');

      expect(response.status).toBe(200);
      expect(response.body.trends).toHaveLength(4);
      expect(response.body.trends[0].date).toBe('2025-12-16');
      expect(response.body.trends[3].date).toBe('2026-01-06');
    });

    it('should return 7d trends (last 1 week)', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/trends')
        .query({ period: '7d' });

      expect(response.status).toBe(200);
      expect(response.body.trends).toHaveLength(1);
      expect(response.body.trends[0].date).toBe('2026-01-06');
      expect(response.body.trends[0].overallScore).toBe(74);
    });

    it('should return 30d trends', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/trends')
        .query({ period: '30d' });

      expect(response.status).toBe(200);
      expect(response.body.trends).toHaveLength(4);
    });

    it('should return 90d trends (all available data)', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/trends')
        .query({ period: '90d' });

      expect(response.status).toBe(200);
      expect(response.body.trends).toHaveLength(4);
    });

    it('should return all trends for unknown period', async () => {
      const response = await request(app)
        .get('/api/enterprise/team/demo/trends')
        .query({ period: 'unknown' });

      expect(response.status).toBe(200);
      expect(response.body.trends).toHaveLength(4);
    });
  });

  describe('GET /api/enterprise/personal/tracking', () => {
    it('should return 400 when userId is missing', async () => {
      const response = await request(app).get('/api/enterprise/personal/tracking');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('userId is required');
      expect(mockTrackingRepoInstance.getSummary).not.toHaveBeenCalled();
    });

    it('should return tracking summary with userId', async () => {
      const mockSummary = createMockTrackingSummary();
      mockTrackingRepoInstance.getSummary.mockResolvedValue(ok(mockSummary));

      const response = await request(app)
        .get('/api/enterprise/personal/tracking')
        .query({ userId: 'user-123' });

      expect(response.status).toBe(200);
      expect(response.body.totalSessions).toBe(15);
      expect(response.body.avgScore).toBe(75.5);
      expect(response.body.dimensionAverages).toHaveProperty('aiCollaboration', 80);
      expect(response.body.streak).toBe(5);
      expect(mockTrackingRepoInstance.getSummary).toHaveBeenCalledWith('user-123');
    });

    it('should return 500 when repository returns error', async () => {
      mockTrackingRepoInstance.getSummary.mockResolvedValue(
        err(StorageError.readFailed('tracking_metrics', 'user-123', 'Database error'))
      );

      const response = await request(app)
        .get('/api/enterprise/personal/tracking')
        .query({ userId: 'user-123' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get tracking summary');
      expect(mockTrackingRepoInstance.getSummary).toHaveBeenCalledWith('user-123');
    });

    it('should return 500 on exception', async () => {
      mockTrackingRepoInstance.getSummary.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .get('/api/enterprise/personal/tracking')
        .query({ userId: 'user-123' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Unexpected error');
    });

    it('should handle empty summary (no metrics)', async () => {
      const emptySummary = {
        totalSessions: 0,
        avgScore: 0,
        dimensionAverages: {},
        streak: 0,
      };
      mockTrackingRepoInstance.getSummary.mockResolvedValue(ok(emptySummary));

      const response = await request(app)
        .get('/api/enterprise/personal/tracking')
        .query({ userId: 'new-user' });

      expect(response.status).toBe(200);
      expect(response.body.totalSessions).toBe(0);
      expect(response.body.avgScore).toBe(0);
      expect(response.body.streak).toBe(0);
    });
  });

  describe('GET /api/enterprise/personal/history', () => {
    it('should return 400 when userId is missing', async () => {
      const response = await request(app).get('/api/enterprise/personal/history');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('userId is required');
      expect(mockTrackingRepoInstance.getLatest).not.toHaveBeenCalled();
    });

    it('should return tracking history with userId (defaults to 30 days)', async () => {
      const mockMetrics = [
        createMockTrackingMetrics({ date: '2026-01-15' }),
        createMockTrackingMetrics({ date: '2026-01-14', averageScore: 72 }),
        createMockTrackingMetrics({ date: '2026-01-13', averageScore: 70 }),
      ];
      mockTrackingRepoInstance.getLatest.mockResolvedValue(ok(mockMetrics));

      const response = await request(app)
        .get('/api/enterprise/personal/history')
        .query({ userId: 'user-123' });

      expect(response.status).toBe(200);
      expect(response.body.metrics).toHaveLength(3);
      expect(response.body.metrics[0].date).toBe('2026-01-15');
      expect(response.body.metrics[0].averageScore).toBe(75);
      expect(mockTrackingRepoInstance.getLatest).toHaveBeenCalledWith('user-123', 30);
    });

    it('should return tracking history with custom days parameter', async () => {
      const mockMetrics = [
        createMockTrackingMetrics({ date: '2026-01-15' }),
        createMockTrackingMetrics({ date: '2026-01-14', averageScore: 72 }),
      ];
      mockTrackingRepoInstance.getLatest.mockResolvedValue(ok(mockMetrics));

      const response = await request(app)
        .get('/api/enterprise/personal/history')
        .query({ userId: 'user-123', days: '7' });

      expect(response.status).toBe(200);
      expect(response.body.metrics).toHaveLength(2);
      expect(mockTrackingRepoInstance.getLatest).toHaveBeenCalledWith('user-123', 7);
    });

    it('should handle days=90', async () => {
      const mockMetrics = [createMockTrackingMetrics()];
      mockTrackingRepoInstance.getLatest.mockResolvedValue(ok(mockMetrics));

      const response = await request(app)
        .get('/api/enterprise/personal/history')
        .query({ userId: 'user-123', days: '90' });

      expect(response.status).toBe(200);
      expect(mockTrackingRepoInstance.getLatest).toHaveBeenCalledWith('user-123', 90);
    });

    it('should handle invalid days parameter (NaN passed to repository)', async () => {
      const mockMetrics = [createMockTrackingMetrics()];
      mockTrackingRepoInstance.getLatest.mockResolvedValue(ok(mockMetrics));

      const response = await request(app)
        .get('/api/enterprise/personal/history')
        .query({ userId: 'user-123', days: 'invalid' });

      expect(response.status).toBe(200);
      expect(mockTrackingRepoInstance.getLatest).toHaveBeenCalledWith('user-123', NaN);
    });

    it('should return 500 when repository returns error', async () => {
      mockTrackingRepoInstance.getLatest.mockResolvedValue(
        err(StorageError.readFailed('tracking_metrics', 'user-123', 'Database error'))
      );

      const response = await request(app)
        .get('/api/enterprise/personal/history')
        .query({ userId: 'user-123' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to get tracking history');
    });

    it('should return 500 on exception', async () => {
      mockTrackingRepoInstance.getLatest.mockRejectedValue(new Error('Connection failed'));

      const response = await request(app)
        .get('/api/enterprise/personal/history')
        .query({ userId: 'user-123' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Connection failed');
    });

    it('should handle empty history', async () => {
      mockTrackingRepoInstance.getLatest.mockResolvedValue(ok([]));

      const response = await request(app)
        .get('/api/enterprise/personal/history')
        .query({ userId: 'new-user' });

      expect(response.status).toBe(200);
      expect(response.body.metrics).toHaveLength(0);
    });

    it('should preserve all dimension scores in response', async () => {
      const mockMetrics = [
        createMockTrackingMetrics({
          dimensionScores: {
            aiCollaboration: 85,
            contextEngineering: 75,
            burnoutRisk: 25,
            toolMastery: 80,
            aiControl: 78,
            skillResilience: 72,
          },
        }),
      ];
      mockTrackingRepoInstance.getLatest.mockResolvedValue(ok(mockMetrics));

      const response = await request(app)
        .get('/api/enterprise/personal/history')
        .query({ userId: 'user-123' });

      expect(response.status).toBe(200);
      expect(response.body.metrics[0].dimensionScores).toEqual({
        aiCollaboration: 85,
        contextEngineering: 75,
        burnoutRisk: 25,
        toolMastery: 80,
        aiControl: 78,
        skillResilience: 72,
      });
    });
  });
});
