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

const BASE_URL = process.env.BETTERPROMPT_BASE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'Global AI Collaboration Benchmarks | BetterPrompt',
  description:
    'See how builders on your self-hosted server collaborate with AI. Explore type distributions and score percentiles.',
  openGraph: {
    title: 'Global AI Collaboration Benchmarks | BetterPrompt',
    description:
      'See how builders on your self-hosted server collaborate with AI. Explore type distributions and score percentiles.',
    type: 'website',
    url: `${BASE_URL}/benchmarks`,
    siteName: 'BetterPrompt',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Global AI Collaboration Benchmarks | BetterPrompt',
    description:
      'See how builders on your self-hosted server collaborate with AI. Explore type distributions and score percentiles.',
  },
};

export default function BenchmarksPage() {
  return (
    <Suspense fallback={<ReportLoadingSpinner />}>
      <BenchmarksContent />
    </Suspense>
  );
}
