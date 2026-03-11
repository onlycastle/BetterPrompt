import { featureRemovedResponse } from '@/lib/server/feature-removed';

export async function GET() {
  return featureRemovedResponse(
    'Legacy shared report metadata',
    'Use /api/analysis/results/:resultId and /r/:resultId instead.'
  );
}

export async function DELETE() {
  return featureRemovedResponse(
    'Legacy shared report deletion',
    'Delete the underlying analysis result instead.'
  );
}
