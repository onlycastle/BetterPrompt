import { featureRemovedResponse } from '@/lib/server/feature-removed';

export async function GET() {
  return featureRemovedResponse(
    'Credits',
    'Reports are fully available without credits or payments.'
  );
}
