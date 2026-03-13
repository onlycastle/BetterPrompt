/**
 * Analyze Page
 * Start new analysis or view recent results
 */

import { AnalyzeContent } from './AnalyzeContent';

export const metadata = {
  title: 'Analyze | BetterPrompt',
  description: 'Start a new AI session analysis',
};

export default function AnalyzePage() {
  return <AnalyzeContent />;
}
