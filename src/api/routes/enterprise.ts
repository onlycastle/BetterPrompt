/**
 * Enterprise API Routes
 * REST endpoints for team analytics and member analysis
 */

import { Router } from 'express';
import {
  createSupabaseTeamRepository,
  createSupabaseTrackingRepository,
} from '../../infrastructure/storage/supabase/index.js';
import { MOCK_TEAM_ANALYTICS, MOCK_TEAM_MEMBERS } from '../data/mockEnterprise.js';

const router = Router();

// Create repository instances
const teamRepo = createSupabaseTeamRepository();
const trackingRepo = createSupabaseTrackingRepository();
// analysisRepo reserved for future use when building team analytics from real data
// const analysisRepo = createSupabaseAnalysisRepository();

// GET /api/enterprise/team/demo - Team analytics overview
router.get('/team/demo', async (req, res) => {
  try {
    // Try to get real team data
    const teamId = req.query.teamId as string | undefined;

    if (teamId) {
      const membersResult = await teamRepo.getMembers(teamId);
      if (membersResult.success && membersResult.data.length > 0) {
        // TODO: Build analytics from real member data
        // For now, we need to fetch analyses for each member and calculate aggregates
        // This will be implemented when we have user-analysis associations
      }
    }

    // Fall back to mock data if no real data available
    res.json(MOCK_TEAM_ANALYTICS);
  } catch (error) {
    // Fall back to mock data on error
    res.json(MOCK_TEAM_ANALYTICS);
  }
});

// GET /api/enterprise/team/demo/members - List all team members
router.get('/team/demo/members', (req, res) => {
  const { sortBy, sortOrder } = req.query;
  let members = [...MOCK_TEAM_MEMBERS];

  // Sort if requested
  if (sortBy) {
    members = members.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortBy) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'score':
          aVal = a.overallScore;
          bVal = b.overallScore;
          break;
        case 'department':
          aVal = a.department;
          bVal = b.department;
          break;
        case 'lastAnalyzed':
          aVal = new Date(a.lastAnalyzedAt).getTime();
          bVal = new Date(b.lastAnalyzedAt).getTime();
          break;
        default:
          return 0;
      }

      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  res.json({ members });
});

// GET /api/enterprise/team/demo/trends - Historical trend data
router.get('/team/demo/trends', (req, res) => {
  const { period = '30d' } = req.query;

  // Filter trends based on period
  let trends = MOCK_TEAM_ANALYTICS.weeklyTrend;

  if (period === '7d') {
    // Last 7 days (1 week)
    trends = trends.slice(-1);
  } else if (period === '90d') {
    // For 90d, we'd extend the data, but for demo just return all
    trends = MOCK_TEAM_ANALYTICS.weeklyTrend;
  }

  res.json({ trends });
});

// GET /api/enterprise/personal/tracking - Personal tracking summary
router.get('/personal/tracking', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const summaryResult = await trackingRepo.getSummary(userId);

    if (!summaryResult.success) {
      res.status(500).json({ error: 'Failed to get tracking summary' });
      return;
    }

    res.json(summaryResult.data);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/enterprise/personal/history - Personal tracking history
router.get('/personal/history', async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const days = parseInt(req.query.days as string || '30', 10);

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const metricsResult = await trackingRepo.getLatest(userId, days);

    if (!metricsResult.success) {
      res.status(500).json({ error: 'Failed to get tracking history' });
      return;
    }

    res.json({ metrics: metricsResult.data });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export { router as enterpriseRoutes };
