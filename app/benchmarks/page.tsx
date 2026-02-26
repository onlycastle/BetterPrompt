/**
 * Global Benchmarks Page - Server Component
 *
 * Public page (no authentication required) that shows aggregate analysis
 * statistics to drive viral interest. Renders the BenchmarksContent client
 * component which fetches data from /api/benchmarks/global.
 */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ReportLoadingSpinner } from '@/components/report/ReportLoadingSpinner';
import { BenchmarksContent } from './BenchmarksContent';

const BASE_URL = process.env.NOSLOP_BASE_URL || 'https://www.betterprompt.sh';

export const metadata: Metadata = {
  title: 'Global AI Collaboration Benchmarks | BetterPrompt',
  description:
    'See how builders collaborate with AI. Explore type distributions, score percentiles, and discover your AI builder profile.',
  openGraph: {
    title: 'Global AI Collaboration Benchmarks | BetterPrompt',
    description:
      'See how builders collaborate with AI. Explore type distributions, score percentiles, and discover your AI builder profile.',
    type: 'website',
    url: `${BASE_URL}/benchmarks`,
    siteName: 'BetterPrompt',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Global AI Collaboration Benchmarks | BetterPrompt',
    description:
      'See how builders collaborate with AI. Explore type distributions, score percentiles, and discover your AI builder profile.',
  },
};

export default function BenchmarksPage() {
  return (
    <Suspense fallback={<ReportLoadingSpinner />}>
      <BenchmarksContent />
    </Suspense>
  );
}
