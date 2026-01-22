/**
 * Web OAuth Callback Route
 *
 * Handles OAuth callback for web app authentication.
 * Exchanges authorization code for session and sets cookies.
 *
 * Flow:
 * 1. Supabase redirects here: /auth/callback?code=xxx&next=/personal
 * 2. Exchange code for session using @supabase/ssr
 * 3. Redirect to the `next` parameter or /personal
 *
 * Note: Desktop app uses /auth/desktop-callback instead (hash fragment flow)
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendSlackNotification, formatKoreanTime } from '@/lib/slack';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/personal';

  // Validate redirect URL to prevent open redirect attacks
  const safeNext = next.startsWith('/') ? next : '/personal';

  if (!code) {
    console.error('[Auth Callback] No code received');
    return NextResponse.redirect(`${origin}/auth/error?reason=no_code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Auth Callback] Supabase not configured');
    return NextResponse.redirect(`${origin}/auth/error?reason=config_error`);
  }

  // Create server client with cookie handling
  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });

  // Exchange code for session
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[Auth Callback] Code exchange failed:', error.message);
    return NextResponse.redirect(
      `${origin}/auth/error?reason=exchange_failed&message=${encodeURIComponent(error.message)}`
    );
  }

  console.log('[Auth Callback] Session created, redirecting to:', safeNext);

  // Send Slack notification for new signups (fire and forget)
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const provider = user.app_metadata?.provider || 'email';
    sendSlackNotification({
      text: `👤 새 회원가입!\n• 이메일: ${user.email}\n• Provider: ${provider}\n• 시간: ${formatKoreanTime()}`,
    });
  }

  // Redirect to the target page
  return NextResponse.redirect(`${origin}${safeNext}`);
}
