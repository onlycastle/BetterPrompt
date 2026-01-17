/**
 * OAuth Callback Route Handler
 *
 * Exchanges the OAuth authorization code for a Supabase session.
 * This is required for SSR because the code must be exchanged on the server
 * to set httpOnly cookies that API routes can read.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/personal';

  // Handle error from OAuth provider
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    console.error('[Auth Callback] OAuth error:', error, errorDescription);
    return NextResponse.redirect(
      `${origin}/personal?error=oauth_error&message=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (!code) {
    console.error('[Auth Callback] No code provided');
    return NextResponse.redirect(`${origin}/personal?error=no_code`);
  }

  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Exchange the code for a session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('[Auth Callback] Exchange error:', exchangeError.message);
      return NextResponse.redirect(
        `${origin}/personal?error=auth_callback_failed&message=${encodeURIComponent(exchangeError.message)}`
      );
    }

    console.log('[Auth Callback] Session established for user:', data.user?.email);

    // Redirect to the intended destination
    return NextResponse.redirect(`${origin}${next}`);
  } catch (err) {
    console.error('[Auth Callback] Unexpected error:', err);
    return NextResponse.redirect(`${origin}/personal?error=auth_callback_failed`);
  }
}
