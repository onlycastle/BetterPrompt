/**
 * Legacy Report Route — Redirects to Immersive Report
 * Preserves query params (e.g., ?payment=success) through the redirect.
 */

import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ resultId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyReportPage({ params, searchParams }: PageProps) {
  const { resultId } = await params;
  const resolvedSearch = await searchParams;
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(resolvedSearch).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string'
      )
    )
  ).toString();
  redirect(`/dashboard/r/${resultId}${qs ? `?${qs}` : ''}`);
}
