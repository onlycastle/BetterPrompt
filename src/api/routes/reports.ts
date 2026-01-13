/**
 * Reports API Routes
 *
 * Endpoints for sharing and retrieving analysis reports.
 * Powers the viral sharing functionality.
 */

import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { getSupabase } from '../../lib/supabase.js';
import type { TypeResult } from '../../models/coding-style.js';
import type { FullAnalysisResult } from '../../analyzer/dimensions/index.js';
import {
  generateComparison,
  getFeaturesByCategory,
  getComparisonStats,
  FEATURE_COMPARISON,
} from '../services/comparison-service.js';

const router = Router();

// Base URL for share links (configure in env)
const BASE_URL = process.env.NOSLOP_BASE_URL || 'https://nomoreaislop.xyz';

/**
 * Generate a short, URL-friendly report ID (8 alphanumeric characters)
 */
function generateReportId(): string {
  return randomBytes(4).toString('hex');
}

/**
 * Generate an access token for the report (16 alphanumeric characters)
 */
function generateAccessToken(): string {
  return randomBytes(8).toString('hex');
}

/**
 * POST /api/reports/share
 * Create a shareable report URL
 */
router.post('/share', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      typeResult,
      dimensions,
      sessionId,
      sessionDuration,
      messageCount,
      toolCallCount,
      expiresInDays = 30,
    } = req.body as {
      typeResult: TypeResult;
      dimensions?: FullAnalysisResult;
      sessionId?: string;
      sessionDuration?: number;
      messageCount?: number;
      toolCallCount?: number;
      expiresInDays?: number;
    };

    // Validate required fields
    if (!typeResult || !typeResult.primaryType || !typeResult.distribution) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'typeResult with primaryType and distribution is required',
      });
      return;
    }

    // Generate IDs
    const reportId = generateReportId();
    const accessToken = generateAccessToken();

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Save to database
    const supabase = getSupabase();
    const { error } = await supabase
      .from('shared_reports')
      .insert({
        report_id: reportId,
        access_token: accessToken,
        type_result: typeResult,
        dimensions: dimensions || null,
        session_id: sessionId || null,
        session_duration_minutes: sessionDuration || null,
        message_count: messageCount || null,
        tool_call_count: toolCallCount || null,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating shared report:', error);
      res.status(500).json({
        error: 'Failed to create shared report',
        message: error.message,
      });
      return;
    }

    const shareUrl = `${BASE_URL}/r/${reportId}`;

    res.status(201).json({
      reportId,
      shareUrl,
      accessToken,
      expiresAt: expiresAt.toISOString(),
      ogImageUrl: `${BASE_URL}/api/reports/${reportId}/og-image`,
    });
  } catch (error) {
    console.error('Error in POST /api/reports/share:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/reports/:reportId
 * Get a shared report by ID
 */
router.get('/:reportId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportId } = req.params;

    if (!reportId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'reportId is required',
      });
      return;
    }

    const supabase = getSupabase();

    // Get the report
    const { data, error } = await supabase
      .from('shared_reports')
      .select('*')
      .eq('report_id', reportId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      res.status(404).json({
        error: 'Report not found',
        message: 'The requested report does not exist or has been removed',
      });
      return;
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      res.status(410).json({
        error: 'Report expired',
        message: 'This report has expired',
      });
      return;
    }

    // Increment view count (fire and forget)
    supabase.rpc('increment_report_views', { report_uuid: reportId }).then();

    // Return report data
    res.json({
      reportId: data.report_id,
      typeResult: data.type_result,
      dimensions: data.dimensions,
      sessionMetadata: {
        sessionId: data.session_id,
        durationMinutes: data.session_duration_minutes,
        messageCount: data.message_count,
        toolCallCount: data.tool_call_count,
      },
      stats: {
        viewCount: data.view_count,
        shareCount: data.share_count,
      },
      createdAt: data.created_at,
    });
  } catch (error) {
    console.error('Error in GET /api/reports/:reportId:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * POST /api/reports/:reportId/share
 * Record a share action (for analytics)
 */
router.post('/:reportId/share', async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportId } = req.params;
    const { platform } = req.body as { platform?: string };

    if (!reportId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'reportId is required',
      });
      return;
    }

    const supabase = getSupabase();

    // Increment share count
    await supabase.rpc('increment_report_shares', { report_uuid: reportId });

    res.json({ success: true, platform: platform || 'unknown' });
  } catch (error) {
    console.error('Error in POST /api/reports/:reportId/share:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/reports/:reportId/og-image
 * Generate Open Graph image for social sharing
 * Returns an SVG image (1200x630px)
 */
router.get('/:reportId/og-image', async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportId } = req.params;

    if (!reportId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'reportId is required',
      });
      return;
    }

    const supabase = getSupabase();

    // Get the report
    const { data, error } = await supabase
      .from('shared_reports')
      .select('type_result')
      .eq('report_id', reportId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      res.status(404).json({
        error: 'Report not found',
      });
      return;
    }

    const typeResult = data.type_result as TypeResult;

    // Generate SVG image
    const svg = generateOGImageSVG(typeResult);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.send(svg);
  } catch (error) {
    console.error('Error in GET /api/reports/:reportId/og-image:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Generate OG image as SVG
 */
function generateOGImageSVG(typeResult: TypeResult): string {
  const TYPE_INFO: Record<string, { emoji: string; name: string; color: string }> = {
    architect: { emoji: '🏗️', name: 'Architect', color: '#00d4ff' },
    scientist: { emoji: '🔬', name: 'Scientist', color: '#00ff88' },
    collaborator: { emoji: '🤝', name: 'Collaborator', color: '#ff00ff' },
    speedrunner: { emoji: '⚡', name: 'Speedrunner', color: '#ffff00' },
    craftsman: { emoji: '🔧', name: 'Craftsman', color: '#ff6b00' },
  };

  const typeInfo = TYPE_INFO[typeResult.primaryType] || TYPE_INFO.architect;
  const percentage = Math.round(typeResult.distribution[typeResult.primaryType] || 0);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0a"/>
      <stop offset="100%" style="stop-color:#1a1a2e"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Border glow -->
  <rect x="20" y="20" width="1160" height="590" rx="20" ry="20"
        fill="none" stroke="${typeInfo.color}" stroke-width="2" opacity="0.5"/>

  <!-- Title -->
  <text x="600" y="120" text-anchor="middle"
        font-family="monospace" font-size="28" fill="#888888">
    YOUR AI CODING STYLE
  </text>

  <!-- Type emoji and name -->
  <text x="600" y="280" text-anchor="middle"
        font-family="sans-serif" font-size="80" filter="url(#glow)">
    ${typeInfo.emoji}
  </text>

  <text x="600" y="380" text-anchor="middle"
        font-family="monospace" font-size="64" font-weight="bold"
        fill="${typeInfo.color}" filter="url(#glow)">
    ${typeInfo.name.toUpperCase()}
  </text>

  <!-- Percentage -->
  <text x="600" y="440" text-anchor="middle"
        font-family="monospace" font-size="32" fill="#666666">
    ${percentage}% match
  </text>

  <!-- CTA -->
  <text x="600" y="550" text-anchor="middle"
        font-family="monospace" font-size="24" fill="#00d4ff">
    nomoreaislop.xyz
  </text>

  <!-- Scanlines effect -->
  <pattern id="scanlines" patternUnits="userSpaceOnUse" width="1200" height="4">
    <rect width="1200" height="2" fill="transparent"/>
    <rect y="2" width="1200" height="2" fill="black" opacity="0.1"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#scanlines)"/>
</svg>`;
}

/**
 * DELETE /api/reports/:reportId
 * Deactivate a shared report (requires access token)
 */
router.delete('/:reportId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportId } = req.params;
    const { accessToken } = req.body as { accessToken?: string };

    if (!reportId || !accessToken) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'reportId and accessToken are required',
      });
      return;
    }

    const supabase = getSupabase();

    // Verify access token and deactivate
    const { data, error } = await supabase
      .from('shared_reports')
      .update({ is_active: false })
      .eq('report_id', reportId)
      .eq('access_token', accessToken)
      .select()
      .single();

    if (error || !data) {
      res.status(404).json({
        error: 'Report not found or access denied',
        message: 'The report does not exist or the access token is invalid',
      });
      return;
    }

    res.json({ success: true, reportId });
  } catch (error) {
    console.error('Error in DELETE /api/reports/:reportId:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/reports/comparison/features
 * Get feature comparison matrix (no report needed)
 */
router.get('/comparison/features', (_req: Request, res: Response): void => {
  try {
    const stats = getComparisonStats();
    const featuresByCategory = getFeaturesByCategory();

    res.json({
      features: FEATURE_COMPARISON,
      byCategory: featuresByCategory,
      stats,
    });
  } catch (error) {
    console.error('Error in GET /api/reports/comparison/features:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/reports/comparison/:reportId
 * Get a report formatted for free/premium comparison
 */
router.get('/comparison/:reportId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportId } = req.params;

    if (!reportId) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'reportId is required',
      });
      return;
    }

    const supabase = getSupabase();

    // Get the report
    const { data, error } = await supabase
      .from('shared_reports')
      .select('*')
      .eq('report_id', reportId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      res.status(404).json({
        error: 'Report not found',
        message: 'The requested report does not exist or has been removed',
      });
      return;
    }

    // Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      res.status(410).json({
        error: 'Report expired',
        message: 'This report has expired',
      });
      return;
    }

    // Generate comparison data
    const comparison = generateComparison({
      reportId: data.report_id,
      typeResult: data.type_result as TypeResult,
      dimensions: data.dimensions as FullAnalysisResult | undefined,
      sessionMetadata: {
        sessionId: data.session_id,
        durationMinutes: data.session_duration_minutes,
        messageCount: data.message_count,
        toolCallCount: data.tool_call_count,
      },
    });

    res.json(comparison);
  } catch (error) {
    console.error('Error in GET /api/reports/comparison/:reportId:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export { router as reportRoutes };
