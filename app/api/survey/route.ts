/**
 * Survey API Route
 *
 * POST: Submit PMF survey response (disappointment level + optional text fields)
 * No authentication required - public endpoint tied to resultId
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSlackNotification, formatKoreanTime } from '@/lib/slack';

const DISAPPOINTMENT_LEVELS = ['very_disappointed', 'somewhat_disappointed', 'not_disappointed'] as const;
type DisappointmentLevel = (typeof DISAPPOINTMENT_LEVELS)[number];

interface SurveyRequest {
  resultId: string;
  disappointmentLevel: DisappointmentLevel;
  targetUser?: string;
  mainBenefit?: string;
  improvement?: string;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * POST /api/survey
 *
 * Stores a PMF survey response in the survey_responses table.
 *
 * @param request - JSON body with { resultId, disappointmentLevel, targetUser?, mainBenefit?, improvement? }
 * @returns { success: true } or error
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SurveyRequest;
    const { resultId, disappointmentLevel, targetUser, mainBenefit, improvement } = body;

    // Validate resultId
    if (!resultId || typeof resultId !== 'string') {
      return NextResponse.json(
        { error: 'resultId is required' },
        { status: 400 }
      );
    }

    // Validate disappointmentLevel (required, must be one of 3 values)
    if (!disappointmentLevel || !DISAPPOINTMENT_LEVELS.includes(disappointmentLevel)) {
      return NextResponse.json(
        { error: 'disappointmentLevel must be one of: very_disappointed, somewhat_disappointed, not_disappointed' },
        { status: 400 }
      );
    }

    // Validate optional text fields
    if (targetUser !== undefined && targetUser !== null) {
      if (typeof targetUser !== 'string' || targetUser.length > 300) {
        return NextResponse.json(
          { error: 'targetUser must be a string with max 300 characters' },
          { status: 400 }
        );
      }
    }

    if (mainBenefit !== undefined && mainBenefit !== null) {
      if (typeof mainBenefit !== 'string' || mainBenefit.length > 300) {
        return NextResponse.json(
          { error: 'mainBenefit must be a string with max 300 characters' },
          { status: 400 }
        );
      }
    }

    if (improvement !== undefined && improvement !== null) {
      if (typeof improvement !== 'string' || improvement.length > 500) {
        return NextResponse.json(
          { error: 'improvement must be a string with max 500 characters' },
          { status: 400 }
        );
      }
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('survey_responses').insert({
      result_id: resultId,
      disappointment_level: disappointmentLevel,
      target_user: targetUser?.trim() || null,
      main_benefit: mainBenefit?.trim() || null,
      improvement: improvement?.trim() || null,
    });

    if (error) {
      throw error;
    }

    // Send Slack notification (fire and forget)
    const levelEmoji = disappointmentLevel === 'very_disappointed' ? '🟢' : disappointmentLevel === 'somewhat_disappointed' ? '🟡' : '🔴';
    const levelLabel = disappointmentLevel === 'very_disappointed' ? 'Very Disappointed' : disappointmentLevel === 'somewhat_disappointed' ? 'Somewhat' : 'Not Disappointed';
    sendSlackNotification({
      text: `📋 PMF Survey 응답!\n• 실망도: ${levelEmoji} ${levelLabel}${mainBenefit ? `\n• 핵심 가치: ${mainBenefit.trim()}` : ''}${improvement ? `\n• 개선점: ${improvement.trim()}` : ''}\n• 시간: ${formatKoreanTime()}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Survey API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit survey' },
      { status: 500 }
    );
  }
}
