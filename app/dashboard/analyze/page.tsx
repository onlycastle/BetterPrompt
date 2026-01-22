/**
 * Analyze Page
 * Start new analysis or view recent results
 */

import { AnalyzeContent } from './AnalyzeContent';

export const metadata = {
  title: 'Analyze | NoMoreAISlop',
  description: 'Start a new AI coding style analysis',
};

export default function AnalyzePage() {
  return <AnalyzeContent />;
}
