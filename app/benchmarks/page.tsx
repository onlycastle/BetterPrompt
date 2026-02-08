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

const BASE_URL = process.env.NOSLOP_BASE_URL || 'https://www.nomoreaislop.app';

export const metadata: Metadata = {
  title: 'Global AI Coding Benchmarks | NoMoreAISlop',
  description:
    'See how developers collaborate with AI. Explore type distributions, score percentiles, and discover your AI coding style.',
  openGraph: {
    title: 'Global AI Coding Benchmarks | NoMoreAISlop',
    description:
      'See how developers collaborate with AI. Explore type distributions, score percentiles, and discover your AI coding style.',
    type: 'website',
    url: `${BASE_URL}/benchmarks`,
    siteName: 'NoMoreAISlop',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Global AI Coding Benchmarks | NoMoreAISlop',
    description:
      'See how developers collaborate with AI. Explore type distributions, score percentiles, and discover your AI coding style.',
  },
};

export default function BenchmarksPage() {
  return (
    <Suspense fallback={<ReportLoadingSpinner />}>
      <BenchmarksContent />
    </Suspense>
  );
}
