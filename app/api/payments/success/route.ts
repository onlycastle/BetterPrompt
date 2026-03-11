import { featureRemovedResponse } from '@/lib/server/feature-removed';

export async function GET() {
  return featureRemovedResponse(
    'Payment callbacks',
    'The open-source build does not include billing or post-checkout redirects.'
  );
}
