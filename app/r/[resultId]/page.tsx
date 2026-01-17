import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { PublicResultPageWrapper } from '@/views/PublicResultPageWrapper';

// Disable caching - always fetch fresh data
export const dynamic = 'force-dynamic';

interface PublicResultPageProps {
  params: Promise<{ resultId: string }>;
}

/**
 * Check if user is authenticated and has paid for this result
 * If so, redirect to personal dashboard
 */
async function checkAuthAndRedirect(resultId: string): Promise<boolean> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return false;
    }

    // Get user session from cookies
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Read-only for this check
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return false;
    }

    // Check if this result is paid (using service role for DB access)
    if (!supabaseServiceKey) {
      return false;
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: result } = await adminClient
      .from('analysis_results')
      .select('is_paid, user_id')
      .eq('result_id', resultId)
      .single();

    // Redirect if: user is authenticated AND result is paid AND belongs to this user
    if (result?.is_paid && result?.user_id === user.id) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export default async function PublicResultPage({ params }: PublicResultPageProps) {
  const { resultId } = await params;

  // If user is logged in and has paid for this result, redirect to dashboard
  const shouldRedirect = await checkAuthAndRedirect(resultId);
  if (shouldRedirect) {
    redirect('/personal');
  }

  return <PublicResultPageWrapper resultId={resultId} />;
}
