import { Metadata } from 'next';
import { DocsPage } from '@/views/DocsPage';

export const metadata: Metadata = {
  title: 'Documentation | BetterPrompt',
  description: 'Learn how to get started with BetterPrompt — connect your AI tool, get your assessment, and start improving your AI collaboration.',
  openGraph: {
    title: 'Documentation | BetterPrompt',
    description: 'Learn how to get started with BetterPrompt — connect your AI tool, get your assessment, and start improving.',
  },
};

export default function Docs() {
  return <DocsPage />;
}
