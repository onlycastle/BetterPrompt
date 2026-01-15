# Report Components

React components for the Analysis Report page that match the terminal aesthetic from `src/web/template.ts`.

## Components

### TerminalWindow

macOS-style window frame with traffic light buttons.

```tsx
import { TerminalWindow } from '@/components/report';

<TerminalWindow title="NoMoreAISlop — analysis-report.html">
  {/* Content */}
</TerminalWindow>
```

### TerminalTabs

iTerm2-style tab navigation bar with keyboard hints.

```tsx
import { TerminalTabs } from '@/components/report';

const tabs = [
  { id: 'result', label: 'result' },
  { id: 'ai-collaboration', label: 'ai-dep' },
  { id: 'context', label: 'context' },
];

<TerminalTabs
  tabs={tabs}
  activeIndex={0}
  onTabClick={(index) => console.log('Tab clicked:', index)}
  showHint={true}
/>
```

### TypeResultSection

Main type result display with emoji, title, distribution chart, and metrics.

```tsx
import { TypeResultSection } from '@/components/report';
import { TYPE_METADATA } from '@/models/coding-style';

<TypeResultSection
  typeResult={typeResult}
  typeMetadata={TYPE_METADATA}
/>
```

### DimensionSection

Reusable dimension section with score, breakdown metrics, and growth areas.

```tsx
import { DimensionSection } from '@/components/report';

<DimensionSection
  dimension={aiCollaborationResult}
  title="AI Collaboration Mastery"
  icon="🤝"
  subtitle="How effectively do you collaborate with AI?"
  isUnlocked={false}
  accentColor="var(--neon-cyan)"
  levelLabels={{
    expert: 'Expert Collaborator',
    proficient: 'Proficient User',
    developing: 'Developing Skills',
  }}
  breakdownLabels={{
    structuredPlanning: 'Structured Planning',
    aiOrchestration: 'AI Orchestration',
    criticalVerification: 'Critical Verification',
  }}
/>
```

### UnlockSection

CTA section showing unlock badge (premium) or paywall (free). Always shows dual dashboard buttons.

```tsx
import { UnlockSection } from '@/components/report';

<UnlockSection
  isUnlocked={false}
  dashboardBaseUrl="https://www.nomoreaislop.xyz"
/>
```

## Full Example

```tsx
import React, { useState } from 'react';
import {
  TerminalWindow,
  TerminalTabs,
  TypeResultSection,
  DimensionSection,
  UnlockSection,
} from '@/components/report';
import { TYPE_METADATA } from '@/models/coding-style';

export function AnalysisReportPage() {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { id: 'result', label: 'result' },
    { id: 'ai-collaboration', label: 'ai-dep' },
    { id: 'unlock', label: 'unlock' },
  ];

  return (
    <>
      <div className="macos-background" />
      <TerminalWindow>
        <TerminalTabs
          tabs={tabs}
          activeIndex={activeTab}
          onTabClick={setActiveTab}
        />

        <div className="scroll-container">
          <section>
            <TypeResultSection
              typeResult={typeResult}
              typeMetadata={TYPE_METADATA}
            />
          </section>

          <section>
            <DimensionSection
              dimension={aiCollaborationResult}
              title="AI Collaboration Mastery"
              icon="🤝"
              isUnlocked={false}
              accentColor="var(--neon-cyan)"
            />
          </section>

          <section>
            <UnlockSection isUnlocked={false} />
          </section>
        </div>
      </TerminalWindow>
      <div className="scanline" />
    </>
  );
}
```

## Styling Notes

- All components use CSS modules for scoped styling
- Terminal aesthetic CSS variables are defined in `styles/terminal-variables.css`
- Import terminal variables in `main.tsx` before using these components
- Components preserve the exact neon terminal aesthetic from the original template
- Responsive breakpoints at 768px and 600px

## Keyboard Navigation

Implement in your page component using Intersection Observer:

```tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        // Navigate to next section
        break;
      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        // Navigate to previous section
        break;
      case '1':
      case '2':
      case '3':
        e.preventDefault();
        // Jump to specific section
        break;
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, []);
```

## Scroll-based Navigation

Use Intersection Observer to detect which section is in view:

```tsx
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.getAttribute('data-index') || '0');
          setActiveTab(index);
        }
      });
    },
    { threshold: 0.5 }
  );

  sections.forEach((section) => observer.observe(section));
  return () => observer.disconnect();
}, []);
```
