/**
 * Waitlist API Route
 *
 * POST: Add email to waitlist with Slack notification
 * No authentication required - public endpoint
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSlackNotification, formatKoreanTime } from '@/lib/slack';

/** Valid waitlist source types */
const VALID_SOURCES = ['macos_app', 'pro_subscription'] as const;
type WaitlistSource = (typeof VALID_SOURCES)[number];

interface WaitlistRequest {
  email: string;
  source: WaitlistSource;
}

/**
 * Get Supabase admin client for server-side operations
 */
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * POST /api/waitlist
 *
 * Adds an email to the waitlist and sends Slack notification.
 *
 * @param request - JSON body with { email, source }
 * @returns { status: 'success' | 'already_exists' } or error
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WaitlistRequest;
    const { email, source } = body;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Validate source
    if (!source || !VALID_SOURCES.includes(source)) {
      return NextResponse.json(
        { error: 'Invalid source. Must be one of: ' + VALID_SOURCES.join(', ') },
        { status: 400 }
      );
    }

    // Insert into waitlist
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('waitlist').insert({ email, source });

    if (error) {
      // Handle unique constraint violation (email already exists for this source)
      if (error.code === '23505') {
        return NextResponse.json({ status: 'already_exists' });
      }
      throw error;
    }

    // Send Slack notification (fire and forget - don't block response)
    const emoji = source === 'pro_subscription' ? '💎' : '🖥️';
    const label = source === 'pro_subscription' ? 'PRO Waitlist' : 'Desktop App Waitlist';
    sendSlackNotification({
      text: `${emoji} ${label} 신청!\n• 이메일: ${email}\n• 시간: ${formatKoreanTime()}`,
    });

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('[Waitlist API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to join waitlist' },
      { status: 500 }
    );
  }
}
