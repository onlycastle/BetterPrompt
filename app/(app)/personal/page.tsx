'use client';

import { Suspense } from 'react';
import { PersonalDashboardPage } from '@/views/PersonalDashboardPage';
import { LoadingState } from '@/components/ui';

export default function PersonalPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading your profile..." />}>
      <PersonalDashboardPage />
    </Suspense>
  );
}
