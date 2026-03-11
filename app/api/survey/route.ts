import { featureRemovedResponse } from '@/lib/server/feature-removed';

export async function POST() {
  return featureRemovedResponse(
    'Hosted surveys',
    'The open-source build does not submit PMF surveys to a central service.'
  );
}
