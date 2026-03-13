/**
 * Member Detail Page
 * Individual member profile with diagnostic summary for managers
 */

import { Suspense } from 'react';
import { MemberDetailContent } from './MemberDetailContent';

export const metadata = {
  title: 'Member Profile | BetterPrompt',
  description: 'Individual member analysis profile',
};

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;

  return (
    <Suspense fallback={<div style={{ padding: 32 }}>Loading member profile...</div>}>
      <MemberDetailContent memberId={memberId} />
    </Suspense>
  );
}
