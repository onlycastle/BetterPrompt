/**
 * Polar Webhook Handler
 *
 * Handles Polar payment webhooks for reliable credit addition.
 * Uses @polar-sh/nextjs for automatic signature verification.
 *
 * This is more reliable than success URL redirect because:
 * - Server-to-server communication, not dependent on user browser
 * - Automatic retry on failure
 * - Handles edge cases (browser close, network issues during redirect)
 *
 * Events handled:
 * - checkout.updated (status: succeeded) - Add credits to user
 */

import { Webhooks } from '@polar-sh/nextjs';
import { createClient } from '@supabase/supabase-js';

// Credits per product (matches success route)
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

/**
 * Check if payment was already processed (idempotency)
 */
async function isPaymentProcessed(checkoutId: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('payments')
    .select('id')
    .eq('polar_checkout_id', checkoutId)
    .single();

  return !!data;
}

/**
 * Process a successful checkout - add credits to user
 */
async function processSuccessfulCheckout(
  checkoutId: string,
  customerId: string | null,
  amount: number,
  currency: string,
  metadata: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();

  // Extract metadata
  const resultId = metadata?.resultId as string | undefined;
  const userId = metadata?.userId as string | undefined;

  if (!userId) {
    console.error('[Webhook] No userId in checkout metadata');
    return { success: false, error: 'No userId in metadata' };
  }

  // Check idempotency - don't process twice
  if (await isPaymentProcessed(checkoutId)) {
    console.log('[Webhook] Payment already processed:', checkoutId);
    return { success: true }; // Return success since it was already done
  }

  console.log('[Webhook] Processing payment for user:', userId);

  // 1. Create payment record
  const { data: paymentData, error: paymentError } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      polar_checkout_id: checkoutId,
      polar_customer_id: customerId || null,
      amount: amount || 0,
      currency: currency || 'USD',
      credits_purchased: CREDITS_PER_PURCHASE,
      status: 'succeeded',
      result_id: resultId || null,
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (paymentError) {
    // Check if it's a duplicate key error (race condition with success URL)
    if (paymentError.code === '23505') {
      console.log('[Webhook] Payment already exists (race condition):', checkoutId);
      return { success: true };
    }
    console.error('[Webhook] Failed to record payment:', paymentError);
    return { success: false, error: paymentError.message };
  }

  console.log('[Webhook] Payment recorded:', paymentData.id);

  // 2. Add credits to user using RPC function
  const { data: newBalance, error: creditError } = await supabase.rpc(
    'add_credits_from_purchase',
    {
      p_user_id: userId,
      p_payment_id: paymentData.id,
      p_credits: CREDITS_PER_PURCHASE,
    }
  );

  if (creditError) {
    console.error('[Webhook] Failed to add credits:', creditError);
    return { success: false, error: creditError.message };
  }

  console.log('[Webhook] Credits added. New balance:', newBalance);

  // 3. If resultId provided, auto-unlock the report
  if (resultId) {
    const { data: unlocked, error: unlockError } = await supabase.rpc(
      'use_credit_for_report',
      {
        p_user_id: userId,
        p_result_id: resultId,
      }
    );

    if (unlockError) {
      console.error('[Webhook] Failed to auto-unlock report:', unlockError);
      // Don't fail the whole webhook for this
    } else {
      console.log('[Webhook] Report auto-unlocked:', unlocked);
    }
  }

  return { success: true };
}

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onCheckoutUpdated: async (payload) => {
    const checkout = payload.data;

    // Only process successful checkouts
    if (checkout.status !== 'succeeded') {
      console.log('[Webhook] Checkout status:', checkout.status, '- skipping');
      return;
    }

    console.log('[Webhook] Processing successful checkout:', checkout.id);

    const result = await processSuccessfulCheckout(
      checkout.id,
      checkout.customerId ?? null,
      checkout.totalAmount ?? 0,
      checkout.currency ?? 'USD',
      (checkout.metadata ?? {}) as Record<string, unknown>
    );

    if (!result.success) {
      console.error('[Webhook] Failed to process checkout:', result.error);
      // Throwing will cause Polar to retry
      throw new Error(result.error);
    }

    console.log('[Webhook] Checkout processed successfully');
  },
});
