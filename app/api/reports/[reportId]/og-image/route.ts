/**
 * GET /api/reports/:reportId/og-image
 * Generate Open Graph image for social sharing
 * Returns an SVG image (1200x630px)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import type { TypeResult } from '@/lib/models/coding-style';

/**
 * Generate OG image as SVG
 */
function generateOGImageSVG(typeResult: TypeResult): string {
  const TYPE_INFO: Record<string, { emoji: string; name: string; color: string }> = {
    architect: { emoji: '🏗️', name: 'Architect', color: '#00d4ff' },
    analyst: { emoji: '🔬', name: 'Analyst', color: '#8B5CF6' },
    conductor: { emoji: '🎼', name: 'Conductor', color: '#F59E0B' },
    speedrunner: { emoji: '⚡', name: 'Speedrunner', color: '#ffff00' },
    trendsetter: { emoji: '🚀', name: 'Trendsetter', color: '#06B6D4' },
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
    www.nomoreaislop.xyz
  </text>

  <!-- Scanlines effect -->
  <pattern id="scanlines" patternUnits="userSpaceOnUse" width="1200" height="4">
    <rect width="1200" height="2" fill="transparent"/>
    <rect y="2" width="1200" height="2" fill="black" opacity="0.1"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#scanlines)"/>
</svg>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params;

    if (!reportId) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'reportId is required',
        },
        { status: 400 }
      );
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
      return NextResponse.json(
        {
          error: 'Report not found',
        },
        { status: 404 }
      );
    }

    const typeResult = data.type_result as TypeResult;

    // Generate SVG image
    const svg = generateOGImageSVG(typeResult);

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('Error in GET /api/reports/:reportId/og-image:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
