import { featureRemovedResponse } from '@/lib/server/feature-removed';

export async function POST() {
  return featureRemovedResponse(
    'Legacy shared report creation',
    'Use /r/:resultId for report sharing in the self-hosted build.'
  );
}
