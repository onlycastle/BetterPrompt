/**
 * React Query hook for fetching Open Graph metadata
 *
 * Fetches OG metadata (thumbnail, title, site name) from the /api/og-metadata endpoint.
 * Used by ResourcePreviewCard to show rich previews of learning resources.
 *
 * Features:
 * - Automatic caching (1 hour stale time)
 * - Request deduplication
 * - Loading/error states
 */

import { useQuery } from '@tanstack/react-query';

interface OGMetadata {
  title: string | null;
  image: string | null;
  siteName: string | null;
  publishedDate: string | null;
}

/**
 * Query key factory for OG metadata
 */
export const ogMetadataKeys = {
  all: ['og-metadata'] as const,
  url: (url: string) => [...ogMetadataKeys.all, url] as const,
};

/**
 * Fetch OG metadata from the API
 */
async function fetchOGMetadata(url: string): Promise<OGMetadata> {
  const response = await fetch(`/api/og-metadata?url=${encodeURIComponent(url)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch OG metadata: ${response.status}`);
  }

  return response.json();
}

/**
 * Hook to fetch Open Graph metadata for a URL
 *
 * @param url - The URL to fetch metadata for
 * @returns Query result with metadata, loading state, and error
 *
 * @example
 * const { data: metadata, isLoading, error } = useOGMetadata('https://react.dev/learn/hooks');
 * // metadata = { title: "Hooks – React", image: "https://...", siteName: "React", publishedDate: null }
 */
export function useOGMetadata(url: string | undefined) {
  return useQuery({
    queryKey: ogMetadataKeys.url(url ?? ''),
    queryFn: () => fetchOGMetadata(url!),
    enabled: !!url, // Only fetch if URL is provided
    staleTime: 1000 * 60 * 60, // 1 hour - OG metadata rarely changes
    gcTime: 1000 * 60 * 60 * 24, // 24 hours garbage collection
    retry: 1, // Only retry once on failure
  });
}
