/**
 * Enterprise API Routes
 * REST endpoints for team analytics and member analysis
 */

import { Router } from 'express';
import { MOCK_TEAM_ANALYTICS, MOCK_TEAM_MEMBERS } from '../data/mockEnterprise.js';

const router = Router();

// GET /api/enterprise/team/demo - Team analytics overview
router.get('/team/demo', (_req, res) => {
  res.json(MOCK_TEAM_ANALYTICS);
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

export { router as enterpriseRoutes };
