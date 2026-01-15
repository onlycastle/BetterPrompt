import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { TypeResult } from '../../../../src/models/coding-style.js';
import type { FullAnalysisResult } from '../../../../src/analyzer/dimensions/index.js';

// Mock the dependencies before importing routes
vi.mock('../../../../src/lib/supabase.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../../src/api/services/comparison-service.js', () => ({
  generateComparison: vi.fn(),
  getFeaturesByCategory: vi.fn(),
  getComparisonStats: vi.fn(),
  FEATURE_COMPARISON: [],
}));

import { reportRoutes } from '../../../../src/api/routes/reports.js';
import { getSupabase } from '../../../../src/lib/supabase.js';
import {
  generateComparison,
  getFeaturesByCategory,
  getComparisonStats,
} from '../../../../src/api/services/comparison-service.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/reports', reportRoutes);
  return app;
}

// Mock factories
function createMockTypeResult(overrides: Partial<TypeResult> = {}): TypeResult {
  return {
    primaryType: 'architect',
    distribution: {
      architect: 60,
      scientist: 15,
      collaborator: 10,
      speedrunner: 10,
      craftsman: 5,
    },
    metrics: {
      avgPromptLength: 150,
      avgFirstPromptLength: 200,
      avgTurnsPerSession: 5,
      questionFrequency: 0.3,
      modificationRate: 0.2,
      toolUsageHighlight: 'Heavy Read/Grep user',
    },
    evidence: [],
    sessionCount: 3,
    analyzedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createMockDimensions(): FullAnalysisResult {
  return {
    aiCollaboration: {
      dimension: 'aiCollaboration',
      score: 0.75,
      level: 'high',
      interpretation: 'Strong AI collaboration',
      evidence: [],
    },
    promptEngineering: {
      dimension: 'promptEngineering',
      score: 0.65,
      level: 'medium',
      interpretation: 'Good prompt engineering',
      evidence: [],
    },
    burnoutRisk: {
      dimension: 'burnoutRisk',
      score: 0.3,
      level: 'low',
      interpretation: 'Low burnout risk',
      evidence: [],
    },
    toolUsageDepth: {
      dimension: 'toolUsageDepth',
      score: 0.8,
      level: 'high',
      interpretation: 'Deep tool usage',
      evidence: [],
    },
    iterationStyle: {
      dimension: 'iterationStyle',
      score: 0.6,
      level: 'medium',
      interpretation: 'Balanced iteration',
      evidence: [],
    },
    codeQualityFocus: {
      dimension: 'codeQualityFocus',
      score: 0.7,
      level: 'high',
      interpretation: 'Strong quality focus',
      evidence: [],
    },
  };
}

function createMockSupabaseClient() {
  return {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn(),
  };
}

describe('Reports API Routes', () => {
  let app: express.Express;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    app = createTestApp();
    mockSupabase = createMockSupabaseClient();
    vi.mocked(getSupabase).mockReturnValue(mockSupabase as any);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('POST /api/reports/share', () => {
    it('should create a shareable report with valid typeResult', async () => {
      const typeResult = createMockTypeResult();
      const mockData = {
        report_id: 'abc12345',
        access_token: '1234567890abcdef',
        type_result: typeResult,
        expires_at: new Date('2024-02-01T00:00:00.000Z').toISOString(),
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });

      const response = await request(app).post('/api/reports/share').send({
        typeResult,
        sessionId: 'session-123',
        sessionDuration: 25,
        messageCount: 10,
        toolCallCount: 50,
        expiresInDays: 30,
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('reportId');
      expect(response.body).toHaveProperty('shareUrl');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body).toHaveProperty('ogImageUrl');
      expect(response.body.shareUrl).toContain('/r/');
      expect(mockSupabase.from).toHaveBeenCalledWith('shared_reports');
      expect(mockSupabase.insert).toHaveBeenCalled();
    });

    it('should create report with dimensions data', async () => {
      const typeResult = createMockTypeResult();
      const dimensions = createMockDimensions();
      const mockData = {
        report_id: 'xyz98765',
        access_token: 'fedcba0987654321',
        type_result: typeResult,
        dimensions,
        expires_at: new Date('2024-02-01T00:00:00.000Z').toISOString(),
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });

      const response = await request(app).post('/api/reports/share').send({
        typeResult,
        dimensions,
      });

      expect(response.status).toBe(201);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          dimensions,
        })
      );
    });

    it('should return 400 without typeResult', async () => {
      const response = await request(app).post('/api/reports/share').send({
        sessionId: 'session-123',
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
      expect(response.body.message).toContain('typeResult');
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('should return 400 with incomplete typeResult', async () => {
      const response = await request(app).post('/api/reports/share').send({
        typeResult: {
          primaryType: 'architect',
          // Missing distribution
        },
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('should return 500 on database error', async () => {
      const typeResult = createMockTypeResult();
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const response = await request(app).post('/api/reports/share').send({
        typeResult,
      });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create shared report');
      expect(response.body.message).toBe('Database error');
    });

    it('should use default expiration of 30 days', async () => {
      const typeResult = createMockTypeResult();
      const mockData = {
        report_id: 'def45678',
        access_token: 'abcd1234efgh5678',
        type_result: typeResult,
        expires_at: new Date('2024-01-31T00:00:00.000Z').toISOString(),
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });

      const response = await request(app).post('/api/reports/share').send({
        typeResult,
      });

      expect(response.status).toBe(201);
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          expires_at: expect.any(String),
        })
      );
    });
  });

  describe('GET /api/reports/:reportId', () => {
    it('should return report data for valid reportId', async () => {
      const typeResult = createMockTypeResult();
      // Use future date to ensure not expired
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const mockData = {
        report_id: 'abc12345',
        type_result: typeResult,
        dimensions: null,
        session_id: 'session-123',
        session_duration_minutes: 25,
        message_count: 10,
        tool_call_count: 50,
        view_count: 5,
        share_count: 2,
        created_at: '2024-01-01T00:00:00.000Z',
        expires_at: futureDate.toISOString(),
        is_active: true,
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const response = await request(app).get('/api/reports/abc12345');

      expect(response.status).toBe(200);
      expect(response.body.reportId).toBe('abc12345');
      expect(response.body.typeResult).toEqual(typeResult);
      expect(response.body.sessionMetadata).toEqual({
        sessionId: 'session-123',
        durationMinutes: 25,
        messageCount: 10,
        toolCallCount: 50,
      });
      expect(response.body.stats).toEqual({
        viewCount: 5,
        shareCount: 2,
      });
      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_report_views', {
        report_uuid: 'abc12345',
      });
    });

    it('should return 404 for non-existent report', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const response = await request(app).get('/api/reports/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Report not found');
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should return 410 for expired report', async () => {
      const typeResult = createMockTypeResult();
      const mockData = {
        report_id: 'expired123',
        type_result: typeResult,
        expires_at: '2020-01-01T00:00:00.000Z', // Past date
        is_active: true,
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });

      const response = await request(app).get('/api/reports/expired123');

      expect(response.status).toBe(410);
      expect(response.body.error).toBe('Report expired');
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should return 404 for inactive report', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      const response = await request(app).get('/api/reports/inactive123');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Report not found');
    });

    it('should return report with dimensions if available', async () => {
      const typeResult = createMockTypeResult();
      const dimensions = createMockDimensions();
      // Use future date to ensure not expired
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const mockData = {
        report_id: 'with-dims',
        type_result: typeResult,
        dimensions,
        view_count: 0,
        share_count: 0,
        created_at: '2024-01-01T00:00:00.000Z',
        expires_at: futureDate.toISOString(),
        is_active: true,
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const response = await request(app).get('/api/reports/with-dims');

      expect(response.status).toBe(200);
      expect(response.body.dimensions).toEqual(dimensions);
    });

    it('should return 500 on database error', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/api/reports/error123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('POST /api/reports/:reportId/share', () => {
    it('should record share action successfully', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const response = await request(app)
        .post('/api/reports/abc12345/share')
        .send({ platform: 'twitter' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.platform).toBe('twitter');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_report_shares', {
        report_uuid: 'abc12345',
      });
    });

    it('should record share without platform', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const response = await request(app).post('/api/reports/xyz98765/share').send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.platform).toBe('unknown');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_report_shares', {
        report_uuid: 'xyz98765',
      });
    });

    it('should return 500 on database error', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('RPC failed'));

      const response = await request(app).post('/api/reports/abc12345/share').send({});

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/reports/:reportId/og-image', () => {
    it('should return SVG image for valid report', async () => {
      const typeResult = createMockTypeResult({ primaryType: 'scientist' });
      const mockData = {
        report_id: 'img12345',
        type_result: typeResult,
        is_active: true,
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });

      const response = await request(app).get('/api/reports/img12345/og-image');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('image/svg+xml');
      expect(response.headers['cache-control']).toContain('max-age=86400');
      const svgContent = typeof response.text === 'string' ? response.text : response.body.toString();
      expect(svgContent).toContain('<svg');
      expect(svgContent).toContain('SCIENTIST');
    });

    it('should generate image with correct type information', async () => {
      const typeResult = createMockTypeResult({
        primaryType: 'speedrunner',
        distribution: { architect: 10, scientist: 10, collaborator: 10, speedrunner: 60, craftsman: 10 },
      });
      const mockData = {
        report_id: 'speed123',
        type_result: typeResult,
        is_active: true,
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });

      const response = await request(app).get('/api/reports/speed123/og-image');

      expect(response.status).toBe(200);
      const svgContent = typeof response.text === 'string' ? response.text : response.body.toString();
      expect(svgContent).toContain('SPEEDRUNNER');
      expect(svgContent).toContain('60% match');
    });

    it('should return 404 for non-existent report', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const response = await request(app).get('/api/reports/missing/og-image');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Report not found');
    });

    it('should return 404 for inactive report', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      const response = await request(app).get('/api/reports/inactive/og-image');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Report not found');
    });
  });

  describe('DELETE /api/reports/:reportId', () => {
    it('should deactivate report with valid accessToken', async () => {
      const mockData = {
        report_id: 'del12345',
        is_active: false,
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });

      const response = await request(app)
        .delete('/api/reports/del12345')
        .send({ accessToken: 'valid-token' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.reportId).toBe('del12345');
      expect(mockSupabase.update).toHaveBeenCalledWith({ is_active: false });
      expect(mockSupabase.eq).toHaveBeenCalledWith('report_id', 'del12345');
      expect(mockSupabase.eq).toHaveBeenCalledWith('access_token', 'valid-token');
    });

    it('should return 404 with invalid accessToken', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const response = await request(app)
        .delete('/api/reports/del12345')
        .send({ accessToken: 'wrong-token' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Report not found or access denied');
    });

    it('should return 400 without accessToken', async () => {
      const response = await request(app).delete('/api/reports/del12345').send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid request');
      expect(response.body.message).toContain('accessToken');
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should return 400 without reportId', async () => {
      const response = await request(app).delete('/api/reports/').send({ accessToken: 'token' });

      expect(response.status).toBe(404); // Express returns 404 for missing route param
    });

    it('should return 500 on database error', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Update failed'));

      const response = await request(app)
        .delete('/api/reports/error123')
        .send({ accessToken: 'token' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/reports/comparison/features', () => {
    it('should return feature comparison matrix', async () => {
      const mockFeaturesByCategory = {
        analysis: [
          {
            feature: 'AI Coding Style Type',
            description: 'Your primary coding style',
            free: true,
            premium: true,
            category: 'analysis' as const,
          },
        ],
        insights: [
          {
            feature: '6 Dimension Deep Dive',
            description: 'AI Collaboration, Prompt Engineering, etc.',
            free: false,
            premium: true,
            category: 'insights' as const,
          },
        ],
      };

      const mockStats = {
        freeFeatureCount: 6,
        premiumFeatureCount: 11,
        premiumOnlyCount: 5,
      };

      vi.mocked(getFeaturesByCategory).mockReturnValue(mockFeaturesByCategory);
      vi.mocked(getComparisonStats).mockReturnValue(mockStats);

      const response = await request(app).get('/api/reports/comparison/features');

      expect(response.status).toBe(200);
      expect(response.body.features).toBeDefined();
      expect(response.body.byCategory).toEqual(mockFeaturesByCategory);
      expect(response.body.stats).toEqual(mockStats);
      expect(getFeaturesByCategory).toHaveBeenCalled();
      expect(getComparisonStats).toHaveBeenCalled();
    });

    it('should return 500 on service error', async () => {
      vi.mocked(getFeaturesByCategory).mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app).get('/api/reports/comparison/features');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('GET /api/reports/comparison/:reportId', () => {
    it('should return comparison data for valid report', async () => {
      const typeResult = createMockTypeResult();
      const dimensions = createMockDimensions();
      // Use future date to ensure not expired
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const mockData = {
        report_id: 'comp12345',
        type_result: typeResult,
        dimensions,
        session_id: 'session-123',
        session_duration_minutes: 25,
        message_count: 10,
        tool_call_count: 50,
        expires_at: futureDate.toISOString(),
        is_active: true,
      };

      const mockComparison = {
        free: {
          tier: 'free' as const,
          reportId: 'comp12345',
          typeResult,
          lockedFeatures: ['6 Dimension Deep Dive', 'Growth Roadmap'],
        },
        premium: {
          tier: 'premium' as const,
          reportId: 'comp12345',
          typeResult,
          dimensions,
          sessionMetadata: {
            sessionId: 'session-123',
            durationMinutes: 25,
            messageCount: 10,
            toolCallCount: 50,
          },
        },
        featureComparison: [],
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });
      vi.mocked(generateComparison).mockReturnValue(mockComparison);

      const response = await request(app).get('/api/reports/comparison/comp12345');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockComparison);
      expect(response.body.free.tier).toBe('free');
      expect(response.body.premium.tier).toBe('premium');
      expect(generateComparison).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'comp12345',
          typeResult,
          dimensions,
        })
      );
    });

    it('should return 404 for non-existent report', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const response = await request(app).get('/api/reports/comparison/missing');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Report not found');
      expect(generateComparison).not.toHaveBeenCalled();
    });

    it('should return 410 for expired report', async () => {
      const typeResult = createMockTypeResult();
      const mockData = {
        report_id: 'expired-comp',
        type_result: typeResult,
        expires_at: '2020-01-01T00:00:00.000Z', // Past date
        is_active: true,
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });

      const response = await request(app).get('/api/reports/comparison/expired-comp');

      expect(response.status).toBe(410);
      expect(response.body.error).toBe('Report expired');
      expect(generateComparison).not.toHaveBeenCalled();
    });

    it('should return 404 for inactive report', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      const response = await request(app).get('/api/reports/comparison/inactive');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Report not found');
    });

    it('should handle report without dimensions', async () => {
      const typeResult = createMockTypeResult();
      // Use future date to ensure not expired
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const mockData = {
        report_id: 'no-dims',
        type_result: typeResult,
        dimensions: null,
        expires_at: futureDate.toISOString(),
        is_active: true,
      };

      const mockComparison = {
        free: {
          tier: 'free' as const,
          reportId: 'no-dims',
          typeResult,
          lockedFeatures: [],
        },
        premium: {
          tier: 'premium' as const,
          reportId: 'no-dims',
          typeResult,
        },
        featureComparison: [],
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });
      vi.mocked(generateComparison).mockReturnValue(mockComparison);

      const response = await request(app).get('/api/reports/comparison/no-dims');

      expect(response.status).toBe(200);
      expect(response.body.premium.dimensions).toBeUndefined();
      expect(generateComparison).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: 'no-dims',
        })
      );
    });

    it('should return 500 on database error', async () => {
      mockSupabase.single.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/reports/comparison/error123');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should return 500 on comparison service error', async () => {
      const typeResult = createMockTypeResult();
      // Use future date to ensure not expired
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const mockData = {
        report_id: 'comp-error',
        type_result: typeResult,
        expires_at: futureDate.toISOString(),
        is_active: true,
      };

      mockSupabase.single.mockResolvedValue({ data: mockData, error: null });
      vi.mocked(generateComparison).mockImplementation(() => {
        throw new Error('Comparison failed');
      });

      const response = await request(app).get('/api/reports/comparison/comp-error');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});
