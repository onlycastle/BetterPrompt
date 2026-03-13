/**
 * Enterprise Overview Page
 * Organization-wide dashboard with key metrics and team summaries
 */

import { Suspense } from 'react';
import { EnterpriseOverviewContent } from './EnterpriseOverviewContent';

export const metadata = {
  title: 'Enterprise Overview | BetterPrompt',
  description: 'Organization-wide AI development analytics',
};

export default function EnterpriseOverviewPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}>Loading...</div>}>
      <EnterpriseOverviewContent />
    </Suspense>
  );
}
