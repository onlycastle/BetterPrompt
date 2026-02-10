/** Hard-coded sample data for the Analysis Showcase section — report preview cards. */

// ─── Card 1: Anti-Pattern Detection ──────────────────────────────

export interface AntiPatternEvidence {
  quote: string;
  tag: string;
}

export interface AntiPatternData {
  sectionLabel: string;
  count: number;
  title: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  metaFoundIn: string;
  metaSeverity: string;
  description: string;
  evidence: AntiPatternEvidence[];
  fix: string;
  expertTitle: string;
  expertBadge: string;
  expertActions: string[];
}

export const ANTI_PATTERN_DATA: AntiPatternData = {
  sectionLabel: 'WHERE TO IMPROVE',
  count: 1,
  title: 'Passive Verification Loop',
  severity: 'HIGH',
  metaFoundIn: 'Found in 2 sessions',
  metaSeverity: 'Severity: High',
  description:
    'You tend to ask AI to "check" your work rather than specifying what to verify. This creates a passive loop where neither you nor the AI performs rigorous validation.',
  evidence: [
    {
      quote: '"Can you check if this looks right?"',
      tag: 'UI debugging',
    },
    {
      quote: '"Does this make sense? Just verify it for me."',
      tag: 'Logic review',
    },
  ],
  fix: 'Don\'t ask AI to "check" — tell it to "test edge cases for null input" or "verify the return type matches the interface." Specific verification prompts yield actionable feedback.',
  expertTitle: 'Simple Agents Beat Complex Ones',
  expertBadge: 'TREND',
  expertActions: [
    'Break complex prompts into single-purpose verification steps',
    'Use assertion-style language: "Confirm X produces Y"',
    'Chain focused checks instead of one broad "review this"',
  ],
};

// ─── Card 2: Weekly Dashboard ────────────────────────────────────

export interface WeeklyStat {
  value: string;
  label: string;
  delta: string;
  direction: 'up' | 'down' | 'neutral';
}

export interface ProjectBar {
  name: string;
  percentage: number;
}

export interface TopSession {
  date: string;
  duration: string;
  summary: string;
}

export interface WeeklyData {
  title: string;
  dateRange: string;
  stats: WeeklyStat[];
  narrative: string;
  projects: ProjectBar[];
  topSessions: TopSession[];
  highlights: string[];
}

export const WEEKLY_DATA: WeeklyData = {
  title: 'This Week',
  dateRange: 'Feb 4 – Feb 10',
  stats: [
    { value: '486', label: 'sessions', delta: '↑ 8%', direction: 'up' },
    { value: '197.4h', label: 'coding hours', delta: '↓ 1%', direction: 'down' },
    { value: '751.3M', label: 'tokens', delta: '↑ 7.7%', direction: 'up' },
    { value: '6/7', label: 'active days', delta: '-1', direction: 'down' },
  ],
  narrative:
    'This week focused on precision UI/UX improvements across two major projects. Heavy component refactoring in nomoreaislop with a shift toward scroll-based report layouts, while alfredworks saw backend schema migrations.',
  projects: [
    { name: 'nomoreaislop', percentage: 56 },
    { name: 'alfredworks', percentage: 33 },
    { name: 'moneybook', percentage: 5 },
  ],
  topSessions: [
    {
      date: 'Feb 6',
      duration: '4h 12m',
      summary: 'Report redesign — scroll layout migration and floating navigation dots',
    },
    {
      date: 'Feb 8',
      duration: '3h 45m',
      summary: 'Schema v2 migration — verbose evaluation type system overhaul',
    },
    {
      date: 'Feb 9',
      duration: '2h 58m',
      summary: 'Landing page showcase section — analysis preview cards',
    },
  ],
  highlights: [
    'Shipped continuous-scroll report layout replacing tabbed navigation',
    'Migrated 12 Zod schemas to v2 type system with zero downtime',
    'Reduced LLM calls from 14 to 11 per analysis run',
    'Added Korean font support with dynamic loading',
  ],
};

// ─── Card 3: Strength Analysis ───────────────────────────────────

export interface StrengthEvidence {
  quote: string;
  tag: string;
  expanded?: boolean;
  originalMessage?: string;
  metadata?: string;
}

export interface StrengthData {
  sectionLabel: string;
  count: number;
  title: string;
  description: string;
  evidence: StrengthEvidence[];
}

export const STRENGTH_DATA: StrengthData = {
  sectionLabel: 'WHAT YOU DO WELL',
  count: 1,
  title: 'Professional Design Reasoning',
  description:
    'Goes beyond simple requests by using terminology like "interaction affordance," "visual hierarchy," and "cognitive load." This signals deep design thinking that produces higher-quality AI outputs.',
  evidence: [
    {
      quote: '"The hover state needs more affordance — add a subtle scale transform and cursor change."',
      tag: 'Component styling',
    },
    {
      quote:
        '"Let\'s reduce cognitive load here. Group related actions into a collapsible section with a clear visual anchor."',
      tag: 'UX architecture',
      expanded: true,
      originalMessage:
        'I need to restructure the settings panel. Right now there are 14 top-level options and it feels overwhelming. Let\'s reduce cognitive load here. Group related actions into a collapsible section with a clear visual anchor — maybe an icon + bold label combo. Think progressive disclosure: show the 4 most-used settings upfront, collapse the rest under "Advanced." Use a subtle divider between groups, not a hard border.',
      metadata: 'Session: 0bd129c8... · Turn #26 · Feb 9, 05:21 PM',
    },
    {
      quote:
        '"We need progressive disclosure — show the 4 most-used settings, collapse Advanced behind an accordion."',
      tag: 'Information architecture',
    },
  ],
};
