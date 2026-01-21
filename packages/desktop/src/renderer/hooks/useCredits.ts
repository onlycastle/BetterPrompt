/**
 * React Query hook for Credits API
 *
 * Provides credit balance fetching with automatic caching and refetching.
 * Integrates with auth session for Bearer token authentication.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getCredits, type CreditInfo } from '../api/client';

export const creditsKeys = {
  all: ['credits'] as const,
  info: () => [...creditsKeys.all, 'info'] as const,
};

/**
 * Hook to fetch user's credit balance
 *
 * - Automatically fetches when user is authenticated
 * - Refetches on window focus
 * - Provides invalidation function for manual refresh
 */
export function useCredits() {
  const { session, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: creditsKeys.info(),
    queryFn: () => getCredits(session?.access_token),
    enabled: isAuthenticated && !!session?.access_token,
    staleTime: 60 * 1000, // Consider fresh for 1 minute
    refetchOnWindowFocus: true,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: creditsKeys.all });
  };

  return {
    ...query,
    credits: query.data?.credits ?? null,
    invalidate,
  };
}
