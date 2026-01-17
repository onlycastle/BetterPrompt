'use client';

import { use } from 'react';
import { ComparisonPageWrapper } from '@/views/ComparisonPageWrapper';

interface ComparisonWithReportPageProps {
  params: Promise<{ reportId: string }>;
}

export default function ComparisonWithReportPage({ params }: ComparisonWithReportPageProps) {
  const { reportId } = use(params);
  return <ComparisonPageWrapper reportId={reportId} />;
}
