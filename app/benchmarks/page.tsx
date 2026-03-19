/**
 * Global Benchmarks Page - Server Component
 *
 * Public page (no authentication required) that shows aggregate analysis
 * statistics to drive viral interest. Renders the BenchmarksContent client
 * component which fetches data from /api/benchmarks/global.
 */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { ReportLoadingSpinner } from '@/components/report/ReportLoadingSpinner';
import { buildAbsoluteSiteUrl, resolveSiteOrigin } from '@/lib/site-origin';
import { BenchmarksContent } from './BenchmarksContent';

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const origin = resolveSiteOrigin({
    host: headerStore.get('host'),
    forwardedHost: headerStore.get('x-forwarded-host'),
    forwardedProto: headerStore.get('x-forwarded-proto'),
    origin: headerStore.get('origin'),
    referer: headerStore.get('referer'),
  });

  return {
    title: 'Global AI Collaboration Benchmarks | BetterPrompt',
    description:
      'See how builders on your self-hosted server collaborate with AI. Explore type distributions and score percentiles.',
    openGraph: {
      title: 'Global AI Collaboration Benchmarks | BetterPrompt',
      description:
        'See how builders on your self-hosted server collaborate with AI. Explore type distributions and score percentiles.',
      type: 'website',
      url: buildAbsoluteSiteUrl('/benchmarks', origin),
      siteName: 'BetterPrompt',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Global AI Collaboration Benchmarks | BetterPrompt',
      description:
        'See how builders on your self-hosted server collaborate with AI. Explore type distributions and score percentiles.',
    },
  };
}

export default function BenchmarksPage() {
  return (
    <Suspense fallback={<ReportLoadingSpinner />}>
      <BenchmarksContent />
    </Suspense>
  );
}
