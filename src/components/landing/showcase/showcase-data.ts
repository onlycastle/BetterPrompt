/** Hard-coded sample data for the Analysis Showcase section — report preview cards. */

// ─── Card 1: AI Dependency Score ────────────────────────────────

export interface DependencyScoreData {
  sectionLabel: string;
  scorePercent: number;
  scoreLabel: string;
  description: string;
  breakdown: { label: string; value: number }[];
  insight: string;
}

export const DEPENDENCY_SCORE_DATA: DependencyScoreData = {
  sectionLabel: 'BEHAVIOR ANALYSIS',
  scorePercent: 73,
  scoreLabel: 'blind acceptance rate',
  description:
    'You accepted AI-generated code without reviewing in 73% of changes. Most builders don\'t realize how much they trust blindly.',
  breakdown: [
    { label: 'Auto-accepted', value: 73 },
    { label: 'Reviewed', value: 18 },
    { label: 'Rejected', value: 9 },
  ],
  insight:
    'Builders who review more than 50% of AI output report 3x fewer production issues',
};

// ─── Card 2: Security Risk Report ───────────────────────────────

export interface RiskItem {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  title: string;
  detail: string;
}

export interface SecurityRiskData {
  sectionLabel: string;
  totalIssues: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  items: RiskItem[];
  footer: string;
}

export const SECURITY_RISK_DATA: SecurityRiskData = {
  sectionLabel: 'RISK DETECTION',
  totalIssues: 7,
  criticalCount: 3,
  highCount: 2,
  mediumCount: 2,
  items: [
    {
      severity: 'CRITICAL',
      title: 'Exposed API key in frontend bundle',
      detail: 'src/config.ts line 12',
    },
    {
      severity: 'CRITICAL',
      title: 'No authentication on admin routes',
      detail: '/api/admin/* endpoints',
    },
    {
      severity: 'CRITICAL',
      title: 'SQL injection vulnerability',
      detail: 'Raw query in user search',
    },
    {
      severity: 'HIGH',
      title: 'Missing rate limiting on auth endpoints',
      detail: '/api/login, /api/register',
    },
    {
      severity: 'HIGH',
      title: 'No input validation on form submissions',
      detail: '2 form handlers affected',
    },
  ],
  footer:
    'This is what a security audit would catch. We run one every session.',
};

// ─── Card 3: Growth Path ────────────────────────────────────────

export interface GrowthWeek {
  week: string;
  label: string;
  score: number;
}

export interface GrowthPathData {
  sectionLabel: string;
  profileType: string;
  weeks: GrowthWeek[];
  summary: string;
}

export const GROWTH_PATH_DATA: GrowthPathData = {
  sectionLabel: 'YOUR GROWTH',
  profileType: 'Navigator Architect',
  weeks: [
    { week: 'Week 1', label: 'Accepting everything', score: 27 },
    { week: 'Week 2', label: 'Starting to question', score: 45 },
    { week: 'Week 3', label: 'Asking better questions', score: 63 },
    { week: 'Week 4', label: 'Reviewing critically', score: 78 },
  ],
  summary:
    'From accepting everything to reviewing critically — your AI builder personality: Navigator Architect',
};
