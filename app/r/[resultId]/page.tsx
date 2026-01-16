import { PublicResultPageWrapper } from '@/views/PublicResultPageWrapper';

interface PublicResultPageProps {
  params: Promise<{ resultId: string }>;
}

export default async function PublicResultPage({ params }: PublicResultPageProps) {
  const { resultId } = await params;
  return <PublicResultPageWrapper resultId={resultId} />;
}
