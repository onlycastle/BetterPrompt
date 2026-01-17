'use client';

import { use } from 'react';
import { ReportPageWrapper } from '@/views/ReportPageWrapper';

interface ReportPageProps {
  params: Promise<{ reportId: string }>;
}

export default function ReportPage({ params }: ReportPageProps) {
  const { reportId } = use(params);
  return <ReportPageWrapper reportId={reportId} />;
}
