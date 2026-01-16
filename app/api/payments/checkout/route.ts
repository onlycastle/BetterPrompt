/**
 * Checkout API Route
 *
 * Creates a Polar checkout session for premium report purchase.
 * Requires authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
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

export async function POST(request: NextRequest) {
  try {
    // 1. Verify user is authenticated
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please sign in to continue' },
        { status: 401 }
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { resultId } = body;

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

    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl: `${baseUrl}/api/payments/success?checkout_id={CHECKOUT_ID}`,
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
