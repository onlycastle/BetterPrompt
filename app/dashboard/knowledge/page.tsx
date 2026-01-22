/**
 * Knowledge Page
 * Browse and search knowledge base
 */

import { KnowledgeContent } from './KnowledgeContent';

export const metadata = {
  title: 'Knowledge | NoMoreAISlop',
  description: 'Browse curated AI engineering knowledge',
};

export default function KnowledgePage() {
  return <KnowledgeContent />;
}
