import { featureRemovedResponse } from '@/lib/server/feature-removed';

export async function GET() {
  return featureRemovedResponse(
    'Legacy report comparison',
    'The self-hosted build no longer exposes the hosted comparison endpoint.'
  );
}
