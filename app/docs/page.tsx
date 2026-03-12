import { Metadata } from 'next';
import { DocsPage } from '@/views/DocsPage';

export const metadata: Metadata = {
  title: 'Documentation | NoMoreAISlop',
  description: 'Learn how to run the self-hosted server and CLI, analyze local sessions, and review your report.',
  openGraph: {
    title: 'Documentation | NoMoreAISlop',
    description: 'Learn how to run the self-hosted server and CLI, analyze local sessions, and review your report.',
  },
};

export default function Docs() {
  return <DocsPage />;
}
