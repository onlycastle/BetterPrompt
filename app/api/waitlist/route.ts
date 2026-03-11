import { featureRemovedResponse } from '@/lib/server/feature-removed';

export async function POST() {
  return featureRemovedResponse(
    'Waitlist signups',
    'Use the local quick-start flow instead of a hosted signup form.'
  );
}
