import { featureRemovedResponse } from '@/lib/server/feature-removed';

export async function POST() {
  return featureRemovedResponse(
    'Checkout',
    'The open-source build does not include billing because reports are always unlocked.'
  );
}
