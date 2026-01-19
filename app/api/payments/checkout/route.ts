/**
 * Checkout API Route
 *
 * Creates a Polar checkout session for premium report purchase.
 * Requires authenticated user.
 * Supports both cookie auth (web) and Authorization header (desktop app).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getPolarClient, getProductId } from '@/lib/polar/client';

/**
 * Create a Supabase server client with cookie access
 */
async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
}

/**
 * Get user from Authorization header (for desktop app)
 */
async function getUserFromAuthHeader(request: NextRequest): Promise<User | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    console.log('Auth header validation failed:', error?.message);
    return null;
  }

  return data.user;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Verify user is authenticated (try header first, then cookie)
    let user: User | null = await getUserFromAuthHeader(request);

    if (!user) {
      // Fallback to cookie-based auth for web
      const supabase = await createSupabaseServerClient();
      const { data, error: authError } = await supabase.auth.getUser();
      if (!authError && data.user) {
        user = data.user;
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { resultId, desktopApp } = body;

    if (!resultId) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'resultId is required' },
        { status: 400 }
      );
    }

    // 3. Create Polar checkout session
    const polar = getPolarClient();
    const productId = getProductId();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    // For desktop app, add flag to success URL for deep link redirect
    const successUrl = desktopApp
      ? `${baseUrl}/api/payments/success?checkout_id={CHECKOUT_ID}&desktop=true`
      : `${baseUrl}/api/payments/success?checkout_id={CHECKOUT_ID}`;

    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl,
      customerEmail: user.email ?? undefined,
      metadata: {
        resultId,
        userId: user.id,
      },
    });

    // 4. Return checkout URL
    return NextResponse.json({
      checkoutUrl: checkout.url,
      checkoutId: checkout.id,
    });

  } catch (error) {
    console.error('Checkout creation error:', error);
    return NextResponse.json(
      {
        error: 'Checkout Failed',
        message: error instanceof Error ? error.message : 'Failed to create checkout session',
      },
      { status: 500 }
    );
  }
}
