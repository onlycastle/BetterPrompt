/** Hard-coded sample data for the Analysis Showcase section. */

export const EVIDENCE_QUOTES = [
  {
    text: '"Set the client input limit to 200MB — it compresses to about 2MB anyway. Why is the server limit at 10MB? Shouldn\'t it be 50MB?"',
    session: 'Session #31',
    turn: 'Turn 14',
  },
  {
    text: '"We should update docs with what we just changed. And let\'s add it to CLAUDE.md too so future sessions know."',
    session: 'Session #42',
    turn: 'Turn 67',
  },
] as const;

export const PERCENTILE_DATA = {
  label: 'Communication',
  percentile: 92,
  totalDevelopers: 3119,
} as const;

export const FOCUS_AREA_DATA = {
  title: 'Infrastructure Debugging',
  priorityScore: 87,
  actions: {
    start: 'Check environment state before running infra commands',
    stop: 'Blindly retrying failed commands without diagnosing root cause',
    continue: 'Critically validating security policies and business logic',
  },
} as const;

export const ACTIVITY_DATA = {
  sessionsThisMonth: 473,
  tokensProcessed: '813M',
  weeks: [
    // 7 days per week, 4 weeks. Values 0-4 represent intensity levels.
    [1, 2, 3, 4, 3, 2, 1],
    [2, 3, 4, 4, 3, 3, 1],
    [1, 3, 4, 4, 4, 2, 2],
    [3, 4, 4, 3, 3, 2, 1],
  ],
} as const;
