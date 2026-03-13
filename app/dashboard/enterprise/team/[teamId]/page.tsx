/**
 * Team Detail Page
 * Shows team-level analytics with member breakdown
 */

import { Suspense } from 'react';
import { TeamDetailContent } from './TeamDetailContent';

export const metadata = {
  title: 'Team Detail | BetterPrompt',
  description: 'Team-level AI development analytics',
};

export default function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}>Loading...</div>}>
      <TeamDetailContentWrapper params={params} />
    </Suspense>
  );
}

async function TeamDetailContentWrapper({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  return <TeamDetailContent teamId={teamId} />;
}
