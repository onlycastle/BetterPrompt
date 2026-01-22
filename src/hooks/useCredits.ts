/**
 * useCredits Hook (Web App)
 *
 * Provides credit balance fetching with automatic caching and refetching.
 * Uses cookie-based authentication for web app sessions.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

/**
 * Credit info response from API
 */
export interface CreditInfo {
  userId: string;
  credits: number;
  totalUsed: number;
  hasPaid: boolean;
  firstPaidAt: string | null;
}

export const creditsKeys = {
  all: ['credits'] as const,
  info: () => [...creditsKeys.all, 'info'] as const,
};

/**
 * Fetch credit info from API
 */
async function fetchCredits(): Promise<CreditInfo> {
  const res = await fetch('/api/credits', {
    credentials: 'include', // Include cookies for auth
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Failed to fetch credits' }));
    throw new Error(error.message || 'Failed to fetch credits');
  }

  return res.json();
}

/**
 * Hook to fetch user's credit balance
 *
 * - Automatically fetches when user is authenticated
 * - Refetches on window focus
 * - Provides invalidation function for manual refresh
 *
 * @example
 * ```tsx
 * const { credits, invalidate, isLoading } = useCredits();
 *
 * if (isLoading) return <Spinner />;
 * return <div>Credits: {credits ?? 0}</div>;
 * ```
 */
export function useCredits() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: creditsKeys.info(),
    queryFn: fetchCredits,
    enabled: isAuthenticated && !authLoading,
    staleTime: 60 * 1000, // Consider fresh for 1 minute
    refetchOnWindowFocus: true,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: creditsKeys.all });
  };

  return {
    ...query,
    credits: query.data?.credits ?? null,
    hasPaid: query.data?.hasPaid ?? false,
    invalidate,
  };
}

export default useCredits;
