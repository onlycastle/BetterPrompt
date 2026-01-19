/**
 * Payment Success API Route
 *
 * Handles redirect from Polar after successful payment.
 * Verifies payment status and updates database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPolarClient } from '@/lib/polar/client';

/**
 * Get Supabase admin client for database updates
 */
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function GET(request: NextRequest) {
  const checkoutId = request.nextUrl.searchParams.get('checkout_id');
  const isDesktopApp = request.nextUrl.searchParams.get('desktop') === 'true';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  // Missing checkout ID
  if (!checkoutId) {
    console.error('Payment success called without checkout_id');
    return NextResponse.redirect(new URL('/personal?error=missing_checkout', baseUrl));
  }

  try {
    // 1. Verify checkout status with Polar
    const polar = getPolarClient();
    const checkout = await polar.checkouts.get({ id: checkoutId });

    console.log('Checkout status:', checkout.status, 'for ID:', checkoutId);

    // 2. Check if payment succeeded
    if (checkout.status !== 'succeeded') {
      console.log('Payment not succeeded. Status:', checkout.status);
      return NextResponse.redirect(
        new URL(`/personal?error=payment_incomplete&status=${checkout.status}`, baseUrl)
      );
    }

    // 3. Extract resultId from metadata
    const resultId = checkout.metadata?.resultId as string | undefined;

    if (!resultId) {
      console.error('No resultId in checkout metadata:', checkout.metadata);
      // Payment succeeded but no resultId - redirect to personal anyway
      return NextResponse.redirect(new URL('/personal?payment=success', baseUrl));
    }

    // 4. Update analysis_results in database
    const supabase = getSupabaseAdmin();

    const { error: updateError } = await supabase
      .from('analysis_results')
      .update({
        is_paid: true,
        polar_checkout_id: checkoutId,
        paid_at: new Date().toISOString(),
      })
      .eq('result_id', resultId);

    if (updateError) {
      // Log error but don't fail - payment was successful
      console.error('Failed to update analysis_results:', updateError);
      // Could implement retry logic or queue for later processing
    } else {
      console.log('Successfully updated is_paid for result:', resultId);
    }

    // 5. Redirect based on client type
    if (isDesktopApp) {
      // Deep link to desktop app with resultId
      console.log('Redirecting to desktop app with resultId:', resultId);
      return NextResponse.redirect(`nomoreaislop://payment/success?resultId=${resultId}`);
    }

    // Web: redirect to personal dashboard with success message
    return NextResponse.redirect(new URL('/personal?payment=success', baseUrl));

  } catch (error) {
    console.error('Payment verification error:', error);
    // Don't expose internal errors to user
    return NextResponse.redirect(
      new URL('/personal?error=verification_failed', baseUrl)
    );
  }
}
