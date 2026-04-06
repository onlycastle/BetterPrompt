/**
 * Member Detail Page
 * Individual member profile with diagnostic summary for managers.
 * Supports contextual back navigation via searchParams:
 *   ?from=team&teamId=xxx&teamName=yyy → "Back to [TeamName]" link
 *   (no params) → "Back to Members" link (default)
 */

import { Suspense } from 'react';
import { MemberDetailContent } from './MemberDetailContent';

export const metadata = {
  title: 'Member Profile | BetterPrompt',
  description: 'Individual member analysis profile',
};

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ from?: string; teamId?: string; teamName?: string }>;
}) {
  const { memberId } = await params;
  const query = await searchParams;

  // Build contextual back navigation from search params
  const backTo = query.from === 'team' && query.teamId
    ? { from: 'team' as const, teamId: query.teamId, teamName: query.teamName }
    : undefined;

  return (
    <Suspense fallback={<div style={{ padding: 32 }}>Loading member profile...</div>}>
      <MemberDetailContent memberId={memberId} backTo={backTo} />
    </Suspense>
  );
}
