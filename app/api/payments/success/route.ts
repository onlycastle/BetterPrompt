/**
 * Payment Success API Route
 *
 * Handles redirect from Polar after successful payment.
 * Verifies payment status and adds credits to user account.
 *
 * Credit System:
 * - Each purchase adds credits to user account
 * - Credits are used to unlock detailed reports
 * - Payment is recorded in payments table
 * - Credit transaction is recorded for audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPolarClient } from '@/lib/polar/client';

// Credits per product (can be configured per product in future)
const CREDITS_PER_PURCHASE = 1;

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

    // 3. Extract metadata
    const resultId = checkout.metadata?.resultId as string | undefined;
    const userId = checkout.metadata?.userId as string | undefined;

    const supabase = getSupabaseAdmin();

    // 4. Record payment in database
    console.log('[PaymentSuccess] Recording payment for user:', userId);

    if (userId) {
      // 4a. Create payment record
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          polar_checkout_id: checkoutId,
          polar_customer_id: checkout.customerId || null,
          amount: checkout.totalAmount || 0,
          currency: checkout.currency || 'USD',
          credits_purchased: CREDITS_PER_PURCHASE,
          status: 'succeeded',
          result_id: resultId || null,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (paymentError) {
        console.error('[PaymentSuccess] Failed to record payment:', paymentError);
      } else {
        console.log('[PaymentSuccess] Payment recorded:', paymentData.id);

        // 4b. Add credits to user using RPC function
        const { data: newBalance, error: creditError } = await supabase.rpc(
          'add_credits_from_purchase',
          {
            p_user_id: userId,
            p_payment_id: paymentData.id,
            p_credits: CREDITS_PER_PURCHASE,
          }
        );

        if (creditError) {
          console.error('[PaymentSuccess] Failed to add credits:', creditError);
        } else {
          console.log('[PaymentSuccess] Credits added. New balance:', newBalance);
        }
      }

      // 4c. If resultId provided, auto-unlock the report
      if (resultId) {
        const { data: unlocked, error: unlockError } = await supabase.rpc(
          'use_credit_for_report',
          {
            p_user_id: userId,
            p_result_id: resultId,
          }
        );

        if (unlockError) {
          console.error('[PaymentSuccess] Failed to auto-unlock report:', unlockError);
        } else {
          console.log('[PaymentSuccess] Report auto-unlocked:', unlocked);
        }
      }
    } else {
      console.error('[PaymentSuccess] No userId in checkout metadata');
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
