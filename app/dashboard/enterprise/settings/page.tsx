/**
 * Enterprise Settings Page
 * Organization configuration (scaffolding)
 */

import { Suspense } from 'react';
import { SettingsContent } from './SettingsContent';

export const metadata = {
  title: 'Settings | NoMoreAISlop',
  description: 'Organization settings and configuration',
};

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32 }}>Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
