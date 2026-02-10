/**
 * Members Management Page
 * Organization-wide member list with invite/edit/remove capabilities
 */

import { Suspense } from 'react';
import { MembersContent } from './MembersContent';

export const metadata = {
  title: 'Members | NoMoreAISlop',
  description: 'Manage organization members',
};

export default function MembersPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}>Loading...</div>}>
      <MembersContent />
    </Suspense>
  );
}
