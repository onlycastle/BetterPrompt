import { Metadata } from 'next';
import { DocsPage } from '@/views/DocsPage';

export const metadata: Metadata = {
  title: 'Documentation | NoMoreAISlop',
  description: 'Technical deep-dive into NoMoreAISlop\'s analysis pipeline, CLI usage, and methodology for assessing developer-AI collaboration.',
  openGraph: {
    title: 'Documentation | NoMoreAISlop',
    description: 'Technical deep-dive into NoMoreAISlop\'s analysis pipeline, CLI usage, and methodology.',
  },
};

export default function Docs() {
  return <DocsPage />;
}
