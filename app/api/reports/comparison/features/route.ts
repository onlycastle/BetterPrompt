/**
 * GET /api/reports/comparison/features
 * Get feature comparison matrix (no report needed)
 */

import { NextResponse } from 'next/server';
import {
  getFeaturesByCategory,
  getComparisonStats,
  FEATURE_COMPARISON,
} from '@/lib/api/services/comparison-service';

export async function GET() {
  try {
    const stats = getComparisonStats();
    const featuresByCategory = getFeaturesByCategory();

    return NextResponse.json({
      features: FEATURE_COMPARISON,
      byCategory: featuresByCategory,
      stats,
    });
  } catch (error) {
    console.error('Error in GET /api/reports/comparison/features:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
