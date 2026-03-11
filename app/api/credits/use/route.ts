import { featureRemovedResponse } from '@/lib/server/feature-removed';

export async function POST() {
  return featureRemovedResponse(
    'Credit redemption',
    'Reports are fully available without credits or unlocks.'
  );
}
