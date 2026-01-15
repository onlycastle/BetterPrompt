import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the dependencies before importing routes
vi.mock('../../../../src/utils/local-analysis.js', () => ({
  loadAnalysisLocally: vi.fn(),
  listLocalAnalyses: vi.fn(),
}));

vi.mock('../../../../src/api/services/remote-analysis.js', () => ({
  analyzeRemoteSessions: vi.fn(),
  loadRemoteResult: vi.fn(),
}));

import { analysisRoutes } from '../../../../src/api/routes/analysis.js';
import { loadAnalysisLocally, listLocalAnalyses } from '../../../../src/utils/local-analysis.js';
import { analyzeRemoteSessions, loadRemoteResult } from '../../../../src/api/services/remote-analysis.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/analysis', analysisRoutes);
  return app;
}

// Mock analysis factory
function createMockAnalysis(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'test-analysis-id',
    type: 'verbose',
    createdAt: '2024-01-01T00:00:00.000Z',
    expiresAt: '2024-02-01T00:00:00.000Z',
    metadata: {
      sessionCount: 3,
      projectPath: '/test/project',
      version: '1.0.0',
    },
    data: {
      primaryType: 'architect',
      distribution: {
        architect: 0.6,
        scientist: 0.15,
        collaborator: 0.1,
        speedrunner: 0.1,
        craftsman: 0.05,
      },
      personalitySummary: 'You exhibit strong architectural thinking',
      promptPatterns: [],
      dimensionInsights: [],
    },
    ...overrides,
  };
}

// Mock analysis summary factory
function createMockAnalysisSummary(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'test-analysis-id',
    type: 'verbose',
    createdAt: '2024-01-01T00:00:00.000Z',
    expiresAt: '2024-02-01T00:00:00.000Z',
    metadata: {
      sessionCount: 3,
      projectPath: '/test/project',
    },
    ...overrides,
  };
}

// Mock remote session data
function createMockRemoteSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sessionId: 'session-123',
    projectName: 'test-project',
    messageCount: 10,
    durationMinutes: 25,
    content: '{"type":"user","uuid":"msg-1","timestamp":"2024-01-01T00:00:00.000Z","message":{"content":"Hello"}}\n{"type":"assistant","uuid":"msg-2","timestamp":"2024-01-01T00:01:00.000Z","message":{"content":"Hi there"}}',
    ...overrides,
  };
}

// Mock analysis response
function createMockAnalysisResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    resultId: 'abc123',
    primaryType: 'architect',
    controlLevel: 'developing',
    distribution: {
      architect: 0.6,
      scientist: 0.15,
      collaborator: 0.1,
      speedrunner: 0.1,
      craftsman: 0.05,
    },
    personalitySummary: 'You exhibit strong architectural thinking',
    ...overrides,
  };
}

// Mock remote result
function createMockRemoteResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    evaluation: {
      primaryType: 'architect',
      distribution: {
        architect: 0.6,
        scientist: 0.15,
        collaborator: 0.1,
        speedrunner: 0.1,
        craftsman: 0.05,
      },
      personalitySummary: 'You exhibit strong architectural thinking',
      promptPatterns: [],
      dimensionInsights: [],
    },
    isPaid: false,
    ...overrides,
  };
}

describe('Analysis API Routes', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET /api/analysis/local', () => {
    it('should list local analyses', async () => {
      const mockAnalyses = [
        createMockAnalysisSummary({ id: '1' }),
        createMockAnalysisSummary({ id: '2' }),
      ];

      vi.mocked(listLocalAnalyses).mockResolvedValue(mockAnalyses);

      const response = await request(app).get('/api/analysis/local');

      expect(response.status).toBe(200);
      expect(response.body.analyses).toHaveLength(2);
      expect(response.body.count).toBe(2);
      expect(listLocalAnalyses).toHaveBeenCalledWith({ limit: 20 });
    });

    it('should return empty array when no analyses exist', async () => {
      vi.mocked(listLocalAnalyses).mockResolvedValue([]);

      const response = await request(app).get('/api/analysis/local');

      expect(response.status).toBe(200);
      expect(response.body.analyses).toHaveLength(0);
      expect(response.body.count).toBe(0);
    });

    it('should return 500 on list error', async () => {
      vi.mocked(listLocalAnalyses).mockRejectedValue(new Error('List error'));

      const response = await request(app).get('/api/analysis/local');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to list analyses');
      expect(response.body.message).toBe('List error');
    });
  });

  describe('GET /api/analysis/local/:localId', () => {
    it('should return analysis by ID', async () => {
      const mockAnalysis = createMockAnalysis();

      vi.mocked(loadAnalysisLocally).mockResolvedValue(mockAnalysis);

      const response = await request(app).get('/api/analysis/local/test-id');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test-analysis-id');
      expect(response.body.type).toBe('verbose');
      expect(response.body.data.primaryType).toBe('architect');
      expect(response.body.data.sessionsAnalyzed).toBe(3);
      expect(loadAnalysisLocally).toHaveBeenCalledWith('test-id');
    });

    it('should return 404 when analysis not found', async () => {
      vi.mocked(loadAnalysisLocally).mockResolvedValue(null);

      const response = await request(app).get('/api/analysis/local/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Analysis not found');
      expect(response.body.message).toContain('not found');
    });

    it('should return 500 on load error', async () => {
      vi.mocked(loadAnalysisLocally).mockRejectedValue(new Error('Load error'));

      const response = await request(app).get('/api/analysis/local/test-id');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to load analysis');
      expect(response.body.message).toBe('Load error');
    });

    it('should handle array localId parameter', async () => {
      const mockAnalysis = createMockAnalysis();
      vi.mocked(loadAnalysisLocally).mockResolvedValue(mockAnalysis);

      const response = await request(app).get('/api/analysis/local/test-id');

      expect(response.status).toBe(200);
      expect(loadAnalysisLocally).toHaveBeenCalledWith('test-id');
    });
  });

  describe('POST /api/analysis/remote', () => {
    it('should validate request and return analysis result', async () => {
      const mockRequest = {
        sessions: [createMockRemoteSession()],
        totalMessages: 10,
        totalDurationMinutes: 25,
      };

      const mockResponse = createMockAnalysisResponse();
      vi.mocked(analyzeRemoteSessions).mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/analysis/remote')
        .send(mockRequest);

      expect(response.status).toBe(200);
      expect(response.body.resultId).toBe('abc123');
      expect(response.body.primaryType).toBe('architect');
      expect(response.body.controlLevel).toBe('developing');
      expect(response.body.distribution.architect).toBe(0.6);
      expect(analyzeRemoteSessions).toHaveBeenCalledWith(mockRequest);
    });

    it('should return 400 for missing sessions', async () => {
      const invalidRequest = {
        totalMessages: 10,
        totalDurationMinutes: 25,
      };

      const response = await request(app)
        .post('/api/analysis/remote')
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_REQUEST');
      expect(response.body.message).toContain('session is required');
      expect(analyzeRemoteSessions).not.toHaveBeenCalled();
    });

    it('should return 400 for empty sessions array', async () => {
      const invalidRequest = {
        sessions: [],
        totalMessages: 0,
        totalDurationMinutes: 0,
      };

      const response = await request(app)
        .post('/api/analysis/remote')
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_REQUEST');
      expect(response.body.message).toContain('session is required');
      expect(analyzeRemoteSessions).not.toHaveBeenCalled();
    });

    it('should return 400 for non-array sessions', async () => {
      const invalidRequest = {
        sessions: 'not-an-array',
        totalMessages: 10,
        totalDurationMinutes: 25,
      };

      const response = await request(app)
        .post('/api/analysis/remote')
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_REQUEST');
      expect(analyzeRemoteSessions).not.toHaveBeenCalled();
    });

    it('should return 500 on analysis error', async () => {
      const mockRequest = {
        sessions: [createMockRemoteSession()],
        totalMessages: 10,
        totalDurationMinutes: 25,
      };

      vi.mocked(analyzeRemoteSessions).mockRejectedValue(new Error('Analysis failed'));

      const response = await request(app)
        .post('/api/analysis/remote')
        .send(mockRequest);

      expect(response.status).toBe(500);
      expect(response.body.code).toBe('ANALYSIS_FAILED');
      expect(response.body.message).toBe('Analysis failed');
    });

    it('should handle multiple sessions', async () => {
      const mockRequest = {
        sessions: [
          createMockRemoteSession({ sessionId: 'session-1' }),
          createMockRemoteSession({ sessionId: 'session-2' }),
          createMockRemoteSession({ sessionId: 'session-3' }),
        ],
        totalMessages: 30,
        totalDurationMinutes: 75,
      };

      const mockResponse = createMockAnalysisResponse();
      vi.mocked(analyzeRemoteSessions).mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/analysis/remote')
        .send(mockRequest);

      expect(response.status).toBe(200);
      expect(response.body.resultId).toBe('abc123');
      expect(analyzeRemoteSessions).toHaveBeenCalledWith(mockRequest);
    });
  });

  describe('GET /api/analysis/results/:resultId', () => {
    it('should return result by ID', async () => {
      const mockResult = createMockRemoteResult();
      vi.mocked(loadRemoteResult).mockResolvedValue(mockResult);

      const response = await request(app).get('/api/analysis/results/abc123');

      expect(response.status).toBe(200);
      expect(response.body.resultId).toBe('abc123');
      expect(response.body.isPaid).toBe(false);
      expect(response.body.evaluation.primaryType).toBe('architect');
      expect(loadRemoteResult).toHaveBeenCalledWith('abc123');
    });

    it('should return 404 when result not found', async () => {
      vi.mocked(loadRemoteResult).mockResolvedValue(null);

      const response = await request(app).get('/api/analysis/results/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Result not found');
      expect(response.body.message).toContain('not found');
    });

    it('should return result with paid status', async () => {
      const mockResult = createMockRemoteResult({ isPaid: true });
      vi.mocked(loadRemoteResult).mockResolvedValue(mockResult);

      const response = await request(app).get('/api/analysis/results/paid-result');

      expect(response.status).toBe(200);
      expect(response.body.isPaid).toBe(true);
    });

    it('should return 500 on load error', async () => {
      vi.mocked(loadRemoteResult).mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/analysis/results/abc123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to load result');
      expect(response.body.message).toBe('Database error');
    });

    it('should handle array resultId parameter', async () => {
      const mockResult = createMockRemoteResult();
      vi.mocked(loadRemoteResult).mockResolvedValue(mockResult);

      const response = await request(app).get('/api/analysis/results/test-result');

      expect(response.status).toBe(200);
      expect(loadRemoteResult).toHaveBeenCalledWith('test-result');
    });

    it('should return full evaluation data structure', async () => {
      const mockResult = createMockRemoteResult({
        evaluation: {
          primaryType: 'scientist',
          distribution: {
            architect: 0.1,
            scientist: 0.7,
            collaborator: 0.1,
            speedrunner: 0.05,
            craftsman: 0.05,
          },
          personalitySummary: 'You are a methodical scientist',
          promptPatterns: [
            {
              pattern: 'Detailed questions',
              frequency: 'high',
              examples: ['Can you explain...'],
            },
          ],
          dimensionInsights: [
            {
              dimension: 'abstraction',
              score: 0.8,
              interpretation: 'High abstraction level',
            },
          ],
        },
      });
      vi.mocked(loadRemoteResult).mockResolvedValue(mockResult);

      const response = await request(app).get('/api/analysis/results/scientist-result');

      expect(response.status).toBe(200);
      expect(response.body.evaluation.primaryType).toBe('scientist');
      expect(response.body.evaluation.distribution.scientist).toBe(0.7);
      expect(response.body.evaluation.promptPatterns).toHaveLength(1);
      expect(response.body.evaluation.dimensionInsights).toHaveLength(1);
    });
  });
});
