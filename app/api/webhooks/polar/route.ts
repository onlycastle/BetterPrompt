import { featureRemovedResponse } from '@/lib/server/feature-removed';

export async function POST() {
  return featureRemovedResponse(
    'Polar webhooks',
    'The open-source build does not include billing integrations.'
  );
}
